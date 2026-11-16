/* Shared by every page */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del: k => { try { localStorage.removeItem(k); } catch (e) {} }
};
const session = { get token() { return store.get("haven-patient"); }, set token(v) { v ? store.set("haven-patient", v) : store.del("haven-patient"); } };

async function api(action, body, qs = "") {
  const r = await fetch(`/api/app?a=${action}${qs}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "x-patient": session.token || "", "x-staff": store.get("haven-staff") || "" },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || "Something went wrong. Please try again."), { status: r.status });
  return j;
}

const t12 = t => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
const when = iso => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const VITALS = { bp: ["Blood pressure", "mmHg"], sugar: ["Blood sugar", "mmol/L"], temp: ["Temperature", "°C"], weight: ["Weight", "kg"] };
const reading = r => (r.type === "bp" ? `${r.a}/${r.b}` : `${r.a}`);
const FLAG = { urgent: "Nurse alerted", review: "For review" };
const STEPS = ["new", "assigned", "on_way", "done"];
const STEP_LABEL = { new: "Received", assigned: "Assigned", on_way: "On the way", done: "Completed", cancelled: "Cancelled" };
const svgIcon = (id, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

/* one icon sprite for every page */
document.body.insertAdjacentHTML("afterbegin", `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
${Object.entries({
  arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>', back: '<path d="M20 12H4M10 6l-6 6 6 6"/>', up: '<path d="M12 20V6M6 12l6-6 6 6M5 3h14"/>', out: '<path d="M7 17 17 7M8 7h9v9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>', heart: '<path d="M12 20s-7-4.500-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.500-7 10-7 10z"/>',
  pill: '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="m8.500 8.500 7 7"/>', home: '<path d="M4 11 12 4l8 7v9H4zM10 20v-6h4v6"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  phone: '<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', pin: '<path d="M12 21s-6-5.500-6-10.500a6 6 0 0 1 12 0C18 15.500 12 21 12 21z"/><circle cx="12" cy="10.500" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', check: '<path d="m5 12 5 5 9-10"/>', drop: '<path d="M12 3s6 6.500 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z"/>', temp: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>',
  users: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20a6.500 6.500 0 0 1 13 0M17 14.500a5 5 0 0 1 4.500 5"/><circle cx="17.500" cy="9.500" r="2.500"/>', flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.500 15h9"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>', siren: '<path d="M7 18v-6a5 5 0 0 1 10 0v6M5 18h14v3H5zM12 3v2M4 6l1.500 1.500M20 6l-1.500 1.500"/>',
  live: '<circle cx="12" cy="12" r="2"/><path d="M7.500 7.500a6.500 6.500 0 0 0 0 9M16.500 7.500a6.500 6.500 0 0 1 0 9"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>', cloud: '<path d="M7 18a4 4 0 0 1-.500-8A5.500 5.500 0 0 1 17 9.500 4.300 4.300 0 0 1 17.500 18z"/>', down: '<path d="M12 4v12M6 11l6 6 6-6M5 21h14"/>'
}).map(([k, d]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.600" stroke-linecap="round" stroke-linejoin="round">${d}</symbol>`).join("")}
</defs></svg>`);

/* sign-in / create-account form */
function authHTML(mode, err) {
  const reg = mode === "register";
  return `<form class="form" id="auth-form" data-mode="${mode}">
      <div class="seg" role="group" aria-label="Account"><button type="button" data-auth="login" aria-pressed="${!reg}">Sign in</button><button type="button" data-auth="register" aria-pressed="${reg}">Create account</button></div>
      ${reg ? `<div class="field"><label for="au-name">Full name</label><input id="au-name" autocomplete="name" required></div>` : ""}
      <div class="field"><label for="au-phone">Phone number</label><input id="au-phone" type="tel" inputmode="tel" autocomplete="tel" required></div>
      <div class="field"><label for="au-pin">${reg ? "Choose a 6-digit PIN" : "PIN"}</label><input id="au-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="${reg ? "new-password" : "current-password"}" required></div>
      ${err ? `<p class="note err" role="alert">${esc(err)}</p>` : ""}
      <button class="go solid" style="align-self:flex-start">${reg ? "Create account" : "Sign in"} <span class="ico">${svgIcon("arrow")}</span></button>
      ${reg ? "" : `<p class="small muted">Forgot your PIN? The care team can reset it for you.</p>`}
    </form>`;
}
async function authSubmit(form) {
  const reg = form.dataset.mode === "register";
  const r = await api(reg ? "register" : "login", { name: reg ? $("#au-name").value : undefined, phone: $("#au-phone").value, pin: $("#au-pin").value });
  session.token = r.token;
  return r;
}

/* small line chart for readings (oldest on the left) */
function chartSVG(rows, type) {
  const pts = rows.filter(r => r.type === type).slice(0, 30).reverse();
  if (pts.length < 2) return `<p class="empty">Add two or more readings to see the trend.</p>`;
  const W = 640, H = 190, L = 40, R = 14, T = 16, B = 28;
  const vals = pts.flatMap(p => (type === "bp" ? [p.a, p.b] : [p.a])), lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo || 1) * 0.15;
  const y = v => T + (H - T - B) * (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)), x = i => L + ((W - L - R) * i) / (pts.length - 1);
  const line = (k, col) => `<polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ")}"/>` +
    pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[k]).toFixed(1)}" r="4" fill="${p.flag === "urgent" ? "#D2462F" : p.flag ? "#B97A00" : "#fff"}" stroke="${col}" stroke-width="2"/>`).join("");
  const day = p => new Date(p.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${VITALS[type][0]} trend, ${pts.length} readings from ${day(pts[0])} to ${day(pts[pts.length - 1])}">
    ${[hi, lo].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#E2E4E6" stroke-dasharray="4 5"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="#868D93">${v}</text>`).join("")}
    ${type === "bp" ? line("b", "#3FA677") : ""}${line("a", "#0E5F3E")}
    <text x="${L}" y="${H - 6}" font-size="12" fill="#868D93">${day(pts[0])}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="12" fill="#868D93">${day(pts[pts.length - 1])}</text>
  </svg>${type === "bp" ? `<p class="small muted">Dark line: top number · Light line: bottom number</p>` : ""}`;
}
