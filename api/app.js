/* Whole backend in one Vercel function:  /api/app?a=<action>
   Storage: Upstash Redis over REST. Without it the app runs in demo mode and saves nothing. */
const crypto = require("crypto");
const DATA = require("../data.js");
const env = process.env;

const HOSPITAL = env.HOSPITAL_NAME || DATA.hospital.fullName;
const CUR = DATA.hospital.currency || "GHS";
const TZ_HOURS = +(env.TZ_OFFSET_HOURS || 0);
const CC = env.DEFAULT_COUNTRY_CODE || "233";

/* ---------------- storage ---------------- */
const R_URL = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
const R_TOK = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
const HAS_DB = !!(R_URL && R_TOK);
const SECRET = env.SESSION_SECRET || R_TOK || "demo-secret";
const mem = global.__mem3 || (global.__mem3 = new Map());

function memCmd([c, k, ...a]) {
  c = c.toUpperCase();
  const set = () => { if (!(mem.get(k) instanceof Set)) mem.set(k, new Set()); return mem.get(k); };
  const list = () => { if (!Array.isArray(mem.get(k))) mem.set(k, []); return mem.get(k); };
  switch (c) {
    case "GET": return mem.has(k) ? mem.get(k) : null;
    case "SET": if (a.includes("NX") && mem.has(k)) return null; mem.set(k, String(a[0])); return "OK";
    case "DEL": return mem.delete(k) ? 1 : 0;
    case "MGET": return [k, ...a].map(x => (mem.has(x) ? mem.get(x) : null));
    case "INCR": { const n = (+mem.get(k) || 0) + 1; mem.set(k, String(n)); return n; }
    case "EXPIRE": return 1;
    case "SADD": set().add(a[0]); return 1;
    case "SREM": return set().delete(a[0]) ? 1 : 0;
    case "SMEMBERS": return [...set()];
    case "LPUSH": list().unshift(a[0]); return list().length;
    case "LTRIM": mem.set(k, list().slice(+a[0], +a[1] + 1)); return "OK";
    case "LRANGE": return list().slice(+a[0], +a[1] + 1);
  }
  throw new Error("Unsupported command " + c);
}
async function redis(...cmd) {
  if (!HAS_DB) return memCmd(cmd);
  const r = await fetch(R_URL, { method: "POST", headers: { Authorization: `Bearer ${R_TOK}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const one = async (kind, id) => { const v = await redis("GET", `${kind}:${id}`); return v ? JSON.parse(v) : null; };
async function put(kind, o, indexes = []) {
  await redis("SET", `${kind}:${o.id}`, JSON.stringify(o));
  for (const k of indexes) await redis("SADD", k, o.id);
  return o;
}
async function many(kind, setKey) {
  const ids = await redis("SMEMBERS", setKey);
  if (!ids.length) return [];
  return (await redis("MGET", ...ids.map(i => `${kind}:${i}`))).filter(Boolean).map(x => JSON.parse(x));
}
async function rateOk(key, max, seconds) {
  const n = await redis("INCR", "rl:" + key);
  if (n === 1) await redis("EXPIRE", "rl:" + key, seconds);
  return n <= max;
}

/* ---------------- helpers ---------------- */
class Bad extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const rid = n => crypto.randomBytes(n).toString("base64url");
const nowISO = () => new Date().toISOString();
const localNow = () => new Date(Date.now() + TZ_HOURS * 3600e3);
const dayStr = (offset = 0) => new Date(localNow().getTime() + offset * 864e5).toISOString().slice(0, 10);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
const digits = p => String(p || "").replace(/\D/g, "");
function e164(p) {
  const d = digits(p);
  if (String(p).trim().startsWith("+")) return "+" + d;
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.startsWith("0")) return "+" + CC + d.slice(1);
  return "+" + (d.startsWith(CC) ? d : CC + d);
}
const clean = (s, max = 120) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b-\u001f<>]/g, " ").trim().slice(0, max);
const baseUrl = req => env.SITE_URL || `https://${req.headers.host}`;
const ip = req => (req.headers["x-forwarded-for"] || "x").split(",")[0];
const t12 = t => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
const niceDate = d => d === dayStr() ? "today" : d === dayStr(1) ? "tomorrow" : new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const money = n => `${CUR} ${Number(n).toFixed(2)}`;

/* ---------------- messages ---------------- */
const SMS_ON = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
async function sendMsg(to, body) {
  const entry = { at: nowISO(), to: e164(to), body, status: SMS_ON ? "sent" : "not sent (SMS not set up)" };
  if (SMS_ON) {
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: { Authorization: "Basic " + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ From: env.TWILIO_FROM, To: entry.to, Body: body })
      });
      if (!r.ok) entry.status = "failed (" + r.status + ")";
    } catch (e) { entry.status = "failed"; }
  }
  await redis("LPUSH", "outbox", JSON.stringify(entry));
  await redis("LTRIM", "outbox", 0, 199);
}

