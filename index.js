/* Home page: everything here works without signing in */
(function () {
  const H = DATA.hospital, tel = n => "tel:" + String(n).replace(/[^\d+]/g, "");
  document.title = H.fullName;
  const fill = (sel, text) => $$(sel).forEach(e => (e.textContent = text));
  fill("[data-full]", H.fullName);
  fill("[data-address]", H.address || "Hospital address");
  fill("[data-phone]", H.phone || "Call us");
  fill("[data-phone-long]", H.phone || "Hospital phone number");
  fill("[data-email]", H.email || "Hospital email address");
  fill("[data-emergency]", H.emergency || H.phone || "the hospital");
  fill("[data-h-em]", DATA.hours.emergency);
  fill("[data-h-out]", DATA.hours.outpatient);
  fill("[data-h-vis]", DATA.hours.visiting);
  if (H.emergency || H.phone) $("#em-text").textContent = `Emergency: ${H.emergency || H.phone} · open 24 hours`;
  $("#year").textContent = new Date().getFullYear();
  if (H.phone) $$("[data-tel]").forEach(e => (e.href = tel(H.phone)));
  if (H.emergency || H.phone) $$("[data-tel-em]").forEach(e => (e.href = tel(H.emergency || H.phone)));

  // hide the placeholder emblem if a real photo was added at images/hero.jpg
  const img = new Image(); img.onload = () => ($("#emblem").hidden = true); img.src = "images/hero.jpg";

  $("#depts").innerHTML = DATA.departments.map(d => `<div class="dept"><span class="ic">${svgIcon(d.icon)}</span><b>${esc(d.name)}</b><span>${esc(d.blurb)}</span><a href="#appointment" data-dept="${esc(d.name)}">Book an appointment →</a></div>`).join("");
  $("#a-dept").innerHTML = `<option value="">Choose a department</option>` + DATA.departments.map(d => `<option>${esc(d.name)}</option>`).join("");
  $("#depts").addEventListener("click", e => { const a = e.target.closest("[data-dept]"); if (a) $("#a-dept").value = a.dataset.dept; });
  $("#hc-choice").innerHTML = DATA.services.map((s, i) => `<label><input type="radio" name="svc" value="${s.id}" ${i === 0 ? "checked" : ""}><span style="margin:0;font-weight:600;font-size:17px;color:inherit">${esc(s.name)}<span>${esc(s.blurb)}</span></span></label>`).join("");

  const val = id => $("#" + id).value.trim();
  const show = (form, html, err) => { $(".out", form).innerHTML = `<div class="msg ${err ? "err" : ""}" ${err ? 'role="alert"' : ""}>${html}</div>`; };
  async function send(form, fn) {
    const btn = $("button", form); btn.disabled = true;
    try { const html = await fn(); show(form, html); form.reset(); if (form.id === "f-home") $("input[name=svc]").checked = true; }
    catch (e) { show(form, esc(e.message), true); }
    btn.disabled = false;
  }
  const done = r => `<b>Thank you. We have your request.</b>${esc(r.label)}. We will call you to confirm.<b class="code">${esc(r.code)}</b>Keep this reference code. You can use it under “Check my request”.`;

  $("#f-appt").addEventListener("submit", e => { e.preventDefault(); send(e.target, async () => done(await api("pubrequest", { type: "appointment", name: val("a-name"), phone: val("a-phone"), dept: val("a-dept"), when: val("a-when"), note: val("a-note") }))); });
  $("#f-home").addEventListener("submit", e => { e.preventDefault(); send(e.target, async () => done(await api("pubrequest", { type: ($("input[name=svc]:checked") || {}).value, name: val("h-name"), phone: val("h-phone"), address: val("h-addr"), note: val("h-note") }))); });
  $("#f-ask").addEventListener("submit", e => { e.preventDefault(); send(e.target, async () => { await api("pubask", { name: val("q-name"), phone: val("q-phone"), text: val("q-text") }); return "<b>Thank you.</b> A nurse will reply by phone or text message."; }); });
  $("#status").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const r = await api("status", null, "&code=" + encodeURIComponent(val("s-code")));
      show(e.target, `<b>${esc(r.label)}</b>Status: <b>${esc(STEP_LABEL[r.status])}</b>${r.assignee ? " · " + esc(r.assignee) : ""}<br>Sent ${esc(when(r.at))}`);
    } catch (x) { show(e.target, esc(x.message), true); }
  });
})();
