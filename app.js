/* Patient app: today, readings, medicines, care at home, nurse chat */
(function () {
  const app = $("#app"), H = DATA.hospital;
  const TABS = [["today", "Today", "clock"], ["vitals", "Readings", "pulse"], ["meds", "Medicines", "pill"], ["home", "Care at home", "home"], ["nurse", "Nurse", "chat"]];
  const SVC_ICON = { home_visit: "home", lab: "flask", delivery: "truck", ambulance: "siren" };
  const SLOTS = [["08:00", "Morning"], ["13:00", "Midday"], ["18:00", "Evening"], ["21:00", "Night"]];
  let me = null, tab = (location.hash || "").slice(1), authMode = "login", msg = "", err = "", vType = "bp", svc = null, lastFlag = null;
  if (!TABS.some(t => t[0] === tab)) tab = "today";
  $("#b-name").textContent = H.name;
  document.title = `My care — ${H.fullName}`;
  if (H.phone) { $("#b-call").href = "tel:" + H.phone.replace(/[^\d+]/g, ""); }

  const latest = type => me.vitals.find(v => v.type === type);
  const flagTag = f => (f ? `<span class="tagx ${f}">${FLAG[f]}</span>` : "");
  const hello = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

  function medRows() {
    const rows = me.meds.flatMap(m => m.times.map(t => ({ m, t, slot: `${m.id}|${t}` }))).sort((a, b) => a.t.localeCompare(b.t));
    return rows.length ? rows.map(r => `<div class="row keep"><div><b>${esc(r.m.name)}</b><small>${t12(r.t)}${r.m.dose ? " · " + esc(r.m.dose) : ""}</small></div>
      <button class="tick" data-take="${esc(r.slot)}" aria-pressed="${me.taken.includes(r.slot)}" aria-label="${esc(r.m.name)} at ${t12(r.t)} taken">${svgIcon("check")}</button></div>`).join("")
      : `<p class="empty">No medicines listed yet. Add them under Medicines and we will remind you each morning.</p>`;
  }
  function reqRow(r) {
    const step = STEPS.indexOf(r.status), open = ["new", "assigned"].includes(r.status);
    return `<div class="row"><div style="flex:1;min-width:0;width:100%"><b>${esc(r.label)} ${r.status === "cancelled" ? `<span class="tagx">Cancelled</span>` : `<span class="tagx steel">${STEP_LABEL[r.status]}</span>`}</b>
        <small>${esc(r.address)}${r.when ? " · " + esc(r.when) : ""} · ${when(r.at)}${r.assignee ? " · " + esc(r.assignee) : ""}</small>
        ${r.status === "cancelled" ? "" : `<div class="track" aria-hidden="true">${STEPS.map((_, i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>`}</div>
      ${open ? `<div class="acts"><button class="pill ghost" data-cancel="${r.id}">Cancel</button></div>` : ""}</div>`;
  }
  const chatHTML = rows => rows.length ? rows.map(c => `<div class="bub ${c.from === "patient" ? "me" : ""}">${esc(c.text)}<small>${c.from === "nurse" ? "Nurse · " : ""}${when(c.at)}</small></div>`).join("") : `<p class="empty">No messages yet. Ask the care team anything about your medicines, readings or recovery.</p>`;

  function render() {
    $("#b-out").hidden = !me; $("#b-call").hidden = !(me && H.phone);
    if (!me) { app.innerHTML = `<div class="auth"><p class="sec-label">my care<sup>[${authMode === "register" ? "new" : "in"}]</sup></p><h1>${authMode === "register" ? "Create your account." : "Welcome back."}</h1>${authHTML(authMode, err)}</div>`; return; }
    const active = me.requests.filter(r => !["done", "cancelled"].includes(r.status));
    let h = `<section class="greet"><i class="dash" aria-hidden="true"></i><i class="cloud" style="--w:84px" aria-hidden="true"></i><p>${hello()}</p><h1>${esc(me.account.name.split(" ")[0])}, here is your care.</h1></section>
      <div class="tabs" role="tablist">${TABS.map(([k, l, ic]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${tab === k}">${svgIcon(ic)}${l}</button>`).join("")}</div>`;
    if (msg) h += `<p class="note ok" role="status">${esc(msg)}</p>`;
    if (err) h += `<p class="note err" role="alert">${esc(err)}</p>`;
    h += `<div class="grid">`;

    if (tab === "today") {
      h += `<section class="box"><div class="box-head"><h2>Today's medicines</h2><span class="tagx steel">${me.taken.length} taken</span></div>${medRows()}</section>
        <section class="box steel"><div class="box-head"><h2>Latest readings</h2><button class="pill" data-tab="vitals">Add ${svgIcon("plus")}</button></div>
          <div class="stat">${Object.keys(VITALS).map(t => { const v = latest(t); return `<div style="background:#fff"><small>${VITALS[t][0]}</small><b>${v ? reading(v) : "–"}</b><small>${v ? VITALS[t][1] + " · " + when(v.at) : "Not recorded"}</small>${v ? flagTag(v.flag) : ""}</div>`; }).join("")}</div></section>
        <section class="box"><div class="box-head"><h2>Care at home</h2><button class="pill" data-tab="home">Request ${svgIcon("plus")}</button></div>${active.length ? active.map(reqRow).join("") : `<p class="empty">Nothing on the way. Ask for a nurse visit, lab sample or delivery.</p>`}</section>
        <section class="box"><div class="box-head"><h2>Nurse</h2><button class="pill" data-tab="nurse">Open ${svgIcon("chat")}</button></div><div class="chat">${chatHTML(me.chat.slice(-2))}</div></section>`;
    }
    if (tab === "vitals") {
      const two = vType === "bp";
      h += `<section class="box"><h2>Add a reading</h2>
          <div class="seg" role="group" aria-label="Reading type">${Object.keys(VITALS).map(t => `<button data-vtype="${t}" aria-pressed="${vType === t}">${VITALS[t][0]}</button>`).join("")}</div>
          <form class="form" id="vital"><div class="${two ? "row2" : ""}">
            <div class="field"><label for="v-a">${two ? "Top number (mmHg)" : `${VITALS[vType][0]} (${VITALS[vType][1]})`}</label><input id="v-a" inputmode="decimal" required></div>
            ${two ? `<div class="field"><label for="v-b">Bottom number (mmHg)</label><input id="v-b" inputmode="numeric" required></div>` : ""}</div>
            <button class="go solid" style="align-self:flex-start">Save reading <span class="ico">${svgIcon("check")}</span></button></form>
          ${lastFlag === "urgent" ? `<p class="note urgent" role="alert">This reading is outside the range set by your care team, and a nurse has been alerted. If you feel unwell, ${H.phone ? `call ${esc(H.phone)}` : "call the hospital"} now.</p>` : ""}
          ${lastFlag === "review" ? `<p class="note review" role="status">This reading is a little outside your usual range. A nurse will review it. Message the nurse if you feel unwell.</p>` : ""}
          ${lastFlag === "" ? `<p class="note ok" role="status">Saved. This reading is inside the range set by your care team.</p>` : ""}
        </section>
        <section class="box"><div class="box-head"><h2>${VITALS[vType][0]} trend</h2><span class="tagx">${VITALS[vType][1]}</span></div>${chartSVG(me.vitals, vType)}</section>
        <section class="box wide"><h2>Recent readings</h2>${me.vitals.length ? me.vitals.slice(0, 12).map(v => `<div class="row keep"><div><b>${reading(v)} <span class="muted" style="font-weight:400">${VITALS[v.type][1]}</span></b><small>${VITALS[v.type][0]} · ${when(v.at)}</small></div>${flagTag(v.flag)}</div>`).join("") : `<p class="empty">No readings yet.</p>`}</section>`;
    }
    if (tab === "meds") {
      h += `<section class="box"><h2>Your medicines</h2>${me.meds.length ? me.meds.map(m => `<div class="row keep"><div><b>${esc(m.name)}</b><small>${m.dose ? esc(m.dose) + " · " : ""}${m.times.map(t12).join(", ")}</small></div><button class="pill ghost" data-unmed="${m.id}">Remove</button></div>`).join("") : `<p class="empty">Nothing listed yet.</p>`}</section>
        <section class="box steel"><h2>Add a medicine</h2><form class="form" id="med">
          <div class="field"><label for="m-name">Name</label><input id="m-name" style="background:#fff" required></div>
          <div class="field"><label for="m-dose">How much <span class="muted">(optional)</span></label><input id="m-dose" style="background:#fff" placeholder="e.g. 1 tablet"></div>
          <div class="field"><span style="font-size:13px;font-weight:500">When do you take it?</span><div class="checkrow">${SLOTS.map(([t, l]) => `<label style="background:#fff"><input type="checkbox" name="t" value="${t}"> ${l} · ${t12(t)}</label>`).join("")}</div></div>
          <button class="go solid" style="align-self:flex-start">Add medicine <span class="ico">${svgIcon("plus")}</span></button>
          <p class="small muted">Only list medicines exactly as your doctor or pharmacist prescribed them.</p></form></section>`;
    }
    if (tab === "home") {
      const s = DATA.services.find(x => x.id === svc);
      h += `<section class="box wide"><h2>What do you need at home?</h2>
          <div class="svc-pick">${DATA.services.map(x => `<button data-svc="${x.id}" aria-pressed="${svc === x.id}"><span class="ico lg" style="box-shadow:none">${svgIcon(SVC_ICON[x.id] || "home")}</span><b>${esc(x.name)}</b>${esc(x.blurb)}</button>`).join("")}</div>
          ${s ? `${s.urgent ? `<p class="note urgent" role="alert">For a life-threatening emergency ${H.emergency || H.phone ? `call ${esc(H.emergency || H.phone)}` : "call the hospital"} right now as well as sending this.</p>` : ""}
          <form class="form" id="req">
            <div class="field"><label for="r-addr">Where should we come?</label><input id="r-addr" value="${esc(me.account.address)}" placeholder="House number, street, area, landmark" required></div>
            ${s.urgent ? "" : `<div class="field"><label for="r-when">When suits you? <span class="muted">(optional)</span></label><input id="r-when" placeholder="e.g. Tomorrow morning"></div>`}
            <div class="field"><label for="r-note">Anything we should know? <span class="muted">(optional)</span></label><textarea id="r-note"></textarea></div>
            <button class="go solid" style="align-self:flex-start">Send request <span class="ico">${svgIcon("arrow")}</span></button></form>` : ""}
        </section>
        <section class="box wide"><h2>Your requests</h2>${me.requests.length ? me.requests.map(reqRow).join("") : `<p class="empty">No requests yet.</p>`}</section>`;
    }
    if (tab === "nurse") {
      h += `<section class="box wide"><div class="box-head"><h2>Message a nurse</h2><span class="tagx steel">Replies come here and by text</span></div>
          <div class="chat" id="chat">${chatHTML(me.chat)}</div>
          <form class="send" id="say"><label for="s-text" style="position:absolute;left:-9999px">Your message</label><input id="s-text" placeholder="Type your question" autocomplete="off" required><button class="ico lg dark" aria-label="Send">${svgIcon("arrow")}</button></form>
          <p class="small muted">Not for emergencies. If it cannot wait, call the hospital.</p></section>`;
    }
    app.innerHTML = h + `</div>`;
    const c = $("#chat"); if (c) c.scrollTop = c.scrollHeight;
  }

  async function run(fn, okMsg) {
    msg = ""; err = "";
    try { const r = await fn(); if (r && r.account) me = r; msg = okMsg || ""; }
    catch (e) { err = e.message; if (e.status === 401) { session.token = null; me = null; err = ""; } }
    render();
  }

  $("#b-out").addEventListener("click", () => { session.token = null; me = null; render(); });
  app.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const d = b.dataset;
    if (d.auth) { authMode = d.auth; err = ""; return render(); }
    if (d.tab) { tab = d.tab; msg = ""; err = ""; lastFlag = null; history.replaceState(null, "", "#" + tab); render(); return window.scrollTo({ top: 0 }); }
    if (d.vtype) { vType = d.vtype; lastFlag = null; return render(); }
    if (d.svc) { svc = d.svc; return render(); }
    if (d.take) return run(() => api("medtake", { slot: d.take, on: b.getAttribute("aria-pressed") !== "true" }));
    if (d.unmed) return run(() => api("medremove", { id: d.unmed }), "Removed.");
    if (d.cancel) { if (!d.sure) { d.sure = 1; b.textContent = "Tap again to cancel"; return; } return run(() => api("requestcancel", { id: d.cancel }), "Request cancelled."); }
  });
  app.addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target, v = id => ($("#" + id) ? $("#" + id).value.trim() : "");
    if (f.id === "auth-form") return run(() => authSubmit(f));
    if (f.id === "vital") return run(async () => { const r = await api("vital", { type: vType, a: v("v-a").replace(",", "."), b: v("v-b") }); lastFlag = r.reading.flag; return r; });
    if (f.id === "med") return run(() => api("medadd", { name: v("m-name"), dose: v("m-dose"), times: $$("input[name=t]:checked", f).map(x => x.value) }), "Medicine added. We will remind you each morning.");
    if (f.id === "req") return run(async () => { const r = await api("request", { type: svc, address: v("r-addr"), when: v("r-when"), note: v("r-note") }); svc = null; return r; }, "Request sent. You can follow it below.");
    if (f.id === "say") return run(() => api("say", { text: v("s-text") }));
  });

  // keep requests and nurse replies fresh without interrupting typing
  setInterval(() => {
    const el = document.activeElement;
    if (!me || (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName))) return;
    api("me").then(r => { me = r; render(); }).catch(() => {});
  }, 20000);

  if (session.token) run(() => api("me")); else render();
})();