/* ---------------- auth ---------------- */
const hmac = s => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString("hex");
const patientToken = id => { const body = `${id}.${Date.now() + 30 * 864e5}`; return `${body}.${hmac("p:" + body)}`; };
async function requirePatient(req) {
  const [id, exp, sig] = String(req.headers["x-patient"] || "").split(".");
  if (!id || !sig || sig !== hmac(`p:${id}.${exp}`) || +exp < Date.now()) throw new Bad("Please sign in again.", 401);
  const acct = await one("acct", id);
  if (!acct) throw new Bad("Please sign in again.", 401);
  return acct;
}
const PIN = env.STAFF_PIN || (HAS_DB ? null : "0000");
const staffSig = day => crypto.createHmac("sha256", String(PIN) + SECRET).update("staff:" + day).digest("hex");
function requireStaff(req) {
  const t = req.headers["x-staff"];
  if (!PIN || !t || (t !== staffSig(dayStr()) && t !== staffSig(dayStr(-1)))) throw new Bad("Please sign in again.", 401);
}

/* ---------------- domain helpers ---------------- */
const VITALS = { bp: "Blood pressure", sugar: "Blood sugar", temp: "Temperature", weight: "Weight" };
const SERVICES = Object.fromEntries(DATA.services.map(s => [s.id, s]));
const STATUS = ["new", "assigned", "on_way", "done", "cancelled"];
function flagFor(type, a, b) {
  const L = DATA.limits[type];
  if (!L) return "";
  if (type === "bp") {
    if (a >= L.urgent[0] || b >= L.urgent[1]) return "urgent";
    if (a >= L.high[0] || b >= L.high[1] || a <= L.low[0] || b <= L.low[1]) return "review";
    return "";
  }
  if ((L.urgentHigh != null && a >= L.urgentHigh) || (L.urgentLow != null && a <= L.urgentLow)) return "urgent";
  if ((L.high != null && a >= L.high) || (L.low != null && a <= L.low)) return "review";
  return "";
}
const showReading = r => r.type === "bp" ? `${r.a}/${r.b} mmHg` : `${r.a} ${{ sugar: "mmol/L", temp: "°C", weight: "kg" }[r.type]}`;
const lrange = async (key, n) => (await redis("LRANGE", key, 0, n - 1)).map(x => JSON.parse(x));
async function bundle(acct) {
  const [vitals, requests, chat, taken] = await Promise.all([lrange("v:" + acct.id, 90), many("req", "a-req:" + acct.id), lrange("chat:" + acct.id, 60), redis("SMEMBERS", `taken:${acct.id}:${dayStr()}`)]);
  return {
    account: { id: acct.id, name: acct.name, phone: acct.phone, address: acct.address || "" },
    meds: acct.meds || [], taken, vitals, chat: chat.reverse(),
    requests: requests.sort((a, b) => b.at.localeCompare(a.at)), today: dayStr()
  };
}

