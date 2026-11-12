import { NextResponse } from "next/server";
import { admin, appUrl, cronAllowed, send } from "@/lib/email/server";
import { dailyEmail, eventReminderEmail, lagosNow, mondayEmail, type EmailSummary } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

/** 7:00 AM WAT every day: the daily email, the Monday summary on Mondays, and event reminders. */
export async function GET(req: Request) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const db = admin();
  const now = lagosNow();
  const base = appUrl();
  const { data: churches } = await db.from("churches").select("id");
  const tally: Record<string, number> = {};
  const count = (k: string) => { tally[k] = (tally[k] ?? 0) + 1; };
  for (const c of churches ?? []) {
    const [{ data: s }, { data: who }, { data: rem }] = await Promise.all([
      db.rpc("email_summary", { c: c.id }), db.rpc("email_recipients", { c: c.id }), db.rpc("email_event_reminders", { c: c.id }),
    ]);
    if (!s) continue;
    const summary = s as EmailSummary;
    for (const r of (who ?? []) as { email: string; firstName: string; kinds: string[] }[]) {
      if (r.kinds.includes("daily")) count(await send(db, c.id, "daily", r.email, dailyEmail(summary, base, r.firstName)));
      if (now.weekday === "Mon" && r.kinds.includes("monday")) count(await send(db, c.id, "monday", r.email, mondayEmail(summary, base, r.firstName)));
    }
    for (const x of (rem ?? []) as { event: Parameters<typeof eventReminderEmail>[2]; to: string; name: string; ticket: string }[]) {
      count(await send(db, c.id, "event_reminder", x.to, eventReminderEmail(summary.church, base, x.event, x.name, x.ticket)));
    }
  }
  return NextResponse.json({ ok: true, at: now, tally });
}
