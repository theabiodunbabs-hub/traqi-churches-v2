# Round 7: events that bring members onto Traqi, and how to put it live

About 10 minutes. Do these in order.

## 1. Update the database (once)

1. Open Supabase, then **SQL Editor**, then **New query**.
2. Open `traqi-database-round-7.sql`, copy everything, paste it in, and click **Run**.
3. You should see "Success. No rows returned". It's safe to run again.

Run it **after** round 6. It adds two functions:
- `event_member_status`: on an event page, tells whether the Google account is already in the church, fills in what the church knows, and returns their tickets.
- `register_event_member`: registers a member for the event. If they're new to the church, it **joins them first**, with their birthday (day and month) and male or female. They're "not yet confirmed" until the admin confirms them, as with anyone who joins from search. The email is always their Google email.

## 2. Check Google sign-in in Supabase (once)

- **Authentication › Providers › Google** must be on (it already is if "Continue with Google" works on the sign-in page).
- **Authentication › URL Configuration › Redirect URLs** must include your live address with `/**` at the end, e.g. `https://traqi.space/**`. Google sends people back to the event page they came from, so the `/**` matters.

## 3. Upload the code to GitHub

Replace the `src`, `supabase` and `tests` folders. No new packages.

## 4. Let Vercel deploy, then check

On a phone, open a published event's page and press **Register**:

1. It first shows two choices: **A member of {church}?** and **Invited** (Continue with the form).
2. **Invited**: the same as before. Fill in the form; the tickets show on the page.
3. **A member of {church}**, then **Continue with Google** ("Continue registration with your Google account. This also creates an account for you if you don't have one."). Google asks which account. Anyone signed in on that phone is signed out first, so a phone can be passed round.
   - **Already in the church**: goes straight to their **Home**. The event shows there with **Register now**, and the form comes filled in.
   - **New**: back on the event page, the form is filled in from Google. First and last name can be changed; the email can't. Below the email: **Birthday (day-month only)** and **I am** (male or female). **Register and join {church}** registers them, joins them to the church and opens their **Home**.
4. On **Home**, each event is a card that opens and closes:
   - Tapping the **title** opens the event.
   - The **arrow** shows the tickets (QR code, **Image**, **PDF**, **Send**) and **Register someone else**, which goes back to the event page.
   - A new ticket shows open the first time; after that the card starts closed.
5. **Settings › People**: the new member waits to be confirmed, like anyone who joins from search.

Signed-in members who open an event inside Traqi skip the question and Google: the form comes filled in.

## Good to know

- People who join this way are members straight away and can check in, join classes and register for events. The admin confirms them later.
- The demo has pretend Google accounts to try it with: two people already in the church and two new people.
