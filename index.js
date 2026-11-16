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

  const card = (d, i) => `<article class="svc"><div class="svc-top"><span class="num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><span class="svc-ic">${svgIcon(d.icon)}</span></div><h3>${esc(d.name)}</h3><p>${esc(d.blurb)}</p><div class="links"><a href="#appointment" data-dept="${esc(d.name)}">Make an appointment</a><a href="#ask">Ask a nurse</a></div></article>`;
  const cards = DATA.departments.map(card);
  cards.splice(1, 0, `<article class="svc feature"><p class="f-name">${esc(H.name)}</p><p>From a first consultation and tests to treatment, with care and attention to detail.</p><a class="f-link" href="#appointment">Book an appointment →</a></article>`);
  cards.splice(6, 0, `<div class="svc photo" role="img" aria-label="A doctor writing notes during a consultation"><span>Unhurried consultations with qualified doctors</span></div>`);
  cards.push(`<article class="svc cta"><h3>Not sure which department you need?</h3><p>Start with General medicine, or ask a nurse first.</p><div class="links"><a href="#appointment">Book appointment</a><a href="#ask">Ask a nurse</a></div></article>`);
  $("#svcs").innerHTML = cards.join("");
  // phone carousel arrows
  const track = $("#svcs"), real = () => $$(".svc:not(.feature):not(.photo)", track), depts = DATA.departments.length;
  const pos = () => { const w = real()[0].offsetWidth + 10; return Math.round(track.scrollLeft / w); };
  const upd = () => { const i = pos() + 1; $("#svc-count").textContent = i > depts ? "More help" : `${String(i).padStart(2, "0")} / ${String(depts).padStart(2, "0")}`; };
  $("#svc-prev").addEventListener("click", () => track.scrollBy({ left: -(real()[0].offsetWidth + 10), behavior: "smooth" }));
  $("#svc-next").addEventListener("click", () => track.scrollBy({ left: real()[0].offsetWidth + 10, behavior: "smooth" }));
  track.addEventListener("scroll", () => requestAnimationFrame(upd), { passive: true }); upd();
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
