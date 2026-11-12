import type { FollowStage, Person, Stage } from "./types";
import { journeyStages, stageView } from "./journey";

/** The church's own journey stages (see journey.ts). */
export const STAGES_NOW = () => journeyStages();
export const stageInfo = (s: Stage) => stageView(s);
export const stageIndex = (s: Stage) => journeyStages().findIndex((x) => x.key === s);

export const FOLLOW_STAGES: { key: FollowStage; label: string; hint: string }[] = [
  { key: "new", label: "New", hint: "Not contacted yet" },
  { key: "contacted", label: "Contacted", hint: "Reached by call or WhatsApp" },
  { key: "visited", label: "Visited", hint: "Home or office visit done" },
  { key: "returned", label: "Came back", hint: "Second visit recorded" },
  { key: "in_class", label: "In class", hint: "Joined Foundation School" },
  { key: "member", label: "Member", hint: "Completed the journey" },
];

export const fullName = (p?: Pick<Person, "firstName" | "lastName">) => (p ? `${p.firstName} ${p.lastName}` : "Unassigned");
export const initials = (p?: Pick<Person, "firstName" | "lastName">) => (p ? `${p.firstName[0]}${p.lastName[0]}` : "?");

export function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  const w = Math.round(d / 7);
  return `${w} week${w === 1 ? "" : "s"} ago`;
}

export function hoursSince(iso: string) { return (Date.now() - new Date(iso).getTime()) / 36e5; }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDate(d?: string) {
  if (!d) return "";
  const [, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]}`;
}
export function longDate(d?: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/** Days until the next birthday (0 = today), or null. */
export function daysToBirthday(b?: string) {
  if (!b) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const [, m, d] = b.split("-").map(Number);
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < now) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - now.getTime()) / 864e5);
}

export function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function todayLong() {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(new Date());
}

export const digits = (phone: string) => phone.replace(/\D/g, "");
export const waLink = (phone: string, text: string) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`;
export const telLink = (phone: string) => `tel:+${digits(phone)}`;

export function completeness(p: Person) {
  const fields = [p.birthday, p.whatsapp, p.email, p.location, p.occupation];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export const CURRENCY_SYMBOL: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€", GHS: "GH₵", KES: "KSh", ZAR: "R", UGX: "USh", CAD: "C$" };
export function money(n: number, currency = "NGN", compact = false) {
  const sym = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  if (compact && Math.abs(n) >= 1e6) return `${sym}${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.0+$/, "")}m`;
  if (compact && Math.abs(n) >= 1e4) return `${sym}${Math.round(n / 1e3).toLocaleString("en-NG")}k`;
  return `${sym}${Math.round(n).toLocaleString("en-NG")}`;
}
/** Lagos time, AM/PM. */
export function timeOf(iso: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));
}
export function dayName(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "Africa/Lagos" }).format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));
}
export const todayLagos = () => new Date(Date.now() + 36e5).toISOString().slice(0, 10);
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-NG")} ${n === 1 ? one : many}`;
/** Fill a message template's blanks. */
export function fill(body: string, vars: Record<string, string | undefined>) {
  return body.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}
/** "07:30" → "7:30 AM" */
export const hhmm12 = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
