/**
 * The emails Traqi sends, as plain functions so they can be previewed in the app
 * and sent from the server. Times are in WAT (Lagos) with AM/PM.
 * Never includes care notes, welfare details or prayer requests: only counts.
 */
export type EmailSummary = {
  church: { name: string; slug: string; color?: string | null; logo?: string | null };
  lastSunday: string | null; attendance: number; attendancePrev: number; goal?: number | null;
  missed: { leaders: number; workers: number; members: number }; quiet: number;
  firstTimersWeek: number; firstTimersMonth: number; notReached: number; unassigned: number;
  joinersWaiting: number; roleApprovals: number; welfareOpen: number; prayersWeek: number;
  birthdays: string[]; events: { title: string; start: string; slug: string; registered: number }[];
  classesFinishedMonth: number; people: number; serving: number;
};
export type Email = { subject: string; html: string; text: string };
export type EmailKind = "daily" | "monday" | "monthly" | "event_reminder" | "test";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const wat = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", ...o });
export const watDate = (iso: string) => wat(iso, { weekday: "long", day: "numeric", month: "long" });
export const watTime = (iso: string) => wat(iso, { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?(am|pm)/i, (m) => ` ${m.trim().toUpperCase()}`);
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function frame(s: EmailSummary, base: string, title: string, intro: string, body: string, cta?: { label: string; href: string }) {
  const color = s.church.color || "#4f46e5";
  return `<!doctype html><html><body style="margin:0;background:#f4f3f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#17151f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:${color};padding:28px 28px 24px;color:#fff">
<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85">${esc(s.church.name)}</div>
<div style="font-size:24px;font-weight:700;margin-top:8px;line-height:1.2">${esc(title)}</div>
<div style="font-size:15px;opacity:.9;margin-top:6px">${intro}</div></td></tr>
<tr><td style="padding:24px 28px">${body}
${cta ? `<div style="margin-top:24px"><a href="${base}${cta.href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">${esc(cta.label)}</a></div>` : ""}
</td></tr>
<tr><td style="padding:16px 28px 24px;font-size:12px;color:#8a8698;border-top:1px solid #eee">You get this because of your role at ${esc(s.church.name)}. To stop these emails, open Traqi, go to your profile and switch off emails.<br>Powered by Traqi</td></tr>
</table></td></tr></table></body></html>`;
}

const stat = (n: string | number, label: string, tone = "#17151f") => `<td style="padding:12px;background:#f6f5fa;border-radius:14px;text-align:center;width:33%"><div style="font-size:26px;font-weight:700;color:${tone}">${n}</div><div style="font-size:12px;color:#5d5a6b;margin-top:2px">${esc(label)}</div></td>`;
const stats = (cells: string[]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="margin:0 -6px 8px">${cells.reduce((rows, c, i) => (i % 3 === 0 ? rows + "<tr>" : rows) + c + (i % 3 === 2 || i === cells.length - 1 ? "</tr>" : ""), "")}</table>`;
const list = (items: string[]) => items.length ? `<ul style="padding-left:18px;margin:8px 0 0;font-size:15px;line-height:1.7">${items.map((x) => `<li>${x}</li>`).join("")}</ul>` : "";
const h = (t: string) => `<div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8a8698;margin:22px 0 4px">${esc(t)}</div>`;
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);
const plain = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<br\s*\/?>/g, "\n").replace(/<\/(p|div|li|tr|h\d)>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, "\n\n").trim();

function needsYou(s: EmailSummary) {
  return [
    s.notReached && `${s.notReached} first-timer${s.notReached === 1 ? "" : "s"} not reached yet${s.unassigned ? ` (${s.unassigned} with no one assigned)` : ""}`,
    s.joinersWaiting && `${s.joinersWaiting} ${s.joinersWaiting === 1 ? "person" : "people"} joined through Traqi and need confirming`,
    s.roleApprovals && `${s.roleApprovals} role change${s.roleApprovals === 1 ? "" : "s"} waiting for the pastor's approval`,
    s.welfareOpen && `${s.welfareOpen} welfare request${s.welfareOpen === 1 ? "" : "s"} open`,
    s.quiet && `${s.quiet} ${s.quiet === 1 ? "person has" : "people have"} missed 3 or more Sundays`,
  ].filter(Boolean) as string[];
}

/** 7:00 AM every day, to staff: what needs doing today. */
export function dailyEmail(s: EmailSummary, base: string, firstName: string): Email {
  const items = needsYou(s);
  const bd = s.birthdays.length ? `${h("Birthdays this week")}${list(s.birthdays.slice(0, 10).map(esc))}` : "";
  const ev = s.events.filter((e) => Date.parse(e.start) - Date.now() < 7 * 864e5);
  const evs = ev.length ? `${h("This week")}${list(ev.map((e) => `<b>${esc(e.title)}</b>, ${watDate(e.start)} at ${watTime(e.start)}: ${e.registered} registered`))}` : "";
  const body = (items.length ? `${h("Needs you today")}${list(items)}` : `<p style="font-size:15px">Nothing is waiting on you today. Thank you for staying on top of things.</p>`) + bd + evs;
  const html = frame(s, base, `Good morning, ${firstName}`, `Your day at ${esc(s.church.name)}`, body, { label: "Open Traqi", href: "/today" });
  return { subject: items.length ? `${items.length} thing${items.length === 1 ? "" : "s"} need you today · ${s.church.name}` : `Your day at ${s.church.name}`, html, text: plain(html) };
}

