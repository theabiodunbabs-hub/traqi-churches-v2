/**
 * Server-only: sending through Resend, with the safety rails.
 * - Nothing is sent unless EMAIL_SENDING=on (and RESEND_API_KEY is set). Until then every email is logged as "skipped".
 * - No emails in quiet hours (10:00 PM to 6:00 AM WAT), except tests.
 * - Stops before Resend's free limit of 100 a day.
 * Keys live only in Vercel's environment settings, never in the code.
 */
import { createClient } from "@supabase/supabase-js";
import { FREE_DAILY_CAP, lagosNow, quietHours, type Email, type EmailKind } from "./templates";

export const sendingOn = () => process.env.EMAIL_SENDING === "on" && !!process.env.RESEND_API_KEY;
export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "https://traqi.space").replace(/\/$/, "");

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY is not set in Vercel");
  return createClient(url, key, { auth: { persistSession: false } });
}

let sentToday: number | null = null;
async function countToday(db: ReturnType<typeof admin>) {
  if (sentToday !== null) return sentToday;
  const since = new Date(Date.now() - 24 * 36e5).toISOString();
  const { count } = await db.from("email_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("at", since);
  sentToday = count ?? 0;
  return sentToday;
}

export async function send(db: ReturnType<typeof admin>, churchId: string | null, kind: EmailKind, to: string, mail: Email): Promise<"sent" | "skipped" | "failed" | "capped" | "quiet"> {
  const log = (status: string, detail?: string) => db.from("email_log").insert({ church_id: churchId, kind, to_email: to, subject: mail.subject, status, detail });
  if (kind !== "test" && quietHours(lagosNow().hour)) { await log("quiet"); return "quiet"; }
  if (!sendingOn()) { await log("skipped", "Email sending is off"); return "skipped"; }
  if ((await countToday(db)) >= FREE_DAILY_CAP - 5) { await log("capped", "Daily limit reached"); return "capped"; }
  const from = process.env.EMAIL_FROM || "Traqi <hello@traqi.space>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!r.ok) { await log("failed", (await r.text()).slice(0, 300)); return "failed"; }
  sentToday = (sentToday ?? 0) + 1;
  await log("sent");
  return "sent";
}

/** Vercel calls the cron routes with this secret. */
export const cronAllowed = (req: Request) => !!process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
