# Round 6: the event registration form and birthdays on joining, and how to put it live

About 5 minutes. Do these in order.

## 1. Update the database (once)

1. Open Supabase, then **SQL Editor**, then **New query**.
2. Open `traqi-database-round-6.sql`, copy everything, paste it in, and click **Run**.
3. You should see "Success. No rows returned". It's safe to run again.

Run it **after** round 5. It updates three functions:
- **Registration** keeps the **first name** and **last name** separately (and both together, for tickets and the door), plus the optional **alternative number** (hotline or call number). A registration with no first name, last name or email is refused. Pages already open on someone's phone keep working.
- **Door search** finds people by their WhatsApp number or their alternative number.
- **Walk-ins** keep first name, last name and the alternative number.

Birthdays need no database change. A birthday given as day and month only is kept with the year 1904, which Traqi never shows.

## 2. Upload the code to GitHub

Replace the `src`, `supabase` and `tests` folders. No new packages.

## 3. Let Vercel deploy, then check

Open a published event's page and press **Register**:
- **First name** and **Last name** are two boxes.
- **Phone number (your WhatsApp number)**, then **Alternative number (optional - your hotline or call number)** under it. It can be left blank, then **Email**. The phone number and email must be filled in.
- Every question must be answered, except **T-shirt size**, **School or workplace** and **Where are you coming from?**, which say "(optional)".
- **T-shirt size** opens Traqi's own dropdown: a menu on a computer, a sheet from the bottom on a phone.

At the door (**an event › Check-in › Add a walk-in**): first name, last name, phone, an alternative number (optional - hotline or call number) and an optional email. Searching by either number finds the person.

Joining a church (**/join**) and **Update my details** (**/update**): **Birthday (day-month only)** must be filled in. Tap it and pick the month, then the day. There is no year. On a person's profile, staff can add the year (for children, say).

In **Events › an event › Edit › Registration form**, each question's **Required** switch shows the new default. Turn any of them on or off.

The registrations download (Excel) now has **First name**, **Last name**, **WhatsApp number** and **Alternative number** columns. Older registrations have their one name split in two.
