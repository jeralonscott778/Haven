/* Care team dashboard: alerts, home-care requests, messages, patient files */
(function () {
  const app = $("#app"), H = DATA.hospital;
  let tok = store.get("haven-staff"), D = null, P = null, tab = "book", note = "", err = "", offline = false, vType = "bp";
  $("#b-name").textContent = H.name;
  document.title = `Care team — ${H.fullName}`;

  /* ---------- live appointment schedule ---------- */
  let SC = null, bdate = "", bdept = "All", sel = null, pick = null, lastSeen = new Date().toISOString(), flash = new Set();
  const SLAB = { confirmed: "Booked", checked_in: "Checked in", seen: "Seen", no_show: "No-show", cancelled: "Cancelled" };
  const docOf = id => (DATA.doctors.find(d => d.id === id) || { name: "—" });
  const dlabel = (iso, today) => { const n = Math.round((new Date(iso + "T12:00:00Z") - new Date(today + "T12:00:00Z")) / 864e5); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }); };
  const shift = (iso, n) => new Date(new Date(iso + "T12:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);
  async function loadSched() {
    try {
      SC = await api("schedule", null, bdate ? "&date=" + bdate : ""); bdate = SC.date;
      const fresh = SC.recent.filter(r => r.at > lastSeen && r.source === "web");
      if (fresh.length) { note = "New booking: " + fresh.map(r => `${r.name} · ${dlabel(r.date, SC.today)} ${t12(r.time)} with ${docOf(r.doctorId).name}`).join("   ·   "); fresh.forEach(r => flash.add(r.id)); lastSeen = fresh[0].at; }
    } catch (e) { if (e.status === 401) throw e; }
  }
  function schedHTML() {
    const S = SC, A = S.appts, docs = S.doctors.filter(d => (bdept === "All" || d.dept === bdept) && d.times.length);
    const times = [...new Set(docs.flatMap(d => d.times))].sort(), byKey = {};
    A.filter(a => a.status !== "cancelled").forEach(a => (byKey[a.doctorId + "|" + a.time] = a));
    const live = A.filter(a => a.status !== "cancelled"), n = s => A.filter(a => a.status === s).length;
    const freeLeft = S.date < S.today ? 0 : docs.reduce((t, d) => t + (d.away ? 0 : d.times.filter(x => !byKey[d.id + "|" + x] && (S.date !== S.today || x >= S.now)).length), 0);
    let h = `<section class="box wide">
      <div class="sch-top">
        <div class="seg"><button data-bday="-1" aria-label="Previous day">‹</button><button data-bday="0" aria-pressed="${S.date === S.today}">Today</button><button data-bday="1" aria-label="Next day">›</button></div>
        <h2>${dlabel(S.date, S.today)} <span class="muted" style="font-size:16px">${new Date(S.date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</span></h2>
        <div class="sch-ctl"><label for="bd" style="position:absolute;left:-9999px">Pick a day</label><input type="date" id="bd" value="${S.date}" class="sch-in"><label for="bdept" style="position:absolute;left:-9999px">Department</label><select id="bdept" class="sch-in"><option>All</option>${DATA.departments.map(d => `<option ${bdept === d.name ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></div>
      </div>
      <div class="kpis">${[["Booked", live.length, ""], ["Checked in", n("checked_in"), "ci"], ["Seen", n("seen"), "se"], ["No-show", n("no_show"), "ns"], ["Free slots left", freeLeft, "fr"]].map(([l, v, c]) => `<div class="kpi ${c}"><b>${v}</b><small>${l}</small></div>`).join("")}</div>
      <div class="week">${S.week.map(w => `<button data-bdate="${w.date}" aria-pressed="${w.date === S.date}"><small>${dlabel(w.date, S.today)}</small><b>${w.count}</b><small>booked</small></button>`).join("")}</div>
    </section>`;
    h += `<section class="box wide sch-box"><div class="box-head"><h2>Schedule</h2><p class="legend2"><i class="s-confirmed"></i>Booked <i class="s-checked_in"></i>Checked in <i class="s-seen"></i>Seen <i class="s-no_show"></i>No-show <i class="s-free"></i>Free — tap to book</p></div>`;
    h += docs.length ? `<div class="sched-wrap"><table class="sched"><thead><tr><th scope="col">Time</th>${docs.map(d => `<th scope="col">${esc(d.name)}<small>${esc(d.dept)}${d.away ? " · away" : ""}</small></th>`).join("")}</tr></thead><tbody>${times.map(tm => `<tr><th scope="row">${t12(tm)}</th>${docs.map(d => {
        if (!d.times.includes(tm)) return `<td class="off"></td>`;
        const a = byKey[d.id + "|" + tm];
        if (a) return `<td><button class="cell s-${a.status} ${flash.has(a.id) ? "new" : ""} ${sel === a.id ? "sel" : ""}" data-appt="${a.id}"><b>${esc(a.name)}</b><small>${SLAB[a.status]}${a.source === "web" ? " · online" : ""}</small></button></td>`;
        if (d.away || (S.date < S.today) || (S.date === S.today && tm < S.now)) return `<td class="off past"></td>`;
        return `<td><button class="cell s-free ${pick === d.id + "|" + tm ? "sel" : ""}" data-free="${d.id}|${tm}" aria-label="Book ${esc(d.name)} at ${t12(tm)}">+</button></td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="empty">No doctors work on this day.</p>`;
    h += `</section>`;
    const a = sel && A.find(x => x.id === sel);
    if (a) {
      const d = docOf(a.doctorId), acts = { confirmed: [["checked_in", "Check in", "dark"], ["no_show", "No-show", "ghost"], ["cancelled", "Cancel", "ghost"]], checked_in: [["seen", "Mark as seen", "dark"], ["confirmed", "Undo check-in", "ghost"]], seen: [], no_show: [["confirmed", "Reopen", "ghost"]], cancelled: [] }[a.status];
      h += `<section class="box wide sch-detail"><div class="box-head"><div><h2>${esc(a.name)}</h2><p class="muted">${t12(a.time)} with ${esc(d.name)} · ${esc(a.dept)} · code <b>${esc(a.code)}</b> · ${a.source === "web" ? "booked online" : "booked at the desk"}</p></div><span class="tagx steel">${SLAB[a.status]}</span></div>
        <div class="stat"><div><small>Phone</small><b style="font-size:18px"><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></b></div><div><small>NHIS</small><b style="font-size:18px">${esc(a.nhis || "—")}</b></div><div><small>Booked by</small><b style="font-size:18px">${esc(a.bookedBy || "Patient")}</b></div><div><small>Reason</small><b style="font-size:16px">${esc(a.note || "—")}</b></div></div>
        <div class="seg">${acts.map(([s, l, c]) => `<button class="pill ${c}" data-bset="${s}" data-id="${a.id}">${l}</button>`).join("")}<a class="pill ghost" href="tel:${esc(a.phone)}">${svgIcon("phone")}Call</a><button class="pill ghost" data-close>Close</button></div>
        <p class="small muted">${a.log.map(l => `${esc(l.text)} · ${when(l.at)}`).join("<br>")}</p></section>`;
    }
    if (pick) {
      const [docId, tm] = pick.split("|"), d = docOf(docId);
      h += `<section class="box wide sch-detail"><div class="box-head"><h2>Book ${t12(tm)} with ${esc(d.name)}</h2><button class="pill ghost" data-close>Close</button></div>
        <form class="form" id="deskbook"><div class="row2"><div class="field"><label for="db-name">Patient's full name</label><input id="db-name" required></div><div class="field"><label for="db-phone">Phone number</label><input id="db-phone" type="tel" required></div></div>
        <div class="row2"><div class="field"><label for="db-nhis">NHIS number</label><input id="db-nhis"></div><div class="field"><label for="db-note">Reason</label><input id="db-note"></div></div>
        <button class="go solid" style="align-self:flex-start">Book this slot <span class="ico">${svgIcon("check")}</span></button></form></section>`;
    }
    h += `<section class="box"><h2>Latest online bookings</h2>${S.recent.length ? S.recent.slice(0, 8).map(r => `<div class="row keep"><div><b>${esc(r.name)}</b><small>${dlabel(r.date, S.today)}, ${t12(r.time)} · ${esc(docOf(r.doctorId).name)} · ${esc(r.dept)}</small></div><span class="tagx ${r.source === "web" ? "steel" : ""}">${r.source === "web" ? "Online" : "Desk"}</span></div>`).join("") : `<p class="empty">No bookings yet.</p>`}</section>
      <section class="box"><h2>Doctor away on this day</h2><div class="checkrow" style="flex-direction:column;align-items:flex-start">${S.doctors.filter(d => d.times.length).map(d => `<label><input type="checkbox" data-away="${d.id}" ${d.away ? "checked" : ""}> ${esc(d.name)} — stop online bookings</label>`).join("") || `<p class="empty">No doctors scheduled.</p>`}</div></section>`;
    return h;
  }

  async function load() {
    try { await loadSched(); } catch (e) { tok = null; store.del("haven-staff"); return render(); }
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
    const TABS = [["book", "Appointments", "clock", SC ? SC.appts.filter(a => a.status === "confirmed" && a.date === SC.today).length : 0], ["alerts", "Reading alerts", "pulse", D.alerts.length], ["reqs", "Requests", "home", D.requests.length], ["msgs", "Messages", "chat", D.threads.length + D.inquiries.length], ["patients", "Patients", "user", 0], ["sent", "Texts sent", "phone", 0]];
    let h = `<section class="greet"><i class="dash" aria-hidden="true"></i><i class="cloud" style="--w:84px" aria-hidden="true"></i><p>Care team</p><h1>${tab === "book" && SC ? (() => { const n = SC.appts.filter(a => a.date === SC.today && a.status !== "cancelled").length, w = SC.appts.filter(a => a.status === "checked_in").length; return SC.date !== SC.today ? "Appointment schedule." : `${n} appointment${n === 1 ? "" : "s"} today${w ? `, ${w} waiting` : ""}.`; })() : urgent ? `${urgent} urgent reading${urgent > 1 ? "s" : ""} to check.` : D.alerts.length + D.requests.length + D.threads.length + D.inquiries.length ? "Here is what needs you." : "All clear right now."}</h1></section>`;
    if (!f.db) h += `<p class="note warn" style="margin-top:12px">Demo mode: no database is connected, so nothing is saved. Add “Upstash for Redis” to this Vercel project to go live.</p>`;
    if (f.db && f.defaultPin) h += `<p class="note warn" style="margin-top:12px">Set STAFF_PIN in the Vercel project settings.</p>`;
    if (!f.sms) h += `<p class="note warn" style="margin-top:8px">Text messages are not being sent yet (no SMS account connected). See “Texts sent” for what would go out.</p>`;
    if (note) h += `<p class="note ok" role="status" style="margin-top:8px">${esc(note)}</p>`;
    if (err) h += `<p class="note err" role="alert" style="margin-top:8px">${esc(err)}</p>`;
    h += `<div class="tabs" role="tablist">${TABS.map(([k, l, ic, n]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${svgIcon(ic)}${l}${n ? `<span class="n">${n}</span>` : ""}</button>`).join("")}</div><div class="grid">`;

    if (tab === "book" && SC) h += schedHTML();
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
    if (d.bday != null) { bdate = d.bday === "0" ? "" : shift(bdate, +d.bday); sel = pick = null; return load(); }
    if (d.bdate) { bdate = d.bdate; sel = pick = null; return load(); }
    if (d.appt) { sel = d.appt; pick = null; flash.delete(d.appt); render(); return $(".sch-detail") && $(".sch-detail").scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    if (d.free) { pick = d.free; sel = null; render(); const f = $("#db-name"); if (f) { f.focus({ preventScroll: true }); $(".sch-detail").scrollIntoView({ behavior: "smooth", block: "nearest" }); } return; }
    if ("close" in d) { sel = pick = null; return render(); }
    if (d.bset) return act(() => api("apptset", { id: d.id, status: d.bset }), { checked_in: "Checked in.", seen: "Marked as seen.", no_show: "Marked as no-show.", cancelled: "Cancelled. The patient has been told.", confirmed: "Updated." }[d.bset]);
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
    if (f.id === "deskbook") { const [docId, tm] = pick.split("|"); return act(async () => { const r = await api("deskbook", { doctorId: docId, date: bdate, time: tm, name: v("db-name"), phone: v("db-phone"), nhis: v("db-nhis"), note: v("db-note") }); pick = null; sel = r.appt.id; }, "Booked. A confirmation text has gone to the patient."); }
    if (f.id === "slogin") return api("teamlogin", { pin: v("pin") }).then(r => { tok = r.token; store.set("haven-staff", tok); load(); }, x => { err = x.message; render(); });
    if (f.dataset.inq) return act(() => api("inqdone", { id: f.dataset.inq, reply: f.querySelector("input").value }), "Closed.");
    if (f.id === "find") return openPatient("&phone=" + encodeURIComponent(v("pp")));
    if (f.id === "reply") return act(() => api("reply", { acct: P.account.id, text: v("rp") }), "Reply sent.");
    if (f.id === "pinr") return act(() => api("pinreset", { acct: P.account.id, pin: v("np") }), "PIN reset. Tell the patient their new PIN.");
  });

  app.addEventListener("change", e => {
    const el = e.target;
    if (el.id === "bd" && el.value) { bdate = el.value; sel = pick = null; el.blur(); return load(); }
    if (el.id === "bdept") { bdept = el.value; el.blur(); return render(); }
    if (el.dataset.away) return act(() => api("block", { doctorId: el.dataset.away, date: bdate, on: el.checked }), el.checked ? "Online bookings stopped for that doctor on this day." : "Bookings reopened.");
  });
  setInterval(() => { if (tok) load(); }, 15000);
  if (tok) load(); else render();
})();
