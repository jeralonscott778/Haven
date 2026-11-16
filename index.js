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
  $("#year").textContent = new Date().getFullYear();
  if (H.phone) $$("[data-tel]").forEach(e => (e.href = tel(H.phone)));
  if (H.emergency || H.phone) $$("[data-tel-em]").forEach(e => (e.href = tel(H.emergency || H.phone)));

  fill("[data-name]", H.name);
  fill("#st-dept", DATA.departments.length); fill("#w-dept", DATA.departments.length);
  fill("#st-home", DATA.services.length); fill("#w-docs", DATA.doctors.length); fill("#w-home", DATA.services.length);

  const cards = DATA.departments.map((d, i) => `<article class="svc"><span class="num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><h3>${svgIcon(d.icon)}${esc(d.name)}</h3><p>${esc(d.blurb)}</p><div class="links"><a href="#appointment" data-dept="${esc(d.name)}">Make an appointment</a><a href="#ask">Ask</a></div></article>`);
  cards.splice(1, 0, `<article class="svc feature"><span class="num" aria-hidden="true">${esc(H.name)}</span><p>From a first consultation and tests to treatment, with care and attention to detail.</p></article>`);
  cards.push(`<article class="svc wide"><h3>Not sure which department you need? Start with General medicine, or ask a nurse first.</h3><div class="cta"><a class="btn" href="#appointment">Book appointment <span class="ico">${svgIcon("arrow")}</span></a><a class="btn white" href="#ask">Ask a nurse <span class="ico">${svgIcon("chat")}</span></a></div></article>`);
  $("#svcs").innerHTML = cards.join("");
  $("#svcs").addEventListener("click", e => { const x = e.target.closest("[data-dept]"); if (x && window.Booking) Booking.start(x.dataset.dept); });
  $("#hc-choice").innerHTML = DATA.services.map((s, i) => `<label><input type="radio" name="svc" value="${s.id}" ${i === 0 ? "checked" : ""}><span>${esc(s.name)}<span>${esc(s.blurb)}</span></span></label>`).join("");

  const val = id => $("#" + id).value.trim();
  const show = (form, html, err) => { $(".out", form).innerHTML = `<div class="msg ${err ? "err" : ""}" ${err ? 'role="alert"' : ""}>${html}</div>`; };
  async function send(form, fn) {
    const btn = $("button", form); btn.disabled = true;
    try { const html = await fn(); show(form, html); form.reset(); if (form.id === "f-home") $("input[name=svc]").checked = true; }
    catch (e) { show(form, esc(e.message), true); }
    btn.disabled = false;
  }
  const done = r => `<b>Thank you. We have your request.</b>${esc(r.label)}. We will call you to confirm.<b class="code">${esc(r.code)}</b>Keep this reference code. You can use it under “Check my request”.`;

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
