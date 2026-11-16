/* ------------------------------------------------------------------
   EDIT THIS FILE: hospital details, home services and reading limits.
   The website and the backend both read from here.
------------------------------------------------------------------- */
const DATA = {
  hospital: {
    name: "Haven",               // short name used in the logo
    fullName: "Haven Hospital",  // used in messages
    phone: "",                   // e.g. "+233 24 123 4567"
    emergency: "",               // emergency line, shown on ambulance requests
    email: "",
    address: "",
    currency: "GHS"
  },

  // SAMPLE hours — replace with the hospital's real ones.
  hours: { outpatient: "Monday to Saturday, 7:00 am to 6:00 pm", visiting: "Every day, 4:00 pm to 6:00 pm", emergency: "Open 24 hours, every day" },

  // Departments shown on the home page and in the appointment form.
  departments: [
    { name: "General medicine", icon: "heart", blurb: "Everyday illness, check-ups and long-term conditions for adults." },
    { name: "Maternity", icon: "users", blurb: "Antenatal clinic, delivery and care after birth." },
    { name: "Children's clinic", icon: "user", blurb: "Care for babies and children, including vaccinations." },
    { name: "Surgery", icon: "plus", blurb: "Assessment, day procedures and planned operations." },
    { name: "Laboratory", icon: "flask", blurb: "Blood, urine and other tests, with results explained." },
    { name: "Pharmacy", icon: "pill", blurb: "Prescriptions filled on site and delivered to your home." },
    { name: "Eye clinic", icon: "live", blurb: "Eye tests, glasses prescriptions and treatment." },
    { name: "Dental clinic", icon: "check", blurb: "Check-ups, cleaning, fillings and extractions." }
  ],

  // Services a patient can request from home. "urgent" ones go to the top of the team's board.
  services: [
    { id: "home_visit", name: "Nurse home visit", blurb: "A nurse comes to check on you at home." },
    { id: "lab", name: "Home lab sample", blurb: "We collect blood or urine samples at your door." },
    { id: "delivery", name: "Medicine delivery", blurb: "Your prescription brought to your home." },
    { id: "ambulance", name: "Ambulance", blurb: "For emergencies. Call us as well if you can.", urgent: true }
  ],

  // When a reading is outside these limits the care team is alerted.
  // THESE ARE STARTING VALUES ONLY — your own clinicians must review and set them.
  // bp = [top number, bottom number] in mmHg · sugar in mmol/L · temp in °C
  limits: {
    bp: { urgent: [180, 120], high: [140, 90], low: [90, 60] },
    sugar: { urgentHigh: 16.7, high: 11.1, low: 3.9, urgentLow: 3.0 },
    temp: { urgentHigh: 39.5, high: 38, low: 35 }
  }
};

if (typeof module !== "undefined") module.exports = DATA;
