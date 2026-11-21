# Round 3: how to put it live

Do these in order. It takes about 15 minutes.

## 1. Update the database (once)

1. Open Supabase, then **SQL Editor**, then **New query**.
2. Open the file `traqi-database-round-3.sql`, copy everything, paste it in, and click **Run**.
3. You should see "Success. No rows returned". It's safe to run again if you're not sure it worked.

This adds: who decides join requests (each department head), roll call, the outreach lists, and the "new role" notice.

## 2. Upload the code to GitHub

Same as last time: replace the `src` folder, `supabase` folder, `tests` folder, `scripts` folder and `package.json` in your GitHub repository with the ones in this zip. Upload in batches of fewer than 100 files if GitHub complains.

There is one new package (`jspdf`, used to download tickets and certificates as PDF). Vercel installs it automatically from `package.json`.

## 3. Let Vercel deploy

Vercel builds by itself once GitHub has the new files. Wait for the green tick.

## 4. Check it

- **Sign up a test church:** picking colours no longer jumps ahead. The last step asks three yes/no questions.
- **Member home:** fewer cards, with events only when they need you.
- **An event page:** one Register button, "Register someone else" after, and a ticket you can download as an image or PDF.
- **A finished course:** the certificate downloads as PDF, PNG or JPEG.
- **Media head:** a member's request to join shows on their Home.
- **On a service day:** heads see "Today's service" with Roll call.
- **Follow-up › Outreach:** the outreach list, and "I met someone".
- **Offerings › Offering types:** add a building project with a target.

## Optional: refresh the Graceville demo

If you loaded the Graceville demo, run `traqi-remove-demo-church.sql`, then `traqi-demo-church.sql` again. Do this after step 1. The new demo shows outreach contacts, a building project, a join request to Media and a new-role card for the head usher.
