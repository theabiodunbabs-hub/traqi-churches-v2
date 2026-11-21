# Round 4: how to put it live

Do these in order. It takes about 15 minutes.

## 1. Update the database (once)

1. Open Supabase, then **SQL Editor**, then **New query**.
2. Open `traqi-database-round-4.sql`, copy everything, paste it in, and click **Run**.
3. You should see "Success. No rows returned". It's safe to run again.

This adds:
- faster sign-in (one trip instead of several)
- the new jobs at services: headcount for ushers, check-in for media and follow-up, and roll call of leaders for the admin
- automatic follow-up assignment, helpers on a first-timer, and who can see first-timers
- challenges, invitations to the church, fund requests and counselling
- the Finance lead and Finance team roles, for every church

## 2. Upload the code to GitHub

Replace these in your GitHub repository with the ones in this zip:
- the `src`, `supabase`, `tests` and `scripts` folders
- **`package.json` AND `package-lock.json`**: upload both, or Vercel's build can fail.

Upload in batches of fewer than 100 files if GitHub complains.

## 3. Let Vercel deploy

Vercel builds once GitHub has the new files. Wait for the green tick.

## 4. Check it

- **Sign in:** the circles pre-loader shows, and the second sign-in is much faster.
- **Settings › Roles:** give your bursar the **Finance lead** role.
- **Pastor, Counselling:** a card asks him to set up who helps him. It saves as he goes.
- **Member Home:** "I met someone" and "I need help" are at the top. "Listen to messages" and "Invite the church" are in the links.
- **Settings › Church profile:** add where your sermons are (YouTube, Spotify, Mixlr…).
- **Services › Fund requests:** the pastor or finance lead picks the route under "How it works".
- **An event › Committee:** add the committee and pick the head and assistant.

## Optional: refresh the Graceville demo

Run `traqi-remove-demo-church.sql`, then `traqi-demo-church.sql`, after step 1. The new demo has fund requests at every step, counselling requests, a wedding invitation, and a planning committee for the youth conference. Every sign-in still uses the password `Graceville@2026`; the new Finance lead sign-in is in `traqi-demo-church-logins.json`.