/** 7:00 AM on Mondays, to the lead pastor: last Sunday in one look. */
export function mondayEmail(s: EmailSummary, base: string, firstName: string): Email {
  const d = pct(s.attendance, s.attendancePrev);
  const body = `${stats([
    stat(s.attendance, "at church"), stat(`${d >= 0 ? "+" : ""}${d}%`, "on the Sunday before", d >= 0 ? "#047857" : "#be123c"), stat(s.firstTimersWeek, "first-timers this week"),
    stat(s.missed.leaders, "leaders missed"), stat(s.missed.workers, "workers missed"), stat(s.missed.members, "members missed"),
  ])}${s.goal ? `<p style="font-size:14px;color:#5d5a6b">Goal: ${s.goal}. ${s.attendance >= s.goal ? "You reached it." : `${s.goal - s.attendance} to go.`}</p>` : ""}
${needsYou(s).length ? `${h("This week")}${list(needsYou(s))}` : ""}
${s.events.length ? `${h("Coming up")}${list(s.events.slice(0, 4).map((e) => `<b>${esc(e.title)}</b>, ${watDate(e.start)}: ${e.registered} registered`))}` : ""}
${s.prayersWeek ? `<p style="font-size:15px;margin-top:18px">${s.prayersWeek} prayer request${s.prayersWeek === 1 ? "" : "s"} came in this week.</p>` : ""}`;
  const html = frame(s, base, `Sunday at a glance`, `${s.lastSunday ? day(s.lastSunday) : "Last Sunday"} · for ${esc(firstName)}`, body, { label: "See the full picture", href: "/today" });
  return { subject: `Last Sunday: ${s.attendance} at church${s.firstTimersWeek ? `, ${s.firstTimersWeek} first-timers` : ""} · ${s.church.name}`, html, text: plain(html) };
}

/** 8:00 PM on the last day of the month, to the lead pastor and admin. */
export function monthlyEmail(s: EmailSummary, base: string, firstName: string, month = new Date()): Email {
  const m = month.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Lagos" });
  const body = `${stats([
    stat(s.people, "people"), stat(s.serving, "serving"), stat(s.firstTimersMonth, "first-timers"),
    stat(s.classesFinishedMonth, "finished a class"), stat(s.attendance, "last Sunday"), stat(s.quiet, "gone quiet", s.quiet ? "#be123c" : "#17151f"),
  ])}
<p style="font-size:15px;line-height:1.6">The full report is ready in Traqi as an Excel file: people, first-timers, departments, Sundays and events. Download it from Settings, Your data. Every download is recorded, and care notes, welfare and prayer requests are never included.</p>`;
  const html = frame(s, base, `${m} report`, `For ${esc(firstName)}`, body, { label: "Download the Excel report", href: "/settings/church#data" });
  return { subject: `${m} report · ${s.church.name}`, html, text: plain(html) };
}

/** Days before an event, to people who registered with an email. */
export function eventReminderEmail(church: EmailSummary["church"], base: string, e: { title: string; start: string; venue?: string; mode?: string; link?: string; slug: string; theme?: string }, name: string, ticket: string): Email {
  const s = { church } as EmailSummary;
  const daysLeft = Math.round((new Date(e.start).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
  const when = daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
  const body = `<p style="font-size:16px;line-height:1.6">Hello ${esc(name.split(" ")[0])}, <b>${esc(e.title)}</b> is ${when}: ${watDate(e.start)} at ${watTime(e.start)}.</p>
${e.mode !== "virtual" && e.venue ? `<p style="font-size:15px">📍 ${esc(e.venue)}</p>` : ""}
${e.mode !== "physical" && e.link ? `<p style="font-size:15px">Watch online: <a href="${esc(e.link)}">${esc(e.link)}</a></p>` : ""}
<div style="margin-top:18px;padding:16px;border:2px dashed #ddd;border-radius:14px;text-align:center"><div style="font-size:12px;color:#8a8698;text-transform:uppercase;letter-spacing:1px">Your ticket</div><div style="font-size:26px;font-weight:800;letter-spacing:3px;margin-top:4px">${esc(ticket)}</div><div style="font-size:13px;color:#5d5a6b;margin-top:4px">Show this at the door</div></div>`;
  const html = frame(s, base, e.title, e.theme ? esc(e.theme) : `See you ${when}!`, body, { label: "Event details", href: `/${church.slug}/${e.slug}` });
  return { subject: `${e.title} is ${when}`, html, text: plain(html) };
}

export function testEmail(s: EmailSummary, base: string, firstName: string): Email {
  const html = frame(s, base, "Email is working", `Hello ${esc(firstName)}`, `<p style="font-size:15px;line-height:1.6">This is a test from Traqi for ${esc(s.church.name)}. If you can read this, emails are set up correctly.</p>`, { label: "Open Traqi", href: "/today" });
  return { subject: `Test email from Traqi · ${s.church.name}`, html, text: plain(html) };
}

/** Lagos-time scheduling rules. */
export function lagosNow(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
  const y = Number(parts.year), m = Number(parts.month), dd = Number(parts.day), hour = Number(parts.hour) % 24;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { hour, weekday: parts.weekday as string, isLastDayOfMonth: dd === lastDay, date: `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}` };
}
/** No emails between 10:00 PM and 6:00 AM WAT. */
export const quietHours = (hour: number) => hour >= 22 || hour < 6;
export const FREE_DAILY_CAP = 100;
