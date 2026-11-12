# Traqi for Churches

Church management for growing churches: follow every person from their first visit to leadership, and give every pastor a clear view of the people in their care.

This is round 2: everything in v1 (people and follow-up, attendance and check-in, welfare, classes, events, offerings, messages, the owner view) plus joining and starting churches, the church's own look, the journey and probation, roles with pastor approval, assistants, the lead pastor's home and Ask Traqi, member and worker homes, prayer requests, the new event landing pages, branches and regions, Excel and CSV downloads, and scheduled emails (built, with sending switched off). It runs on demo data for Heirs Church with no database, or live on Supabase (`supabase/migrations`).

## What's in this build

| Screen | Path | Notes |
| --- | --- | --- |
| Sign in | `/login` | Demo: pick a person to sign in as (lead pastor, pastors, admin, leaders, worker, member) |
| Today | `/today` | "Who needs care today", last Sunday, first-timer journey, pastoral team, recent activity. Members see their own portal home |
| People | `/people` | Search and filter by journey stage; everyone's access follows their role and scope |
| Person profile | `/people/[id]` | Journey track, details, missing fields, care notes (confidential notes lead pastor only, shareable), departments, timeline |
| First-timers | `/first-timers` | Follow-up board, 48-hour clock, assign, drag between stages, one-tap call and WhatsApp |
| Departments | `/departments` | Heirs Church template: 11 departments, Media's 5 units, Children under Faculty of Training |
| Department | `/departments/[id]` | Units, leaders, overseeing pastor, people, gone quiet, birthdays, add people |
| Roles | `/settings/roles` | Three tabs (People / What they can do / Details), works by touch on phones, give a role to several people at once, temporary roles with an end date, ready-made roles, admin changes wait for the pastor's approval, only the lead pastor changes sensitive abilities |
| Journey | `/settings/journey` | The church's own stages and rules, where people are, bottlenecks, people waiting to be confirmed, probation decisions and notes |
| Branches | `/settings/branches` | Branches (starting with HQ's departments), regions, league table, church size, offerings per branch or at HQ |
| Email | `/settings/email` | The four scheduled emails with live previews, a test button, and whether sending is on |
| Prayer | `/prayer` | Members send requests; the lead pastor, pastors, Membership Ministry and anyone the lead pastor adds pray and tap "Prayed" |
| Leadership meeting | `/meeting` | Full-screen slides of the month's numbers for leaders' meetings |
| Join or start | `/start`, `/join` | Smart church search (initials, typos), branch choice, instant member access |
| Activity log | `/activity` | Every change, in Lagos time, append-only |
| Import people | `/people/import` | Excel or CSV upload, column matching, preview, phone-number duplicate check |
| Plan and billing | `/settings/billing` | Free during early access; plans by member count shown for later |
| Attendance | `/attendance` | Sunday mode headcount (men, women, children, first-timers, online), usher and family check-in, roll call, trends, weekly services and check-in switches |
| Check-in (public) | `/checkin/[church]` | One permanent link; needs the service code; open from 30 min before until the service ends; remembers the phone; "Not you?", "Add another person"; first-timers say hello here |
| Check-in screen | `/display/checkin` | Projector: QR, link, code and a live count |
| Welfare | `/welfare` | Routes by who is asking, minutes, decisions with the approval limit, private requests, delivery, monthly summary |
| Classes | `/classes`, `/classes/[id]` | Programmes each church sets up: batch or rolling, in person / online / both, Join class button that records attendance, recordings, progress, drop-off, certificate (`/classes/certificate/[id]`) |
| Events | `/events`, `/events/[id]` | Create, pastor approval, registrations, door check-in and walk-ins, share, co-organisers |
| Event page (public) | `/[church]/[event]` (old `/e/...` links still work) | Three templates (Flyer, Bold, Elegant), theme and verse, countdown, speakers with bios, programme by day with "Happening now", venues with directions, optional FAQ, gallery, where to stay, give and partners, guest services, step-by-step registration (just me, me and others, online) with a ticket per person, feedback after the event, link previews on WhatsApp |
| Church page (public) | `/c/[church]` | Pastor's welcome, service times, map, contacts, socials, live stream, events |
| Offerings | `/finance` | Counts with optional witness, other currencies, corrections approved by the lead pastor, lodging (transfer, deposit, POS) with shortfall flags, transfers, reports |
| Messages | `/messages` | Birthdays and anniversaries with "already sent by", announcements with quiet hours, personal notification settings |
| Templates | `/settings/templates` | WhatsApp templates by category, versions, defaults, personal favourites; used every time someone taps WhatsApp |
| Church profile | `/settings/church` | Logo, colour, contacts, pastor's welcome, socials, approval limit, kinds of giving, currencies, public links |
| Invite | `/invite/[token]` | Links whatever account someone signs in with to their person |
| Owner view | `/owner` | Churches, usage, growth, at-risk churches, feedback. Totals only |
| Welcome form (public) | `/welcome` | First-timers fill in their own details, with consent; auto-assigned to the lightest follow-up load |
| Welcome QR (projector) | `/display/welcome` | Full-screen QR code for service |
| Update details (public) | `/update` | Members confirm their phone with a code, then fill in what's missing |
| New church sign-up | `/signup` | Church, lead pastor, and the recommended department setup or a blank start |

### How follow-up stays accurate

- After a Call or WhatsApp tap, Traqi asks "How did it go?" when the person returns to the app, and logs it.
- Overdue first-timers rise one level a day after 48 hours: follow-up lead, then the overseeing pastor, then the lead pastor.
- Assigning suggests whoever has the fewest open follow-ups, putting people who live in the same area first.

### How the dashboard numbers work

- "Gone quiet" only counts people whose attendance is recorded (workers and anyone who checks in), so members who never scan in aren't wrongly flagged.
- Attendance is compared with the average of the four Sundays before, and with the church's goal.
- "Came back" is measured on first-timers from 2 to 8 weeks ago, a settled group, not everyone ever.

## Run it on your laptop

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Put it online (Vercel or Netlify)

**Vercel:** create a new project, import this folder (or the GitHub repo later), keep the defaults (framework: Next.js) and deploy.

**Netlify:** create a new site from this folder, build command `npm run build`, and Netlify's Next.js runtime is detected automatically.

No environment variables are needed while it runs on demo data. For live mode and email, see "Environment variables" below.

## Tests

`npm test` runs 82 tests: permissions (care notes, welfare, branch pastors, assistants, approvals and end dates), the journey and probation, auto-assignment, Ask Traqi's spelling tolerance, downloads (never care, welfare or prayer; hidden phone numbers; no spreadsheet formulas), events, emails and Lagos-time scheduling, theme contrast, and saving (every saved field is a real database column).

Not done yet, on purpose: branch pastors are limited to their branch inside the app; the database itself still lets any church staff member read across branches. Tighten that before a church with branches goes live.

## Single-file preview

`npm run preview:build` produces `preview-dist/index.html`: the whole app in one file, for sharing a click-through preview. It uses the same screens and demo data.

## Live mode (Supabase) and demo mode

The app runs in **live mode** when these two values are set, and in **demo mode** (sample data, saved only in your browser) when they're not:

```
NEXT_PUBLIC_SUPABASE_URL=https://sosiylpzgdwidnlgzqvc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`.env.local` already holds them for your laptop. On Vercel or Netlify, add the same two in the project's Environment Variables. The publishable key is designed to be public; never put the secret (service role) key in the app.

### Environment variables (Vercel → Settings → Environment Variables)

| Name | What it is | Needed for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project address | Live mode |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (safe to be public) | Live mode |
| `NEXT_PUBLIC_APP_URL` | Your live address, e.g. `https://traqi.space` | Links in emails |
| `SUPABASE_SECRET_KEY` | Supabase **secret** key. Only ever here, never in chat or code | Scheduled emails |
| `CRON_SECRET` | Any long random text; Vercel uses it to call the email jobs | Scheduled emails |
| `RESEND_API_KEY` | From resend.com. Only ever here | Sending email |
| `EMAIL_FROM` | e.g. `Heirs Church <hello@traqi.space>` (domain verified in Resend) | Sending email |
| `EMAIL_SENDING` | Leave unset to keep sending **off**. Set to `on` when you're ready | Sending email |

While `EMAIL_SENDING` isn't `on`, every scheduled email is recorded in the `email_log` table as "skipped" and nothing goes out.

### Scheduled emails (all Lagos time)

`vercel.json` runs two jobs a day: 7:00 AM (daily email to staff, Monday summary to the lead pastor, event reminders) and 8:00 PM (the month-end report, only on the last day of the month). Nothing is sent between 10:00 PM and 6:00 AM, and sending stops before Resend's free limit of 100 a day. Emails carry counts only: never care notes, welfare details or prayer requests.

### Database setup (once)

In Supabase, open SQL Editor and run, in order:

1. `supabase/migrations/0001_foundations.sql`
2. `supabase/migrations/0002_review_fixes.sql`
3. `supabase/migrations/0003_signup_and_welcome.sql`
4. Round 2: run the single file `traqi-database-round-2.sql` (it contains 0004 to 0010 and is safe to run twice)

To see the owner view, add yourself once in SQL Editor: `insert into platform_owners select id from auth.users where email = 'you@example.com';`

(The first two are combined in `traqi-database-setup.sql` if you've already run that, run only the third.)

### Sign-in

- **Google** and **email and password**, through Supabase Auth.
- A new account with no church can start one at `/signup`, and becomes its lead pastor.
- Staff and members join with an **invite link** from their profile (… → Invite to Traqi). They can sign in with any Google account or email; the link connects that account to their record. Email matching still works too.
- In Supabase, **Authentication → URL Configuration**: Site URL `http://localhost:3000`, and add `http://localhost:3000/**` (plus your live address once deployed) to Redirect URLs.

### How saving works

Screens change data through the store (`src/lib/store.tsx`). In live mode, `src/lib/live.ts` loads one church and writes only what changed. The database's row-level security decides what each person may read or change, so the rules hold even if someone bypasses the app.

### The welcome QR

In live mode the QR on `/display/welcome` points to `/welcome?church=<your-church-slug>`. Anyone can fill in the form; they can't read anything back.

## Design system

- Type: Bricolage Grotesque for headings and numbers, Figtree for text
- Colour: Traqi indigo (`#4F46E5`) on soft lavender-grey, amber for celebrations and waiting items, rose for overdue
- The journey ramp: six shades from pale to deep indigo, one per stage (first-timer → leader). Avatars, chips and the journey track all use it, so you can see where someone is at a glance
- Mobile: bottom tabs, a floating "Add first-timer" button, one-tap call and WhatsApp everywhere

## Project layout

```
src/app            screens (Next.js App Router)
src/components     shell, UI kit, care and reach-out components
src/lib            types, demo data, store, access rules, formatting
supabase/          database migrations
preview/           single-file preview build.
```
