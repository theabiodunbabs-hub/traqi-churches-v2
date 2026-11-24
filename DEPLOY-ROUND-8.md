# Round 8: members and workers, one Sunday code, new event pages, venue check-in, church page

This round lives on the `round-8` branch. Vercel builds a **preview link** for it. Nothing changes on traqi.church until the branch is merged into `main`.

## 1. Update the database (once, before testing the preview)

The preview uses the same Supabase database as the live site, so run this first. It only **adds** things; the live site keeps working.

1. Open Supabase, then **SQL Editor**, then **New query**.
2. Open `traqi-database-round-8.sql`, copy everything, paste it in, and click **Run**.
3. You should see "Success. No rows returned". It's safe to run again.

What it adds:
- People who join (events, "I'm a member") start as **Member**. Follow-up and Membership (leads and assistants) can confirm joiners.
- The one Sunday code: check in by phone **or email**; members check in after Google.
- Ticket types (limits, private links). Private types and check-in secrets are never sent to the public page.
- Check-in at the venue: printed code (event hours only) and a screen code that changes every minute.
- The `event-media` storage bucket (videos up to 10 MB) and the clean-up 14 days after an event.
- The church page data for traqi.church/{church}.

## 2. Supabase check (once)

**Authentication › URL Configuration › Redirect URLs** must include the preview addresses too: add `https://*.vercel.app/**` so Google sign-in returns to the preview.

## 3. Test on the preview link

- traqi.church/heirs → the church page (on the preview: `<preview>/heirs`).
- `/checkin/heirs` → "First time here?" or "I'm a member".
- An event page → Register opens the full-screen registration page.
- Event › Check-in tab → switch on check-in at the venue, then Print the code or Show on a screen.
- Event › Edit → core sections, then **Add a section**; autosave; Update page on published events.

## 4. Go live

Tell Claude you're happy, and the branch is merged into `main`. Vercel then deploys traqi.church.
