/* Home page */
(function () {
  const H = DATA.hospital;
  document.title = `${H.fullName} — your hospital stays with you at home`;
  $$("[data-name]").forEach(e => (e.textContent = H.name));
  $$("[data-full]").forEach(e => (e.textContent = H.fullName));
  $$("[data-phone]").forEach(e => (e.textContent = H.phone || "Hospital phone number"));
  $$("[data-address]").forEach(e => (e.textContent = H.address || "Hospital address"));
  $$("[data-emergency]").forEach(e => (e.textContent = H.emergency || H.phone || "the hospital"));
  if (H.phone) $$("[data-tel]").forEach(e => (e.href = "tel:" + H.phone.replace(/[^\d+]/g, "")));
  $("#year").textContent = new Date().getFullYear();
  if (session.token) $("#nav-auth").textContent = "My care";
  $("#hero-x").addEventListener("click", () => ($("#hero-card").hidden = true));

  const SLIDES = [
    { id: "vitals", tab: "my readings", icon: "pulse", text: "Record blood pressure, sugar or temperature and <b>your nurse is alerted</b> if a reading is out of range." },
    { id: "meds", tab: "my medicines", icon: "pill", text: "A morning message lists <b>today's medicines</b>, and you tick each one off as you take it." },
    { id: "home", tab: "care at home", icon: "home", text: "Ask for a <b>nurse visit, lab sample or delivery</b> at home and follow it until it arrives." },
    { id: "nurse", tab: "ask a nurse", icon: "chat", text: "Send a question to the care team and get a <b>reply from a nurse</b> without travelling." }
  ];
  let i = 0;
  function show() {
    const s = SLIDES[i];
    $("#svc-tabs").innerHTML = SLIDES.map((x, k) => `<button class="pill" role="tab" data-k="${k}" aria-selected="${k === i}">${x.tab} ${svgIcon(x.icon)}</button>`).join("");
    $("#svc-ico").innerHTML = svgIcon(s.icon);
    $("#svc-path").textContent = s.tab.charAt(0).toUpperCase() + s.tab.slice(1);
    $("#svc-text").innerHTML = s.text; // fixed copy from this file
    $("#svc-link").href = "app.html#" + s.id;
    $("#svc-dots").innerHTML = SLIDES.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
  }
  $("#svc-tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { i = +b.dataset.k; show(); } });
  $("#svc-next").addEventListener("click", () => { i = (i + 1) % SLIDES.length; show(); });
  $("#svc-prev").addEventListener("click", () => { i = (i - 1 + SLIDES.length) % SLIDES.length; show(); });
  show();
})();
