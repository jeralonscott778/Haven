/* Real appointment booking: department → doctor → live calendar → details → confirmed instantly.
   Also "Manage my booking" (change time or cancel with the booking code). */
(function () {
  const box = $("#bk"), H = DATA.hospital, DOCS = DATA.doctors;
  const STEPS = ["Department", "Doctor", "Date & time", "Your details", "Confirmed"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const S = { step: 0, dept: null, doc: null, date: null, time: null, cal: null, all: null, err: "", busy: false, done: null, move: null };
  const dObj = iso => new Date(iso + "T12:00:00Z");
  const today = () => (S.all && S.all.today) || new Date().toISOString().slice(0, 10);
  function nice(iso) {
    const diff = Math.round((dObj(iso) - dObj(today())) / 864e5);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return dObj(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  }
  const docById = id => DOCS.find(d => d.id === id);
  const initials = n => n.replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/, "").split(/\s+/).map(w => w[0]).slice(0, 2).join("");
  const avatar = (d, cls = "") => d.photo ? `<img class="av ${cls}" src="${esc(d.photo)}" alt="">` : `<span class="av ${cls}" aria-hidden="true">${esc(initials(d.name))}</span>`;
  const hours = d => `${d.days.map(x => DOW[x]).join(", ")} · ${t12(d.start)}–${t12(d.end)}`;
  function nextFree(cal, test) {
    if (!cal) return null;
    for (const day of cal.days) for (const s of day.slots) if (s.free.some(test)) return { date: day.date, time: s.time, doc: s.free.find(test) };
    return null;
  }
  const nfText = n => (n ? `${nice(n.date)}, ${t12(n.time)}` : S.all ? "No free times in the next 2 weeks" : "…");

  /* ---------- left panel: progress + summary ---------- */
  function side() {
    const steps = S.move ? [2, 4] : [0, 1, 2, 3, 4];
    $("#bk-steps").innerHTML = steps.map((i, k) => `<li class="${i < S.step ? "done" : i === S.step ? "on" : ""}"><span>${i < S.step ? svgIcon("check") : k + 1}</span>${S.move && i === 2 ? "New date & time" : STEPS[i]}</li>`).join("");
    const d = S.doc && S.doc !== "any" ? docById(S.doc) : null, rows = [];
    if (S.dept) rows.push(["Department", S.dept]);
    if (S.doc) rows.push(["Doctor", d ? d.name : "First available"]);
    if (S.date && S.time) rows.push(["When", `${nice(S.date)}, ${t12(S.time)}`]);
    $("#bk-sum").hidden = !rows.length || S.step === 4;
    $("#bk-sum").innerHTML = rows.map(([k, v]) => `<p><small>${k}</small>${esc(v)}</p>`).join("");
  }

  /* ---------- right panel: the step ---------- */
  function render() {
    side();
    let h = "";
    if (S.err) h += `<p class="msg err" role="alert">${esc(S.err)}</p>`;

    if (S.step === 0) {
      h += `<div class="bk-h"><h3>Which department do you need?</h3><p class="muted">Not sure? Choose General medicine and the doctor will guide you.</p></div>
        <div class="grid-dept">${DATA.departments.map(dp => {
          const ds = DOCS.filter(x => x.dept === dp.name), ids = ds.map(x => x.id), n = nextFree(S.all, id => ids.includes(id));
          return `<button class="dcard" data-dept="${esc(dp.name)}" ${ds.length ? "" : "disabled"}>${svgIcon(dp.icon)}<b>${esc(dp.name)}</b><small>${ds.length} ${ds.length === 1 ? "specialist" : "specialists"}</small><em>${ds.length ? "Next: " + nfText(n) : "Call to book"}</em></button>`;
        }).join("")}</div>`;
    }

    if (S.step === 1) {
      const ds = DOCS.filter(x => x.dept === S.dept), ids = ds.map(x => x.id);
      h += `<div class="bk-h"><h3>Who would you like to see?</h3><p class="muted">${esc(S.dept)} · tap a doctor to see their free times</p></div>
        <div class="docs">
          ${ds.length > 1 ? `<button class="doc-card any" data-doc="any"><span class="av" aria-hidden="true">${svgIcon("users")}</span><span><b>First available doctor</b><small>The earliest time with any ${esc(S.dept.toLowerCase())} doctor</small><em>Next: ${nfText(nextFree(S.all, id => ids.includes(id)))}</em></span></button>` : ""}
          ${ds.map(d => `<button class="doc-card" data-doc="${d.id}">${avatar(d)}<span><b>${esc(d.name)}</b><small>${esc(d.title)} · speaks ${esc(d.langs)}</small><small>${hours(d)}</small><em>Next: ${nfText(nextFree(S.all, id => id === d.id))}</em></span></button>`).join("")}
        </div>
        <div class="bk-foot"><button class="back" data-back>← Back</button></div>`;
    }

    if (S.step === 2) {
      const d = S.doc !== "any" ? docById(S.doc) : null;
      h += `<div class="bk-h"><h3>${S.move ? "Pick a new date and time" : "Pick a date and time"}</h3><p class="muted">${d ? esc(d.name) : "First available " + esc(S.dept.toLowerCase()) + " doctor"} · times shown are really free right now</p></div>`;
      if (!S.cal) h += `<p class="muted">Loading the calendar…</p>`;
      else {
        const day = S.cal.days.find(x => x.date === S.date);
        h += `<div class="dates" role="group" aria-label="Date">${S.cal.days.map(x => {
          const free = x.slots.filter(s => s.free.length).length, o = dObj(x.date);
          const lab = !x.slots.length ? "Closed" : free ? `${free} free` : "Full";
          return `<button class="dbtn" data-date="${x.date}" aria-pressed="${S.date === x.date}" ${free ? "" : "disabled"} aria-label="${nice(x.date)}, ${lab}"><small>${x.date === S.cal.today ? "Today" : DOW[o.getUTCDay()]}</small><b>${o.getUTCDate()}</b><em>${lab}</em></button>`;
        }).join("")}</div>`;
        if (day) {
          const groups = [["Morning", s => s.time < "12:00"], ["Afternoon", s => s.time >= "12:00" && s.time < "17:00"], ["Evening", s => s.time >= "17:00"]];
          h += groups.map(([g, f]) => { const ss = day.slots.filter(f); return ss.length ? `<div class="tgroup"><p>${g}</p><div class="times">${ss.map(s => `<button class="tbtn" data-time="${s.time}" aria-pressed="${S.time === s.time}" ${s.free.length ? "" : `disabled aria-label="${t12(s.time)} already booked"`}>${t12(s.time)}</button>`).join("")}</div></div>` : ""; }).join("");
          h += `<p class="legend"><span class="lg free"></span>Free <span class="lg taken"></span>Already booked</p>`;
        } else h += `<p class="msg">No free times in the next two weeks. Please call the hospital and we will fit you in.</p>`;
      }
      h += `<div class="bk-foot"><button class="back" data-back>← Back</button><button class="btn" data-next ${S.time && !S.busy ? "" : "disabled"}>${S.move ? (S.busy ? "Moving…" : "Move my appointment") : "Continue"} <span class="ico">${svgIcon("arrow")}</span></button></div>`;
    }

    if (S.step === 3) {
      h += `<div class="bk-h"><h3>Who is the appointment for?</h3><p class="muted">We text the booking code to this phone number.</p></div>
        <form class="form" id="bk-form" novalidate>
          <div class="row2">
            <div class="field"><label for="b-name">Patient's full name</label><input id="b-name" autocomplete="name" required></div>
            <div class="field"><label for="b-phone">Phone number</label><input id="b-phone" type="tel" inputmode="tel" autocomplete="tel" required></div>
          </div>
          <div class="row2">
            <div class="field"><label for="b-nhis">NHIS number <span>(optional)</span></label><input id="b-nhis" inputmode="numeric" autocomplete="off"></div>
            <div class="field"><label for="b-by">Booking for someone else? <span>(your name)</span></label><input id="b-by" autocomplete="off"></div>
          </div>
          <div class="field"><label for="b-note">Reason for the visit <span>(optional)</span></label><textarea id="b-note"></textarea></div>
          <div class="bk-foot"><button type="button" class="back" data-back>← Back</button><button class="btn" ${S.busy ? "disabled" : ""}>${S.busy ? "Booking…" : "Confirm booking"} <span class="ico">${svgIcon("check")}</span></button></div>
        </form>`;
    }

    if (S.step === 4 && S.done) {
      const a = S.done, d = docById(a.doctorId) || {};
      h += `<div class="confirm">
          <span class="done-ic" aria-hidden="true">${svgIcon("check")}</span>
          <h3>${S.moved ? "Your appointment has been moved." : "You're booked."}</h3>
          <p class="muted">${S.moved ? "We have texted you the new time." : "A confirmation with your booking code is on its way by text message."}</p>
          <div class="ticket">
            <div class="t-doc">${d.name ? avatar(d, "sm") : ""}<p><b>${esc(a.doctor)}</b><small>${esc(a.title)} · ${esc(a.dept)}</small></p></div>
            <div class="t-grid"><p><small>Date</small>${esc(nice(a.date))}</p><p><small>Time</small>${t12(a.time)}</p><p><small>Patient</small>${esc(a.name)}</p><p><small>Booking code</small><b class="code">${esc(a.code)}</b></p></div>
            <p class="t-note">Please arrive 15 minutes early with your hospital card and NHIS or insurance card.</p>
          </div>
          <div class="bk-foot" style="justify-content:flex-start"><button class="btn" data-ics>Add to my calendar <span class="ico">${svgIcon("clock")}</span></button><button class="back" data-again>Book another appointment</button></div>
        </div>`;
    }
    box.innerHTML = h;
  }

  /* ---------- data ---------- */
  async function loadAll() {
    try {
      S.all = await api("calendar");
      const n = nextFree(S.all, () => true), d = n && docById(n.doc);
      const txt = n ? `Next free appointment: <b>${nice(n.date)}, ${t12(n.time)}</b> with ${esc(d.name)}` : "Call us to book an appointment";
      $("#hero-next").innerHTML = txt; $("#bk-live").innerHTML = txt;
    } catch (e) { $("#hero-next").textContent = "Book online or call the hospital"; $("#bk-live").textContent = "Live booking"; }
    if (S.step <= 1) render();
  }
  async function loadCal() {
    S.cal = null; render();
    try {
      S.cal = await api("calendar", null, S.doc !== "any" ? "&doctor=" + encodeURIComponent(S.doc) : "&dept=" + encodeURIComponent(S.dept));
      const day = S.cal.days.find(x => x.date === S.date && x.slots.some(s => s.free.length)) || S.cal.days.find(x => x.slots.some(s => s.free.length));
      S.date = day ? day.date : null;
      if (day && !day.slots.some(s => s.time === S.time && s.free.length)) S.time = null;
    } catch (e) { S.err = e.message; }
    render();
  }
  function go(step) {
    S.step = step; S.err = ""; render();
    const top = $("#appointment").getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.6) $("#appointment").scrollIntoView({ behavior: "smooth" });
  }
  function reset() { Object.assign(S, { step: 0, dept: null, doc: null, date: null, time: null, cal: null, err: "", done: null, move: null, moved: false }); render(); }

  /* ---------- events ---------- */
  box.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.dept) { S.dept = d.dept; S.doc = null; S.time = null; const ds = DOCS.filter(x => x.dept === S.dept); if (ds.length === 1) { S.doc = ds[0].id; go(2); loadCal(); } else go(1); return; }
    if (d.doc) { S.doc = d.doc; S.time = null; go(2); loadCal(); return; }
    if (d.date) { S.date = d.date; S.time = null; render(); return; }
    if (d.time) { S.time = d.time; render(); return; }
    if ("back" in d) { if (S.move && S.step === 2) { reset(); return; } let s = S.step - 1; if (s === 1 && DOCS.filter(x => x.dept === S.dept).length === 1) s = 0; go(s); return; }
    if ("again" in d) { reset(); go(0); return; }
    if ("ics" in d) return ics();
    if ("next" in d) {
      if (!S.move) return go(3);
      S.busy = true; render();
      try { S.done = (await api("bookmove", { code: S.move.code, last4: S.move.last4, date: S.date, time: S.time })).appt; S.moved = true; S.busy = false; go(4); loadAll(); }
      catch (x) { S.busy = false; S.err = x.message; if (x.status === 409) await loadCal(); else render(); }
    }
  });
  box.addEventListener("submit", async e => {
    e.preventDefault();
    const v = id => $("#" + id).value.trim();
    const body = { dept: S.dept, doctorId: S.doc, date: S.date, time: S.time, name: v("b-name"), phone: v("b-phone"), nhis: v("b-nhis"), bookedBy: v("b-by"), note: v("b-note") };
    if (body.name.length < 2 || body.phone.replace(/\D/g, "").length < 7) { S.err = "Please enter the patient's name and a phone number."; return render(); }
    S.busy = true; S.err = ""; render();
    try { S.done = (await api("book", body)).appt; S.busy = false; go(4); loadAll(); }
    catch (x) { S.busy = false; S.err = x.message; if (x.status === 409) { S.step = 2; S.time = null; await loadCal(); S.err = x.message; render(); } else render(); }
  });

  function ics() {
    const a = S.done, d = docById(a.doctorId) || {}, [h, m] = a.time.split(":").map(Number);
    const start = new Date(Date.UTC(+a.date.slice(0, 4), +a.date.slice(5, 7) - 1, +a.date.slice(8, 10), h, m)), end = new Date(start.getTime() + (DATA.slotMinutes || 30) * 6e4);
    const f = x => x.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const text = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hospital//Booking//EN", "BEGIN:VEVENT", `UID:${a.code}@hospital`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
      `SUMMARY:Appointment with ${d.name} (${H.fullName})`, `DESCRIPTION:Booking code ${a.code}. Please arrive 15 minutes early.`, `LOCATION:${H.address || H.fullName}`,
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Hospital appointment", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/calendar" })); link.download = `appointment-${a.code}.ics`; link.click();
  }

  /* ---------- manage my booking ---------- */
  const mOut = $("#m-out");
  let found = null;
  function showFound(msg) {
    const a = found;
    if (!a) return;
    const open = a.status === "confirmed", lab = { confirmed: "Booked", checked_in: "Checked in", seen: "Completed", no_show: "Missed", cancelled: "Cancelled" }[a.status];
    mOut.innerHTML = `${msg ? `<p class="msg">${esc(msg)}</p>` : ""}<div class="found"><div><b>${esc(a.doctor)}</b><small>${esc(nice(a.date))}, ${t12(a.time)} · ${esc(a.dept)} · ${esc(a.name)}</small></div><span class="pill-st ${a.status}">${lab}</span>
      ${open ? `<div class="found-acts"><button class="btn plain" data-mmove>Change the time</button><button class="btn line plain" data-mcancel>Cancel appointment</button></div>` : ""}</div>`;
  }
  $("#f-manage").addEventListener("submit", async e => {
    e.preventDefault();
    try { found = (await api("mybooking", { code: $("#m-code").value.trim(), last4: $("#m-4").value.trim() })).appt; showFound(); }
    catch (x) { found = null; mOut.innerHTML = `<p class="msg err" role="alert">${esc(x.message)}</p>`; }
  });
  mOut.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    const cred = { code: $("#m-code").value.trim(), last4: $("#m-4").value.trim() };
    if ("mcancel" in b.dataset) {
      if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Tap again to cancel"; return; }
      try { found = (await api("bookcancel", cred)).appt; showFound("Your appointment is cancelled."); loadAll(); } catch (x) { mOut.insertAdjacentHTML("afterbegin", `<p class="msg err">${esc(x.message)}</p>`); }
    }
    if ("mmove" in b.dataset) {
      const d = docById(found.doctorId);
      Object.assign(S, { move: cred, dept: found.dept, doc: found.doctorId, date: null, time: null, done: null, moved: false });
      mOut.innerHTML = `<p class="msg">Pick a new time for ${esc(d ? d.name : "your doctor")} above.</p>`;
      go(2); loadCal();
    }
  });

  window.Booking = { start(dept) { reset(); S.dept = dept; const ds = DOCS.filter(x => x.dept === dept); if (ds.length === 1) { S.doc = ds[0].id; go(2); loadCal(); } else go(1); } };
  render(); loadAll(); setInterval(loadAll, 60000);
})();
