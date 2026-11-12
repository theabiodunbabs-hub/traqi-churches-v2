import { NextResponse } from "next/server";
import { admin, appUrl, cronAllowed, send } from "@/lib/email/server";
import { lagosNow, monthlyEmail, type EmailSummary } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

/** 8:00 PM WAT every day; on the last day of the month it sends the monthly report. */
export async function GET(req: Request) {
  if (!cronAllowed(req)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const now = lagosNow();
  if (!now.isLastDayOfMonth) return NextResponse.json({ ok: true, skipped: "Not the last day of the month" });
  const db = admin();
  const { data: churches } = await db.from("churches").select("id");
  const tally: Record<string, number> = {};
  for (const c of churches ?? []) {
    const [{ data: s }, { data: who }] = await Promise.all([db.rpc("email_summary", { c: c.id }), db.rpc("email_recipients", { c: c.id })]);
    if (!s) continue;
    for (const r of (who ?? []) as { email: string; firstName: string; kinds: string[] }[]) {
      if (!r.kinds.includes("monthly")) continue;
      const st = await send(db, c.id, "monthly", r.email, monthlyEmail(s as EmailSummary, appUrl(), r.firstName));
      tally[st] = (tally[st] ?? 0) + 1;
    }
  }
  return NextResponse.json({ ok: true, at: now, tally });
}
