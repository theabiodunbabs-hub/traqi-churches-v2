// Round 8: the event page's colours, sections, ticket categories and the venue check-in code.
import { daysOf, lagosISO } from "./events";
import type { ChurchEvent, EventColors, EventLook, EventPage, TicketCategory } from "./types";

// ---------------- Colours ----------------
/** Template values stay as they were; each is now a look. */
export const lookOf = (e: Pick<ChurchEvent, "template">): EventLook => (e.template === "elegant" ? "editorial" : e.template === "bold" ? "bold" : "cinematic");
export const templateOf = (l: EventLook): NonNullable<ChurchEvent["template"]> => (l === "editorial" ? "elegant" : l === "bold" ? "bold" : "flyer");
export const LOOKS: { k: EventLook; name: string; says: string }[] = [
  { k: "cinematic", name: "Cinematic", says: "Dark and dramatic. Full-screen pictures, big confident type. Conferences, youth, nights of worship." },
  { k: "editorial", name: "Editorial", says: "Light and elegant, like a magazine. Serif headlines, lots of space. Summits, women's and couples' events." },
  { k: "bold", name: "Bold", says: "Huge type and strong colour blocks. Energetic. Concerts, crusades, outreach." },
];

// --- colour maths ---
const hex = (h: string) => { const x = h.replace("#", ""); const f = x.length === 3 ? x.split("").map((c) => c + c).join("") : x.padEnd(6, "0").slice(0, 6); return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0); };
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
function toHsl(h: string): [number, number, number] {
  const [r, g, b] = hex(h).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l * 100];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh * 60, s * 100, l * 100];
}
function fromHsl(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
/** WCAG relative luminance. */
export function luminance(h: string) {
  return hex(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a: string, b: string) { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
export const isDark = (h: string) => luminance(h) < 0.22;
/** Text that reads well on this colour. */
export const textOn = (h: string) => (contrast(h, "#ffffff") >= contrast(h, "#111111") ? "#ffffff" : "#111111");

/** Any colour code people paste: #7C3AED, 7c3aed, #73e, rgb(124, 58, 237), hsl(262 83% 58%). Null if it isn't one. */
export function parseColor(input: string): string | null {
  const v = input.trim().toLowerCase();
  let m = v.match(/^#?([0-9a-f]{6})$/); if (m) return `#${m[1]}`;
  m = v.match(/^#?([0-9a-f]{3})$/); if (m) return `#${m[1].split("").map((c) => c + c).join("")}`;
  m = v.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/); if (m) return toHex(+m[1], +m[2], +m[3]);
  m = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/); if (m) return fromHsl(+m[1], +m[2], +m[3]);
  return null;
}

/** Nudge a colour lighter or darker, keeping its hue, until it reads well against `on` (Fix it). */
export function fixFor(color: string, on: string, need = 4.5) {
  if (contrast(color, on) >= need) return color;
  const [h, s, l] = toHsl(color);
  const up = luminance(on) < 0.4;
  for (let i = 1; i <= 100; i++) {
    const c = fromHsl(h, s, Math.max(0, Math.min(100, l + (up ? i : -i))));
    if (contrast(c, on) >= need) return c;
  }
  return up ? "#ffffff" : "#111111";
}

/** The whole set from one main colour, shaped for the look. */
export function paletteFrom(main: string, look: EventLook): EventColors {
  const [h, s] = toHsl(main);
  if (look === "editorial") {
    // Paper: a warm off-white whatever the main colour, so it always reads like a magazine
    const bg = fromHsl(40, 30, 95), section = fromHsl(38, 24, 90);
    return { bg, section, button: fixFor(main, bg, 4.5), icon: fixFor(main, section, 3) };
  }
  if (look === "bold") {
    const bg = fromHsl(h, Math.min(s, 20), 97);
    return { bg, section: main, button: "#111111", icon: fixFor(main, bg, 3) };
  }
  const bg = fromHsl(h, Math.min(s, 45), 5), section = fromHsl(h, Math.min(s, 40), 10);
  return { bg, section, button: fixFor(main, bg, 3), icon: fromHsl(h, Math.max(s, 55), 74) };
}

/** Ready-made sets for each look, shown as small page previews. */
export const PALETTES: Record<EventLook, { name: string; c: EventColors }[]> = {
  cinematic: [
    { name: "Midnight Gold", c: { bg: "#07060d", section: "#141024", button: "#f5b544", icon: "#a78bfa" } },
    { name: "Neon Violet", c: { bg: "#0a0614", section: "#170d2e", button: "#a855f7", icon: "#22d3ee" } },
    { name: "Ember", c: { bg: "#0d0605", section: "#1e0e0a", button: "#ff6a3d", icon: "#ffc46b" } },
    { name: "Electric Teal", c: { bg: "#03100f", section: "#0a1f1e", button: "#2dd4bf", icon: "#fde047" } },
    { name: "Rose Noir", c: { bg: "#0f0609", section: "#1f0c14", button: "#f43f5e", icon: "#fda4af" } },
    { name: "Deep Ocean", c: { bg: "#040b17", section: "#0b1a30", button: "#38bdf8", icon: "#f0abfc" } },
  ],
  editorial: [
    { name: "Ivory and Plum", c: { bg: "#f5f1ea", section: "#ebe3d6", button: "#3b1f6e", icon: "#8a5a1f" } },
    { name: "Sand and Forest", c: { bg: "#f4f0e6", section: "#e7e0cf", button: "#1f4e3d", icon: "#9a6b2f" } },
    { name: "Paper and Ink Blue", c: { bg: "#f6f6f2", section: "#e9eae4", button: "#1d3a6e", icon: "#b2452c" } },
    { name: "Blush and Burgundy", c: { bg: "#fbf3f1", section: "#f3e3df", button: "#7a1f35", icon: "#b86b4b" } },
    { name: "Stone and Terracotta", c: { bg: "#f3f1ee", section: "#e6e2dc", button: "#a2482b", icon: "#3f4a3c" } },
  ],
  bold: [
    { name: "Citrus Punch", c: { bg: "#fffbea", section: "#facc15", button: "#111111", icon: "#ea580c" } },
    { name: "Cobalt Pop", c: { bg: "#f3f6ff", section: "#2546f0", button: "#111111", icon: "#2546f0" } },
    { name: "Hot Coral", c: { bg: "#fff5f2", section: "#ff5a4e", button: "#111111", icon: "#e23b2e" } },
    { name: "Lime and Black", c: { bg: "#0d0d0d", section: "#c6f432", button: "#c6f432", icon: "#c6f432" } },
    { name: "Sunset", c: { bg: "#fff7ed", section: "#f97316", button: "#4c1d95", icon: "#db2777" } },
  ],
};

/** The colours in use: set by hand, else made from the main colour (or the church colour) for the look. */
export function colorsOf(e: ChurchEvent, churchColor = "#4f46e5"): EventColors {
  return e.page?.colors ?? paletteFrom(e.page?.main ?? churchColor, lookOf(e));
}
export const ticketColorOf = (e: ChurchEvent, churchColor?: string) => colorsOf(e, churchColor).ticket || colorsOf(e, churchColor).button;
/** Problems a person would actually notice: text or buttons that are hard to read. */
export function contrastWarnings(c: EventColors): { text: string; fix: Partial<EventColors> }[] {
  const w: { text: string; fix: Partial<EventColors> }[] = [];
  if (contrast(c.button, c.bg) < 1.5) w.push({ text: "The buttons blend into the background.", fix: { button: fixFor(c.button, c.bg, 3) } });
  if (contrast(c.icon, c.section) < 2) w.push({ text: "The icons blend into the sections.", fix: { icon: fixFor(c.icon, c.section, 3) } });
  if (c.ticket && contrast(c.ticket, "#ffffff") < 2.5) w.push({ text: "White writing on the ticket colour is hard to read.", fix: { ticket: fixFor(c.ticket, "#ffffff", 3) } });
  return w;
}

/** The strongest colours in a picture (a flyer, say), most striking first, for "Colours from your flyer". */
export async function colorsFromImage(src: string, n = 5): Promise<string[]> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = 64; c.height = Math.max(1, Math.round((64 * img.naturalHeight) / img.naturalWidth));
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const bins = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const k = `${d[i] >> 5}-${d[i + 1] >> 5}-${d[i + 2] >> 5}`;
    const v = bins.get(k) ?? { r: 0, g: 0, b: 0, n: 0 };
    v.r += d[i]; v.g += d[i + 1]; v.b += d[i + 2]; v.n++; bins.set(k, v);
  }
  const all = [...bins.values()].map((v) => toHex(v.r / v.n, v.g / v.n, v.b / v.n));
  const score = (h: string) => { const [, s, l] = toHsl(h); return s * (1 - Math.abs(l - 50) / 60); };
  const counts = new Map([...bins.values()].map((v) => [toHex(v.r / v.n, v.g / v.n, v.b / v.n), v.n]));
  const ranked = all.sort((a, b) => score(b) * Math.log(1 + (counts.get(b) ?? 1)) - score(a) * Math.log(1 + (counts.get(a) ?? 1)));
  const out: string[] = [];
  for (const h of ranked) { if (out.every((o) => contrast(o, h) > 1.35 || Math.abs(toHsl(o)[0] - toHsl(h)[0]) > 25)) out.push(h); if (out.length >= n) break; }
  return out;
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
/** The pictures that make the headline: a picture (behind the title), a flyer (beside it), a carousel or a short video. */
export function headline(e: ChurchEvent): { kind: "video"; src: string; poster?: string } | { kind: "carousel"; slides: string[] } | { kind: "flyer" | "picture"; src?: string } {
  const m = e.page?.media;
  if (m?.kind === "video" && m.video) return { kind: "video", src: m.video, poster: e.flyer };
  if (m?.kind === "carousel" && (m.slides?.length ?? 0) > 0) return { kind: "carousel", slides: m.slides! };
  if (m?.kind === "picture" && e.flyer) return { kind: "picture", src: e.flyer };
  return { kind: "flyer", src: e.flyer };
}
export const MAX_VIDEO_MB = 15;
export const MEDIA_KEEP_DAYS = 14;
/** When the event's uploaded media is removed. */
export const mediaRemovedOn = (e: ChurchEvent) => new Date(Date.parse(e.end) + MEDIA_KEEP_DAYS * 864e5);
export const hasUploads = (e: ChurchEvent) => !e.page?.mediaCleared && !!(e.page?.media?.video || e.page?.media?.slides?.length || e.page?.host?.video || e.page?.host?.photos?.length);

// ---------------- Ticket categories ----------------
/** What people can choose here: the public ones that are live, plus a private one opened with its own link. */
export function categoriesFor(e: ChurchEvent, token?: string | null): TicketCategory[] {
  return (e.categories ?? []).filter((c) => c.live !== false && (!c.private || (!!token && c.token === token)));
}
export const categoryColor = (c: TicketCategory | undefined, e: ChurchEvent, churchColor?: string) => c?.color || ticketColorOf(e, churchColor);
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

// ---------------- Suggested words (the organiser can change or delete any) ----------------
/** Questions people usually ask, answered from the event's own settings. */
export function suggestedFaq(e: ChurchEvent): { q: string; a: string }[] {
  const d = daysOf(e)[0];
  const [h, m] = (d?.start ?? "10:00").split(":").map(Number);
  const early = ((h * 60 + m - 30) + 1440) % 1440;
  const t = (x: number) => { const hh = Math.floor(x / 60), mm = x % 60; return `${((hh + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${hh < 12 ? "AM" : "PM"}`; };
  const out = [
    { q: `Is ${e.title.split(":")[0].trim()} free?`, a: e.registration === false ? "Yes. It's free, and you don't need to register. Just come." : "Yes. It's free. Please register so we can prepare for you." },
    { q: "Who can come?", a: "Everyone is welcome, from any church. Bring a friend." },
  ];
  if (e.registration !== false) out.push({ q: "Can I register my friends?", a: "Yes. After you register, tap “Register someone else”. Everyone gets their own ticket." });
  if (e.mode !== "virtual") out.push({ q: "What time should I arrive?", a: `Doors open at ${t(early)}, 30 minutes before we start. Come early for a good seat.` });
  if (e.mode !== "physical") out.push({ q: "Will it be streamed?", a: e.mode === "virtual" ? "Yes. It's online only. Register and we'll send you the link and reminders." : "Yes. Register as Online and we'll send you the link and reminders." });
  return out;
}

/** "The experience": three cards for common kinds of event, to use as they are or edit. */
export const EXPERIENCE_IDEAS: { kind: string; cards: { title: string; body: string }[] }[] = [
  { kind: "Youth conference", cards: [{ title: "Worship that lifts you", body: "Nights in God's presence with the worship team and friends." }, { title: "Teaching you can use", body: "Purpose, career and relationships: real talk for real life." }, { title: "Friends for the journey", body: "Meet people who will pray with you long after it ends." }] },
  { kind: "Worship night", cards: [{ title: "Hours of worship", body: "No rush. Just worship, as long as the Spirit leads." }, { title: "Prayer and ministry", body: "Time to pray for one another and receive." }, { title: "Bring someone", body: "Come with a friend who needs a touch from God." }] },
  { kind: "Women's meeting", cards: [{ title: "Refreshing", body: "Worship, rest and time with God, away from the rush." }, { title: "Wisdom for life", body: "Honest teaching on faith, family, work and calling." }, { title: "Sisterhood", body: "Women who will stand with you and pray for you." }] },
  { kind: "Men's meeting", cards: [{ title: "Stand firm", body: "Straight talk on faith, leadership and responsibility." }, { title: "Brotherhood", body: "Men who will sharpen you and stand with you." }, { title: "Real questions", body: "Open conversations on work, money, family and purpose." }] },
  { kind: "Couples' night", cards: [{ title: "Time together", body: "An evening set apart for the two of you." }, { title: "Wisdom for marriage", body: "Practical teaching from couples who have walked the road." }, { title: "Laughter and good food", body: "Relax, enjoy, and leave closer than you came." }] },
  { kind: "Leadership summit", cards: [{ title: "Leading with character", body: "Teaching on integrity, vision and serving well." }, { title: "Practical sessions", body: "Workshops you can take back to your team on Monday." }, { title: "A network", body: "Meet leaders across churches and fields." }] },
  { kind: "Crusade or outreach", cards: [{ title: "The good news", body: "A clear message of hope in Jesus for everyone." }, { title: "Prayer for the sick", body: "We'll pray for healing, freedom and breakthrough." }, { title: "A new beginning", body: "Find a church family that will walk with you." }] },
];
