# Version 3 — care at home (readings, medicines, home services, nurse chat)

Pages
- `index.html` + `site.css`  public hospital site. Appointments, care at home, ask a nurse and
  request tracking all work here WITHOUT signing in.
- Photos: the home page shows a drawn doctor until you add real photos. Create an `images` folder and save:
  `images/hero.png` (main doctor, ideally a cut-out with transparent background),
  `images/doctors.png` (doctor for the "Why choose us" panel), `images/hospital.jpg` (building or ward).
  They replace the drawings automatically.
- `app.html`    optional "My Care" record for regular patients (phone number + 6-digit PIN)
- `team.html`   care-team dashboard (staff PIN)
- `api/app.js`  the whole backend, one Vercel function
- `data.js`     hospital details, home services and reading limits — EDIT THIS

Try it on a computer: `node dev-server.js`, open http://localhost:3000 (staff PIN in demo mode: 0000).

## Deploy on Vercel
1. Push this folder to a GitHub repo, import it in Vercel (preset "Other", no build step).
2. Add **Upstash for Redis** from the Vercel Marketplace (Storage). Without it the site runs in demo mode and saves nothing.
3. Environment variables, then redeploy:

| Variable | What it is |
|---|---|
| `STAFF_PIN` | PIN for team.html. Required once the database is connected. |
| `SESSION_SECRET` | Any long random text; signs patient sign-ins. |
| `SITE_URL` | Your live address, used in message links. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Turns on text messages. |
| `CRON_SECRET` | Any random text; protects the daily medicine-reminder job. |

## Must do before real patients use it
- The reading limits in `data.js` are starting values only. Your clinicians must review and set them.
- Alerts appear on the care-team dashboard; nobody is paged. Someone has to be watching it.
- Accounts have no text-message verification of the phone number. Add that, and get data-protection sign-off, before storing real health data.
- The morning medicine reminder runs once a day (07:00 UTC, see `vercel.json`). Per-dose reminders need a paid Vercel plan or another scheduler.
