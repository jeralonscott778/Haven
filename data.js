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

  // Doctors patients can book. SAMPLE NAMES — replace with the hospital's real doctors.
  // dept must match a department name above. days: 0 = Sunday … 6 = Saturday. Times are 24-hour.
  // photo (optional): e.g. "images/dr-boateng.jpg"
  slotMinutes: 30,
  doctors: [
    { id: "boateng", photo: "images/dr-boateng.jpg", name: "Dr. Akosua Boateng", dept: "General medicine", title: "Family physician", langs: "English, Twi", days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "14:00" },
    { id: "mensah", photo: "images/dr-mensah.jpg", name: "Dr. Kwesi Mensah", dept: "General medicine", title: "Physician", langs: "English, Fante", days: [1, 2, 3, 4, 5], start: "12:00", end: "18:00" },
    { id: "addison", photo: "images/dr-addison.jpg", name: "Dr. Claire Addison", dept: "Maternity", title: "Obstetrician", langs: "English, French", days: [1, 2, 3, 4], start: "09:00", end: "15:00" },
    { id: "owusu", photo: "images/dr-owusu.jpg", name: "Dr. Efua Owusu", dept: "Children's clinic", title: "Paediatrician", langs: "English, Fante", days: [1, 2, 4, 5, 6], start: "08:30", end: "13:30" },
    { id: "darko", name: "Dr. Yaw Darko", dept: "Surgery", title: "General surgeon", langs: "English, Twi", days: [2, 4], start: "10:00", end: "15:00" },
    { id: "addo", name: "Mrs. Grace Addo", dept: "Laboratory", title: "Laboratory scientist", langs: "English, Ga", days: [1, 2, 3, 4, 5, 6], start: "07:00", end: "13:00" },
    { id: "quaye", name: "Mr. Nii Quaye", dept: "Pharmacy", title: "Pharmacist", langs: "English, Ga", days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "17:00" },
    { id: "salifu", name: "Dr. Ibrahim Salifu", dept: "Eye clinic", title: "Eye specialist", langs: "English, Hausa", days: [1, 3, 5], start: "08:00", end: "12:00" },
    { id: "antwi", name: "Dr. Kofi Antwi", dept: "Dental clinic", title: "Dental surgeon", langs: "English, Twi", days: [1, 2, 3, 4, 5], start: "09:00", end: "16:00" }
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
