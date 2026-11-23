# Round 5: event management, and how to put it live

Do these in order. It takes about 15 minutes.

## 1. Update the database (once)

1. Open Supabase, then **SQL Editor**, then **New query**.
2. Open `traqi-database-round-5.sql`, copy everything, paste it in, and click **Run**.
3. You should see "Success. No rows returned". It's safe to run again.

Run it **after** round 4. It doesn't delete or rename anything. It adds:

- **Two new tables**: `event_notes` (the committee's thoughts and suggestions) and `meeting_rsvps` ("Will you be there?" for department and committee meetings).
- **Committee rights**: committee members can now see their event (even as a draft) and its registrations. The head, the assistant and anyone they give a right to can edit the event, its meetings and its teams. Publishing still needs a pastor.
- **Numbered tickets** like `CH26-00125`, one after another for each event, handed out under a lock so two people never get the same number. Old tickets keep their codes.
- **Check-in functions** (`checkin_open`, `checkin_find`, `checkin_mark`, `checkin_walkin`, `checkin_stats`). Every check-in locks that registration, so 20 people at different doors can't let the same ticket in twice. Each check-in records who did it, when and how.
- **Budget rules**: an event budget must pass the committee (head, assistant or Finance Lead) before finance, and only the **Lead Pastor** gives the final approval. The database enforces this, not just the app.
- `door` is now a reserved church address, because `/door/...` is the shared check-in link.

## 2. Upload the code to GitHub

Replace these in your GitHub repository:
- the `src`, `supabase` and `tests` folders
- **`package.json` AND `package-lock.json`**. This round adds `jsqr`, which lets iPhones scan QR codes.

## 3. Let Vercel deploy

Wait for the green tick.

## 4. Check it

- **Events › New event**: add the brief, the target budget, the registration target and the committee. Everyone appointed gets a notice and a box on their Home.
- **An event › Committee**: the brief with progress against the target, the next meeting, a link to the event page, budgets, thoughts and suggestions, and the members. Open **Manage** on a member to give them a role, responsibilities, rights, or make them Finance Lead.
- **An event › Briefing**: the meeting view for the Pastorate. Tap **Present full screen**. Add a *Gender* and a *Where are you coming from?* question to the form to fill in those charts.
- **An event › Teams**: tick a department for check-in (for example Follow-up). Everyone in it is on the team. Choose a Registration Lead, then **Make the check-in link** and **Share to WhatsApp**.
- **On a phone, open the link**: sign in, then scan a ticket's QR code, or type the ticket ID, phone number or email. Scan the same ticket on a second phone and it says who checked them in.
- **Funds › New request**: it asks whether the request is for an event.
- **A department › Meetings**: choose in person or online. Members are notified and can tap "I'll be there" or "Can't make it". The head sees who's coming.

## Good to know

- People on the check-in team need a Traqi account linked to their record (invite them from their profile). The shared link only works once they sign in.
- The camera needs **https** (your live address is fine). Test scanning on the phones you'll use on the day.
- **Make a new link** stops the old one working at once.
