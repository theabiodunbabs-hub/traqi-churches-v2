// Round 8: the event page's colours, sections, ticket categories and the venue check-in code.
import { daysOf, lagosISO } from "./events";
import type { ChurchEvent, EventColors, EventPage, TicketCategory } from "./types";

// ---------------- Colours ----------------
/** Ready-made palettes: background, sections, buttons, icons. */
export const PALETTES: { name: string; c: EventColors }[] = [
  { name: "Midnight", c: { bg: "#0b0a14", section: "#16142a", button: "#7c5cff", icon: "#f5b544" } },
  { name: "Royal", c: { bg: "#120d2e", section: "#1d1648", button: "#f5b544", icon: "#a78bfa" } },
  { name: "Ember", c: { bg: "#170b08", section: "#26130d", button: "#ff6a3d", icon: "#ffb35c" } },
  { name: "Forest", c: { bg: "#08140f", section: "#10241b", button: "#34d399", icon: "#fbbf24" } },
  { name: "Ocean", c: { bg: "#06121f", section: "#0d2136", button: "#38bdf8", icon: "#f472b6" } },
  { name: "Ivory", c: { bg: "#fbf8f2", section: "#ffffff", button: "#1f1a14", icon: "#b8862f" } },
  { name: "Blush", c: { bg: "#fff6f5", section: "#ffffff", button: "#e11d63", icon: "#7c3aed" } },
  { name: "Clean", c: { bg: "#f6f7fb", section: "#ffffff", button: "#4f46e5", icon: "#0ea5e9" } },
];

