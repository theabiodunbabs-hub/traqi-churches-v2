# Round 9: members from every channel, removing entries, a smarter first-timer form, worker and head rules, and new event pages

## 1. Update the database (once)

1. Supabase › **SQL Editor** › **New query**.
2. Paste everything from `traqi-database-round-9.sql` and click **Run**. It's safe to run again.

It:
- moves people who joined by themselves before round 8 from First-timer to **Member**, so they see "Are you a worker? Choose your department";
- erases removed entries 30 days after removal (the reason stays in the activity log);
- lets the first-timer form check whether a number is already known (yes or no only, never who it is);
- raises event videos to **15 MB**.

## 2. What's new

- **Members keep access from every channel.** Confirming is now the church's record-keeping. The admin's "Not confirmed" shows the person: "Your membership status needs one more step. Kindly contact Admin." with Call and WhatsApp.
- **Remove a first-timer entry with a reason** (profile › bin icon): test entry, double entry (choose which record stays), not a real person, asked to be removed, other. People › "Removed" shows the last 30 days with Restore.
- **First-timer form:** on the same phone after check-in: "Welcome once again, Gabriel. Kindly continue filling out your form." (or start a new one). A number we already have skips the questions we know.
- **Workers and heads:** anyone placed in a department, however they were added, is a Worker; heads are Leaders; the admin is told when someone leaves every department. Departments can name their head ("Head Usher"). The spreadsheet import reads titles: Head Usher, Ushering Lead, HOD Ushers → head of Ushering; Asst./Deputy → assistant.
- **Event pages:** three looks (Cinematic, Editorial, Bold); headline Picture, Flyer, Carousel or Video (15 MB); a new colour picker (one main colour, paste any colour code, palettes per look, colours from your flyer, Fix it, ticket colour); New event is a 4-step quick start; suggested questions and experience words.