/* ---------------- actions ---------------- */
const actions = {
  /* ---- patient account ---- */
  async register(req) {
    if (!(await rateOk("reg:" + ip(req), 10, 3600))) throw new Bad("Too many tries. Please try later.", 429);
    const b = req.body, name = clean(b.name, 80), phone = e164(b.phone);
    if (name.length < 2) throw new Bad("Please enter your full name.");
    if (digits(b.phone).length < 7) throw new Bad("Please enter your phone number.");
    if (!/^\d{6}$/.test(b.pin || "")) throw new Bad("Choose a 6-digit PIN.");
    if (await redis("GET", "phone:" + phone)) throw new Bad("That phone number already has an account. Sign in instead.", 409);
    const salt = rid(12), acct = { id: rid(9), name, phone, salt, pinHash: hashPin(b.pin, salt), meds: [], address: "", createdAt: nowISO() };
    await put("acct", acct); await redis("SET", "phone:" + phone, acct.id);
    return { token: patientToken(acct.id), ...(await bundle(acct)) };
  },
  async login(req) {
    const phone = e164(req.body.phone);
    if (!(await rateOk("login:" + phone, 6, 900))) throw new Bad("Too many tries. Wait 15 minutes or ask the care team to reset your PIN.", 429);
    const id = await redis("GET", "phone:" + phone), acct = id && (await one("acct", id));
    if (!acct || hashPin(req.body.pin || "", acct.salt) !== acct.pinHash) throw new Bad("That phone number and PIN do not match.", 401);
    return { token: patientToken(acct.id), ...(await bundle(acct)) };
  },
  async me(req) { return bundle(await requirePatient(req)); },

  /* ---- vitals ---- */
  async vital(req) {
    const acct = await requirePatient(req), b = req.body, type = b.type;
    if (!VITALS[type]) throw new Bad("Choose what you are recording.");
    const a = Math.round(+b.a * 10) / 10, v2 = type === "bp" ? Math.round(+b.b) : null;
    const R = { bp: [50, 280], sugar: [1, 40], temp: [30, 45], weight: [2, 400] }[type];
    if (!(a >= R[0] && a <= R[1]) || (type === "bp" && !(v2 >= 30 && v2 <= 200))) throw new Bad("That number does not look right. Please check it and try again.");
    const r = { id: rid(6), type, a, b: v2, at: nowISO(), flag: flagFor(type, a, v2) };
    await redis("LPUSH", "v:" + acct.id, JSON.stringify(r)); await redis("LTRIM", "v:" + acct.id, 0, 399);
    if (r.flag) await put("alert", { id: r.id, acct: acct.id, name: acct.name, phone: acct.phone, label: VITALS[type], reading: showReading(r), level: r.flag, at: r.at }, ["alerts:open"]);
    return { reading: r, ...(await bundle(acct)) };
  },

  /* ---- medicines ---- */
  async medadd(req) {
    const acct = await requirePatient(req), b = req.body, name = clean(b.name, 80);
    const times = [...new Set((Array.isArray(b.times) ? b.times : []).filter(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort().slice(0, 6);
    if (name.length < 2) throw new Bad("Enter the name of the medicine.");
    if (!times.length) throw new Bad("Choose at least one time of day.");
    acct.meds = acct.meds || [];
    if (acct.meds.length >= 20) throw new Bad("You can list up to 20 medicines.");
    acct.meds.push({ id: rid(5), name, dose: clean(b.dose, 80), times });
    await put("acct", acct, ["medusers"]);
    return bundle(acct);
  },
  async medremove(req) {
    const acct = await requirePatient(req);
    acct.meds = (acct.meds || []).filter(m => m.id !== req.body.id); await put("acct", acct);
    if (!acct.meds.length) await redis("SREM", "medusers", acct.id);
    return bundle(acct);
  },
  async medtake(req) {
    const acct = await requirePatient(req), key = `taken:${acct.id}:${dayStr()}`, slot = clean(req.body.slot, 20);
    if (!(acct.meds || []).some(m => m.times.some(t => `${m.id}|${t}` === slot))) throw new Bad("Medicine not found.", 404);
    await redis(req.body.on === false ? "SREM" : "SADD", key, slot); await redis("EXPIRE", key, 3 * 86400);
    return bundle(acct);
  },

  /* ---- home care requests ---- */
  async request(req) {
    const acct = await requirePatient(req), b = req.body, svc = SERVICES[b.type];
    if (!svc) throw new Bad("Choose a service.");
    const address = clean(b.address, 200);
    if (address.length < 4) throw new Bad("Please tell us where to come.");
    if (!(await rateOk("req:" + acct.id, 8, 3600))) throw new Bad("Too many requests. Please call us instead.", 429);
    acct.address = address; await put("acct", acct);
    const r = { id: rid(8), acct: acct.id, name: acct.name, phone: acct.phone, type: svc.id, label: svc.name, urgent: !!svc.urgent, address, note: clean(b.note, 400), when: clean(b.when, 60), status: "new", assignee: "", at: nowISO(), log: [{ at: nowISO(), text: "Request received" }] };
    await put("req", r, ["a-req:" + acct.id, "reqs:open"]);
    await sendMsg(acct.phone, `${HOSPITAL}: we have your ${svc.name.toLowerCase()} request. Follow it here: ${baseUrl(req)}/app.html`);
    return bundle(acct);
  },
  async requestcancel(req) {
    const acct = await requirePatient(req), r = await one("req", clean(req.body.id, 30));
    if (!r || r.acct !== acct.id) throw new Bad("Request not found.", 404);
    if (!["new", "assigned"].includes(r.status)) throw new Bad("This request is already under way. Please call us to change it.");
    r.status = "cancelled"; r.log.push({ at: nowISO(), text: "Cancelled by patient" });
    await put("req", r); await redis("SREM", "reqs:open", r.id);
    return bundle(acct);
  },

  /* ---- public: no account needed ---- */
  async pubrequest(req) {
    const b = req.body, name = clean(b.name, 80), phone = clean(b.phone, 24), appt = b.type === "appointment", svc = SERVICES[b.type];
    if (!(await rateOk("pub:" + ip(req), 10, 3600))) throw new Bad("Too many requests from this device. Please call the hospital.", 429);
    if (!appt && !svc) throw new Bad("Choose a service.");
    if (name.length < 2) throw new Bad("Please enter your full name.");
    if (digits(phone).length < 7) throw new Bad("Please enter a phone number we can call you on.");
    const dept = (DATA.departments.find(x => x.name === b.dept) || {}).name, address = clean(b.address, 200);
    if (appt && !dept) throw new Bad("Please choose a department.");
    if (!appt && address.length < 4) throw new Bad("Please tell us where to come.");
    const code = crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    const r = { id: rid(8), code, acct: null, name, phone: e164(phone), type: b.type, label: appt ? `Appointment — ${dept}` : svc.name, urgent: !appt && !!svc.urgent, address: appt ? "At the hospital" : address, note: clean(b.note, 400), when: clean(b.when, 60), status: "new", assignee: "", at: nowISO(), log: [{ at: nowISO(), text: "Request received" }] };
    await put("req", r, ["reqs:open"]); await redis("SET", "code:" + code, r.id);
    await sendMsg(r.phone, `${HOSPITAL}: we have your request (${r.label}). Reference ${code}. We will call you to confirm.`);
    return { code, label: r.label };
  },
  async pubask(req) {
    const b = req.body, name = clean(b.name, 80), phone = clean(b.phone, 24), text = clean(b.text, 600);
    if (!(await rateOk("ask:" + ip(req), 8, 3600))) throw new Bad("Too many messages from this device. Please call the hospital.", 429);
    if (name.length < 2 || digits(phone).length < 7) throw new Bad("Please enter your name and phone number.");
    if (text.length < 3) throw new Bad("Please type your question.");
    await put("inq", { id: rid(8), name, phone: e164(phone), text, at: nowISO() }, ["inq:open"]);
    return { ok: true };
  },
  async status(req) {
    if (!(await rateOk("st:" + ip(req), 30, 3600))) throw new Bad("Too many tries. Please call the hospital.", 429);
    const id = await redis("GET", "code:" + clean(req.query.code, 12).toUpperCase()), r = id && (await one("req", id));
    if (!r) throw new Bad("We could not find that reference. Check the code in your text message.", 404);
    return { label: r.label, status: r.status, when: r.when, at: r.at, assignee: r.assignee };
  },

  /* ---- nurse chat ---- */
  async say(req) {
    const acct = await requirePatient(req), text = clean(req.body.text, 600);
    if (!text) throw new Bad("Type a message first.");
    if (!(await rateOk("say:" + acct.id, 30, 3600))) throw new Bad("Too many messages. Please call us.", 429);
    await redis("LPUSH", "chat:" + acct.id, JSON.stringify({ from: "patient", text, at: nowISO() })); await redis("LTRIM", "chat:" + acct.id, 0, 199);
    await put("thread", { id: acct.id, name: acct.name, phone: acct.phone, last: text, at: nowISO() }, ["chats:unread"]);
    return bundle(acct);
  },

  /* ---- care team ---- */
  async teamlogin(req) {
    if (!(await rateOk("slogin:" + ip(req), 8, 600))) throw new Bad("Too many tries. Wait ten minutes.", 429);
    if (!PIN) throw new Bad("Set STAFF_PIN in the Vercel project settings first.", 403);
    if (String(req.body.pin || "") !== String(PIN)) throw new Bad("Wrong PIN.", 401);
    return { token: staffSig(dayStr()) };
  },
  async board(req) {
    requireStaff(req);
    const [alerts, requests, threads, outbox, inquiries] = await Promise.all([many("alert", "alerts:open"), many("req", "reqs:open"), many("thread", "chats:unread"), redis("LRANGE", "outbox", 0, 29), many("inq", "inq:open")]);
    const rank = r => (r.urgent ? 0 : 1) + "" + STATUS.indexOf(r.status) + r.at;
    return {
      alerts: alerts.sort((a, b) => (a.level === b.level ? b.at.localeCompare(a.at) : a.level === "urgent" ? -1 : 1)),
      inquiries: inquiries.sort((a, b) => a.at.localeCompare(b.at)),
      requests: requests.sort((a, b) => rank(a).localeCompare(rank(b))), threads: threads.sort((a, b) => b.at.localeCompare(a.at)),
      outbox: outbox.map(x => JSON.parse(x)), today: dayStr(),
      flags: { db: HAS_DB, sms: SMS_ON, defaultPin: !env.STAFF_PIN }
    };
  },
  async patient(req) {
    requireStaff(req);
    const id = isNaN(+digits(req.query.phone)) || !req.query.phone ? req.query.id : await redis("GET", "phone:" + e164(req.query.phone));
    const acct = id && (await one("acct", clean(id, 30)));
    if (!acct) throw new Bad("No account with that phone number.", 404);
    return bundle(acct);
  },
  async inqdone(req) {
    requireStaff(req);
    const q = await one("inq", clean(req.body.id, 30)), text = clean(req.body.reply, 400);
    if (!q) throw new Bad("Not found.", 404);
    if (text) await sendMsg(q.phone, `${HOSPITAL}: ${text}`);
    await redis("SREM", "inq:open", q.id);
    return { ok: true };
  },
  async alertdone(req) {
    requireStaff(req);
    await redis("SREM", "alerts:open", clean(req.body.id, 30));
    return { ok: true };
  },
  async requpdate(req) {
    requireStaff(req);
    const b = req.body, r = await one("req", clean(b.id, 30));
    if (!r) throw new Bad("Request not found.", 404);
    if (!STATUS.includes(b.status)) throw new Bad("Bad status.");
    const text = { assigned: `Assigned to ${clean(b.assignee, 40) || "the team"}`, on_way: "On the way to you", done: "Completed", cancelled: "Cancelled by the hospital", new: "Reopened" }[b.status];
    Object.assign(r, { status: b.status, assignee: clean(b.assignee, 40) || r.assignee }); r.log.push({ at: nowISO(), text });
    await put("req", r);
    if (["done", "cancelled"].includes(r.status)) await redis("SREM", "reqs:open", r.id);
    await sendMsg(r.phone, `${HOSPITAL}: ${r.label} — ${text.toLowerCase()}.`);
    return { ok: true };
  },
  async reply(req) {
    requireStaff(req);
    const acct = await one("acct", clean(req.body.acct, 30)), text = clean(req.body.text, 600);
    if (!acct) throw new Bad("Patient not found.", 404);
    if (!text) throw new Bad("Type a reply first.");
    await redis("LPUSH", "chat:" + acct.id, JSON.stringify({ from: "nurse", text, at: nowISO() }));
    await redis("SREM", "chats:unread", acct.id);
    await sendMsg(acct.phone, `${HOSPITAL}: a nurse has replied to you. Read it here: ${baseUrl(req)}/app.html`);
    return bundle(acct);
  },
  async pinreset(req) {
    requireStaff(req);
    const acct = await one("acct", clean(req.body.acct, 30));
    if (!acct) throw new Bad("Patient not found.", 404);
    if (!/^\d{6}$/.test(req.body.pin || "")) throw new Bad("The new PIN must be 6 digits.");
    acct.salt = rid(12); acct.pinHash = hashPin(req.body.pin, acct.salt); await put("acct", acct);
    return { ok: true };
  },
  async export(req, res) {
    requireStaff(req);
    const acct = await one("acct", clean(req.query.acct, 30));
    if (!acct) throw new Bad("Patient not found.", 404);
    const rows = await lrange("v:" + acct.id, 400);
    const csv = ["when,measure,reading,flag"].concat(rows.map(r => `"${r.at}","${VITALS[r.type]}","${showReading(r)}","${r.flag}"`)).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.statusCode = 200; res.end(csv);
    return null;
  },
  async cron(req) { // once a day: a morning list of today's medicines
    if (env.CRON_SECRET && req.headers.authorization !== "Bearer " + env.CRON_SECRET) throw new Bad("Forbidden", 403);
    let sent = 0;
    for (const acct of await many("acct", "medusers")) {
      if (!(acct.meds || []).length) continue;
      const lines = acct.meds.map(m => `${m.name} at ${m.times.map(t12).join(", ")}`).join("; ");
      await sendMsg(acct.phone, `${HOSPITAL}: good morning ${acct.name.split(" ")[0]}. Today's medicines — ${lines}. Tick them off here: ${baseUrl(req)}/app.html`);
      sent++;
    }
    return { sent };
  }
};

module.exports = async (req, res) => {
  try {
    const fn = actions[req.query.a];
    if (!fn) throw new Bad("Unknown action.", 404);
    if (typeof req.body === "string") { try { req.body = JSON.parse(req.body); } catch (e) { req.body = {}; } }
    req.body = req.body || {};
    const out = await fn(req, res);
    if (out !== null) { res.statusCode = 200; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(out)); }
  } catch (e) {
    res.statusCode = e.status || 500; res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e.status ? e.message : "Something went wrong. Please try again." }));
    if (!e.status) console.error(e);
  }
};