const hex = (h: string) => { const x = h.replace("#", ""); const f = x.length === 3 ? x.split("").map((c) => c + c).join("") : x.padEnd(6, "0").slice(0, 6); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0); };
/** WCAG relative luminance. */
export function luminance(h: string) {
  return hex(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a: string, b: string) { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
export const isDark = (h: string) => luminance(h) < 0.22;
/** Text that reads well on this colour. */
export const textOn = (h: string) => (contrast(h, "#ffffff") >= contrast(h, "#111111") ? "#ffffff" : "#111111");

/** The colours in use: the organiser's, else the church colour on a dark page. */
export function colorsOf(e: ChurchEvent, churchColor = "#4f46e5"): EventColors {
  return e.page?.colors ?? { bg: "#0b0a14", section: "#16142a", button: churchColor, icon: churchColor };
}
/** Problems a person would actually notice: text or buttons that are hard to read. */
export function contrastWarnings(c: EventColors): string[] {
  const w: string[] = [];
  if (contrast(c.bg, textOn(c.bg)) < 4.5) w.push("The background makes text hard to read.");
  if (contrast(c.section, textOn(c.section)) < 4.5) w.push("The section colour makes text hard to read.");
  if (contrast(c.button, textOn(c.button)) < 3) w.push("The button text is hard to read on that button colour.");
  if (contrast(c.button, c.bg) < 1.6) w.push("The buttons blend into the background.");
  if (contrast(c.icon, c.section) < 1.8) w.push("The icons blend into the sections.");
  return w;
}

// ---------------- Sections ----------------
export type OptionalKey = "partners" | "host" | "experience" | "speakers" | "programme" | "online" | "testimonials" | "faq" | "extras" | "share";
export const OPTIONAL_SECTIONS: { k: OptionalKey; label: string; hint: string }[] = [
  { k: "partners", label: "Partners", hint: "Logos of the people and brands helping" },
  { k: "host", label: "Host welcome", hint: "A letter from the host, with photos or a short video" },
  { k: "experience", label: "The experience", hint: "Three cards: what people will experience" },
  { k: "speakers", label: "Speakers", hint: "Sliding cards with photos and bios" },
  { k: "programme", label: "Programme", hint: "Day by day, session by session" },
  { k: "online", label: "Join online", hint: "QR code, link and steps. Shows by itself when there's an online link" },
  { k: "testimonials", label: "Testimonials", hint: "Real words from people who came before, with names" },
  { k: "faq", label: "Questions and answers", hint: "What people usually ask" },
  { k: "extras", label: "Your own sections", hint: "Up to four, with a picture and a button" },
  { k: "share", label: "Share", hint: "“Know someone who should be here?” with WhatsApp and Copy link" },
];
export const MAX_EXTRAS = 4;

/** Whether an optional section has something in it (only filled sections go live). */
export function sectionFilled(e: ChurchEvent, k: OptionalKey): boolean {
  const p: EventPage = e.page ?? {};
  switch (k) {
    case "partners": return !!e.partners?.length && !!e.showPartners;
    case "host": return !!p.host?.letter?.trim();
    case "experience": return (p.experience ?? []).some((x) => x.title.trim());
    case "speakers": return !!e.people?.length || !!e.speakers?.length;
    case "programme": return daysOf(e).some((d) => d.sessions?.length) || e.schedule.length > 0;
    case "online": return e.mode !== "physical" && !!e.link?.trim();
    case "testimonials": return (p.testimonials ?? []).some((t) => t.quote.trim() && t.name.trim());
    case "faq": return !!e.faq?.some((f) => f.q.trim());
    case "extras": return (p.extras ?? []).some((x) => x.title.trim());
    case "share": return p.share !== false;
  }
}

/** The pictures that make the headline: the video, the carousel, else the flyer. */
export function headline(e: ChurchEvent): { kind: "video"; src: string; poster?: string } | { kind: "carousel"; slides: string[] } | { kind: "flyer"; src?: string } {
  const m = e.page?.media;
  if (m?.kind === "video" && m.video) return { kind: "video", src: m.video, poster: e.flyer };
  if (m?.kind === "carousel" && (m.slides?.length ?? 0) > 0) return { kind: "carousel", slides: m.slides! };
  return { kind: "flyer", src: e.flyer };
}
export const MAX_VIDEO_MB = 10;
export const MEDIA_KEEP_DAYS = 14;
/** When the event's uploaded media is removed. */
export const mediaRemovedOn = (e: ChurchEvent) => new Date(Date.parse(e.end) + MEDIA_KEEP_DAYS * 864e5);
export const hasUploads = (e: ChurchEvent) => !e.page?.mediaCleared && !!(e.page?.media?.video || e.page?.media?.slides?.length || e.page?.host?.video || e.page?.host?.photos?.length);

// ---------------- Ticket categories ----------------
/** What people can choose here: the public ones that are live, plus a private one opened with its own link. */
export function categoriesFor(e: ChurchEvent, token?: string | null): TicketCategory[] {
  return (e.categories ?? []).filter((c) => c.live !== false && (!c.private || (!!token && c.token === token)));
}
export const categoryColor = (c: TicketCategory | undefined, e: ChurchEvent, churchColor?: string) => c?.color || colorsOf(e, churchColor).button;
export const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");

// ---------------- Check-in at the venue ----------------
/** Each day's window: an hour before it starts until it ends (Lagos time). */
export function inEventHours(e: ChurchEvent, now = Date.now()) {
  return daysOf(e).some((d) => now >= Date.parse(lagosISO(d.date, d.start)) - 36e5 && now <= Date.parse(lagosISO(d.date, d.end)));
}
/** Small, stable hash for the demo (the live site computes codes in the database). */
function h(s: string) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(-6); }
/** The printed code: the same for the whole event, accepted only during event hours. */
export const printedCode = (secret: string) => `P${h(`${secret}|printed`).slice(0, 5)}`;
/** The screen code: changes every minute. The one before is still accepted, so nobody is caught mid-scan. */
export const screenCode = (secret: string, at = Date.now()) => `S${h(`${secret}|${Math.floor(at / 6e4)}`).slice(0, 5)}`;
export function codeOk(e: ChurchEvent, code: string, now = Date.now()): "ok" | "closed" | "bad" {
  const v = e.venueCheckin;
  if (!v?.on) return "bad";
  const k = code.trim().toUpperCase();
  const good = (v.printed && k === printedCode(v.secret)) || (v.screen && (k === screenCode(v.secret, now) || k === screenCode(v.secret, now - 6e4)));
  if (!good) return "bad";
  return inEventHours(e, now) ? "ok" : "closed";
}
/** "Grace A••••": enough for someone to recognise themselves. */
export function maskName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.join(" ");
  return last ? `${first} ${last[0]}${"•".repeat(Math.min(4, Math.max(2, last.length - 1)))}` : `${first.slice(0, 2)}${"•".repeat(3)}`;
}
export const venuePath = (churchSlug: string, e: Pick<ChurchEvent, "slug">, code: string) => `/${churchSlug}/${e.slug}/here?k=${encodeURIComponent(code)}`;
