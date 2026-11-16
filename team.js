/* Care team dashboard: alerts, home-care requests, messages, patient files */
(function () {
  const app = $("#app"), H = DATA.hospital;
  let tok = store.get("haven-staff"), D = null, P = null, tab = "alerts", note = "", err = "", offline = false, vType = "bp";
  $("#b-name").textContent = H.name;
  document.title = `Care team — ${H.fullName}`;

  async function load() {
    try { D = await api("board"); offline = false; store.set("haven-staff-cache", D); }
    catch (e) { if (e.status === 401) { tok = null; store.del("haven-staff"); return render(); } offline = true; D = D || store.get("haven-staff-cache"); }
    if (!D) return;
    $("#b-net").hidden = !offline;
    const el = document.activeElement;
    if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName) && app.contains(el)) return;
    render();
  }

  function reqRow(r) {
    return `<div class="row"><div style="flex:1;min-width:0"><b>${r.urgent ? `<span class="tagx urgent">Urgent</span> ` : ""}${esc(r.label)} · ${esc(r.name)} <span class="tagx steel">${STEP_LABEL[r.status]}</span>${r.code ? ` <span class="tagx">Ref ${esc(r.code)}</span>` : ""}</b>
        <small>${esc(r.address)}${r.when ? " · wants: " + esc(r.when) : ""} · ${when(r.at)} · <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>${r.note ? `<br>“${esc(r.note)}”` : ""}</small></div>
      <div class="acts"><label for="as-${r.id}" style="position:absolute;left:-9999px">Assign to</label><input id="as-${r.id}" value="${esc(r.assignee)}" placeholder="Who is going?" style="height:40px;border-radius:999px;border:0;background:var(--bg);padding:0 14px;font:400 14px Outfit,sans-serif;width:150px">
        <button class="pill ghost" data-req="${r.id}" data-status="assigned">Assign</button><button class="pill ghost" data-req="${r.id}" data-status="on_way">On the way</button><button class="pill dark" data-req="${r.id}" data-status="done">Done</button><button class="pill ghost" data-req="${r.id}" data-status="cancelled">Cancel</button></div></div>`;
  }

  function patientHTML() {
    const a = P.account;
    return `<section class="box wide"><div class="box-head"><div><h2>${esc(a.name)}</h2><p class="muted">${esc(a.phone)}${a.address ? " · " + esc(a.address) : ""}</p></div><div class="seg"><a class="pill dark" href="tel:${esc(a.phone)}">${svgIcon("phone")}Call</a><button class="pill ghost" data-export="${a.id}">Download readings</button></div></div>
        <div class="stat">${Object.keys(VITALS).map(t => { const v = P.vitals.find(x => x.type === t); return `<div><small>${VITALS[t][0]}</small><b>${v ? reading(v) : "–"}</b><small>${v ? when(v.at) : "Not recorded"}</small>${v && v.flag ? `<span class="tagx ${v.flag}">${v.flag === "urgent" ? "Urgent" : "Review"}</span>` : ""}</div>`; }).join("")}</div></section>
      <section class="box"><div class="box-head"><h2>Trend</h2><div class="seg">${Object.keys(VITALS).map(t => `<button data-vtype="${t}" aria-pressed="${vType === t}">${VITALS[t][0]}</button>`).join("")}</div></div>${chartSVG(P.vitals, vType)}</section>
      <section class="box"><h2>Medicines</h2>${P.meds.length ? P.meds.map(m => `<div class="row keep"><div><b>${esc(m.name)}</b><small>${m.dose ? esc(m.dose) + " · " : ""}${m.times.map(t12).join(", ")}</small></div><span class="tagx ${m.times.every(t => P.taken.includes(m.id + "|" + t)) ? "ok" : ""}">${m.times.filter(t => P.taken.includes(m.id + "|" + t)).length}/${m.times.length} today</span></div>`).join("") : `<p class="empty">None listed by the patient.</p>`}</section>
      <section class="box wide"><h2>Messages</h2><div class="chat" id="chat">${P.chat.length ? P.chat.map(c => `<div class="bub ${c.from === "nurse" ? "me" : ""}">${esc(c.text)}<small>${c.from === "nurse" ? "Nurse" : "Patient"} · ${when(c.at)}</small></div>`).join("") : `<p class="empty">No messages.</p>`}</div>
        <form class="send" id="reply"><label for="rp" style="position:absolute;left:-9999px">Reply</label><input id="rp" placeholder="Reply to ${esc(a.name.split(" ")[0])}" autocomplete="off" required><button class="ico lg dark" aria-label="Send reply">${svgIcon("arrow")}</button></form></section>
      <section class="box wide"><h2>Requests</h2>${P.requests.length ? P.requests.map(r => `<div class="row keep"><div><b>${esc(r.label)}</b><small>${when(r.at)} · ${esc(r.address)}</small></div><span class="tagx steel">${STEP_LABEL[r.status]}</span></div>`).join("") : `<p class="empty">None.</p>`}</section>
      <section class="box wide"><h2>Reset the patient's PIN</h2><form class="inline" id="pinr"><div class="field"><label for="np">New 6-digit PIN</label><input id="np" inputmode="numeric" maxlength="6" required></div><button class="pill dark" style="min-height:52px">Reset PIN</button></form></section>`;
  }

  function render() {
    $("#b-out").hidden = !tok;
    if (!tok) { app.innerHTML = `<div class="auth"><p class="sec-label">care team<sup>[staff]</sup></p><h1>Team sign-in.</h1><form class="form" id="slogin"><div class="field"><label for="pin">Staff PIN</label><input id="pin" type="password" inputmode="numeric" autocomplete="current-password" required></div>${err ? `<p class="note err" role="alert">${esc(err)}</p>` : ""}<button class="go solid" style="align-self:flex-start">Sign in <span class="ico">${svgIcon("arrow")}</span></button></form></div>`; return; }
    if (!D) { app.innerHTML = `<p class="muted">Loading…</p>`; return; }
    const f = D.flags, urgent = D.alerts.filter(a => a.level === "urgent").length;
    const TABS = [["alerts", "Reading alerts", "pulse", D.alerts.length], ["reqs", "Requests", "home", D.requests.length], ["msgs", "Messages", "chat", D.threads.length + D.inquiries.length], ["patients", "Patients", "user", 0], ["sent", "Texts sent", "phone", 0]];
    let h = `<section class="greet"><i class="dash" aria-hidden="true"></i><i class="cloud" style="--w:84px" aria-hidden="true"></i><p>Care team</p><h1>${urgent ? `${urgent} urgent reading${urgent > 1 ? "s" : ""} to check.` : D.alerts.length + D.requests.length + D.threads.length + D.inquiries.length ? "Here is what needs you." : "All clear right now."}</h1></section>`;
    if (!f.db) h += `<p class="note warn" style="margin-top:12px">Demo mode: no database is connected, so nothing is saved. Add “Upstash for Redis” to this Vercel project to go live.</p>`;
    if (f.db && f.defaultPin) h += `<p class="note warn" style="margin-top:12px">Set STAFF_PIN in the Vercel project settings.</p>`;
    if (!f.sms) h += `<p class="note warn" style="margin-top:8px">Text messages are not being sent yet (no SMS account connected). See “Texts sent” for what would go out.</p>`;
    if (note) h += `<p class="note ok" role="status" style="margin-top:8px">${esc(note)}</p>`;
    if (err) h += `<p class="note err" role="alert" style="margin-top:8px">${esc(err)}</p>`;
    h += `<div class="tabs" role="tablist">${TABS.map(([k, l, ic, n]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${svgIcon(ic)}${l}${n ? `<span class="n">${n}</span>` : ""}</button>`).join("")}</div><div class="grid">`;

    if (tab === "alerts") h += `<section class="box wide"><h2>Readings outside the set range</h2>${D.alerts.length ? D.alerts.map(a => `<div class="row"><div><b><span class="tagx ${a.level}">${a.level === "urgent" ? "Urgent" : "Review"}</span> ${esc(a.name)} · ${esc(a.label)} ${esc(a.reading)}</b><small>${when(a.at)} · <a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></small></div>
        <div class="acts"><a class="pill dark" href="tel:${esc(a.phone)}">${svgIcon("phone")}Call</a><button class="pill ghost" data-open="${a.acct}">Patient file</button><button class="pill ghost" data-alert="${a.id}">Reviewed</button></div></div>`).join("") : `<p class="empty">No readings need review.</p>`}</section>`;
    if (tab === "reqs") h += `<section class="box wide"><h2>Appointments and home-care requests</h2>${D.requests.length ? D.requests.map(reqRow).join("") : `<p class="empty">No open requests.</p>`}</section>`;
    if (tab === "msgs") h += `<section class="box wide"><h2>Questions from the website</h2>${D.inquiries.length ? D.inquiries.map(q => `<div class="row"><div style="flex:1;min-width:0"><b>${esc(q.name)} · <a href="tel:${esc(q.phone)}">${esc(q.phone)}</a></b><small>“${esc(q.text)}” · ${when(q.at)}</small></div>
        <form class="acts" data-inq="${q.id}"><label for="iq-${q.id}" style="position:absolute;left:-9999px">Reply by text</label><input id="iq-${q.id}" placeholder="Reply by text message" style="height:44px;border-radius:999px;border:0;background:var(--bg);padding:0 16px;font:400 15px Outfit,sans-serif;width:230px"><button class="pill dark">Send and close</button><a class="pill ghost" href="tel:${esc(q.phone)}">Call</a></form></div>`).join("") : `<p class="empty">No open questions.</p>`}</section>` + `<section class="box wide"><h2>Waiting for a reply</h2>${D.threads.length ? D.threads.map(t => `<div class="row"><div><b>${esc(t.name)}</b><small>“${esc(t.last)}” · ${when(t.at)}</small></div><div class="acts"><button class="pill dark" data-open="${t.id}">Open and reply</button></div></div>`).join("") : `<p class="empty">No unanswered messages.</p>`}</section>`;
    if (tab === "patients") h += `<section class="box wide"><form class="inline" id="find"><div class="field"><label for="pp">Find a patient by phone number</label><input id="pp" type="tel" value="${esc(P ? P.account.phone : "")}" required></div><button class="pill dark" style="min-height:52px">Open file</button></form></section>${P ? patientHTML() : ""}`;
    if (tab === "sent") h += `<section class="box wide"><h2>Texts sent</h2>${D.outbox.length ? D.outbox.map(m => `<div class="row"><div><b>${esc(m.to)}</b><small>${esc(m.body)}</small></div><span class="tagx">${esc(m.status)}</span></div>`).join("") : `<p class="empty">No messages yet.</p>`}</section>`;
    app.innerHTML = h + `</div>`; note = ""; err = "";
    const c = $("#chat"); if (c) c.scrollTop = c.scrollHeight;
  }

  async function act(fn, ok) {
    try { const r = await fn(); if (r && r.account) P = r; note = ok || ""; } catch (e) { err = e.message; }
    if (document.activeElement) document.activeElement.blur();
    await load();
  }
  const openPatient = q => act(async () => { P = await api("patient", null, q); tab = "patients"; });

  $("#b-out").addEventListener("click", () => { tok = null; store.del("haven-staff"); store.del("haven-staff-cache"); D = P = null; render(); });
  app.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const d = b.dataset;
    if (d.tab) { tab = d.tab; return render(); }
    if (d.vtype) { vType = d.vtype; return render(); }
    if (d.open) return openPatient("&id=" + encodeURIComponent(d.open));
    if (d.alert) return act(() => api("alertdone", { id: d.alert }), "Marked as reviewed.");
    if (d.req) return act(() => api("requpdate", { id: d.req, status: d.status, assignee: ($("#as-" + d.req) || {}).value }), "Updated. The patient has been told.");
    if (d.export) return act(async () => {
      const r = await fetch(`/api/app?a=export&acct=${d.export}`, { headers: { "x-staff": tok } });
      if (!r.ok) throw new Error("Download failed.");
      const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = "readings.csv"; a.click();
    });
  });
  app.addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target, v = id => $("#" + id).value.trim();
    if (f.id === "slogin") return api("teamlogin", { pin: v("pin") }).then(r => { tok = r.token; store.set("haven-staff", tok); load(); }, x => { err = x.message; render(); });
    if (f.dataset.inq) return act(() => api("inqdone", { id: f.dataset.inq, reply: f.querySelector("input").value }), "Closed.");
    if (f.id === "find") return openPatient("&phone=" + encodeURIComponent(v("pp")));
    if (f.id === "reply") return act(() => api("reply", { acct: P.account.id, text: v("rp") }), "Reply sent.");
    if (f.id === "pinr") return act(() => api("pinreset", { acct: P.account.id, pin: v("np") }), "PIN reset. Tell the patient their new PIN.");
  });

  setInterval(() => { if (tok) load(); }, 20000);
  if (tok) load(); else render();
})();
