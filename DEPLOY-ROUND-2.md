# Putting round 2 live

Do these in order. Nothing goes live until step 4, and no emails are sent until you choose to switch them on (step 6).

## 1. Update the database (Supabase)

1. Open your Supabase project, then **SQL Editor**, then **New query**.
2. Open `traqi-database-round-2.sql` (it's in the project folder), copy everything, paste it in, and press **Run**.
3. You should see "Success. No rows returned". It's safe to run again if anything stopped halfway.

The first line of the right file reads: `-- Traqi for Churches: database update, round 2`. Don't run the test-data files.

## 2. Add the new settings in Vercel

Vercel, your project, **Settings**, then **Environment Variables**. Add:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Your live address, e.g. `https://traqi.space` |
| `SUPABASE_SECRET_KEY` | Supabase: **Project Settings**, **API Keys**, the **secret** key. Paste it only here, never in a chat |
| `CRON_SECRET` | Any long random text (make one at https://www.random.org/strings/ or type 40 random letters) |

Leave `EMAIL_SENDING` out for now. That keeps email off.

## 3. Upload the code to GitHub

GitHub's web upload takes up to 100 files at a time, and this project has about 140, so upload it in three goes. Unzip the project first.

1. In your repository, at the top level, click **Add file**, then **Upload files**. Drag in everything from the project folder **except** the `src` folder: `supabase`, `public`, `tests`, `package.json`, `package-lock.json`, `vercel.json`, `README.md`, `DEPLOY-ROUND-2.md`, `traqi-database-round-2.sql`, and the other files at the top level. Commit.
2. Open the `src` folder in GitHub, then **Add file**, then **Upload files**. Drag in the `app` folder from your `src` folder. Commit.
3. Still inside `src`, upload the `components` and `lib` folders together. Commit.

Same names replace the old files, which is what you want.

## 4. Let Vercel deploy

Vercel builds automatically after each commit. Wait for the last one to show **Ready**.

## 5. Check it works

- Open your site and sign in.
- **Settings, Roles**: on your phone, open a role, tap **Give this role**, choose someone, then tap **Give role** at the bottom.
- **Events**: open an event, **Edit**, choose a template, then **Preview**.
- Share an event link on WhatsApp. The preview card should show the church name and event.
- **Settings, Email**: it should say "Sending is off".

## 6. When you're ready for email (later)

1. Sign up at https://resend.com and verify your domain (Resend shows the DNS records to add).
2. In Vercel, add `RESEND_API_KEY` (only there), `EMAIL_FROM` (e.g. `Heirs Church <hello@traqi.space>`), and `EMAIL_SENDING` = `on`.
3. Redeploy, then press **Send me a test** in Settings, Email.

Schedule (Lagos time): daily email at 7:00 AM, Monday summary at 7:00 AM, event reminders at 7:00 AM, and the month-end report at 8:00 PM on the last day of the month. Nothing is sent between 10:00 PM and 6:00 AM.
