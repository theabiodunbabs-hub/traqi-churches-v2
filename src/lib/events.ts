/**
 * Events: the shape every page relies on, happening-now, links, the question library
 * with smart suggestions, and duplicating an event.
 */
import type { ChurchEvent, EventDay, EventPerson, EventQuestion, EventSession, RegType } from "./types";

/** Times are "HH:MM" in Lagos time; dates "YYYY-MM-DD". */
export const lagosISO = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+01:00`).toISOString();
const hm = (iso: string) => new Date(Date.parse(iso) + 36e5).toISOString().slice(11, 16);
const dateOf = (iso: string) => new Date(Date.parse(iso) + 36e5).toISOString().slice(0, 10);

/** The days of an event with their times, built from older events where needed. */
export function daysOf(e: ChurchEvent): EventDay[] {
  if (e.dayPlan?.length) return e.dayPlan;
  const startT = hm(e.start), endT = hm(e.end);
  return e.days.map((d) => ({ date: d, start: startT, end: endT }));
}

/** Everyone on the programme: new people list, or older speakers. */
export function peopleOf(e: ChurchEvent): EventPerson[] {
  if (e.people?.length) return e.people;
  return e.speakers.map((s, i) => ({ id: `sp${i}`, name: s.name, label: /worship|choir|music/i.test(s.role) ? "Music minister" : "Speaker", bio: s.role }));
}

export const themeOf = (e: ChurchEvent) => e.theme ?? e.tagline ?? "";
export const regTypesOf = (e: ChurchEvent): RegType[] => e.regTypes?.length ? e.regTypes : e.mode === "virtual" ? ["online"] : e.groupReg ? ["individual", "group", ...(e.mode === "hybrid" ? ["online" as const] : [])] : ["individual", ...(e.mode === "hybrid" ? ["online" as const] : [])];

/** Keep start, end and the list of dates in step with the day plan. */
export function withDayPlan(e: ChurchEvent, plan: EventDay[]): ChurchEvent {
  const sorted = [...plan].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return e;
  return { ...e, dayPlan: sorted, days: sorted.map((d) => d.date), start: lagosISO(sorted[0].date, sorted[0].start), end: lagosISO(sorted.at(-1)!.date, sorted.at(-1)!.end) };
}

/** What's on right now, for "Happening now" mode. */
export function happeningNow(e: ChurchEvent, now = Date.now()): { day?: EventDay; dayIndex: number; session?: EventSession; next?: EventSession } | null {
  const days = daysOf(e);
  const i = days.findIndex((d) => now >= Date.parse(lagosISO(d.date, d.start)) - 30 * 6e4 && now <= Date.parse(lagosISO(d.date, d.end)));
  if (i < 0) return null;
  const day = days[i];
  const ss = [...(day.sessions ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  const t = (s: EventSession) => Date.parse(lagosISO(day.date, s.start));
  const cur = [...ss].reverse().find((s) => t(s) <= now && (!s.end || Date.parse(lagosISO(day.date, s.end)) > now));
  const next = ss.find((s) => t(s) > now);
  return { day, dayIndex: i, session: cur, next };
}

export const isLiveNow = (e: ChurchEvent, now = Date.now()) => !!happeningNow(e, now);

/** The short public link: traqi.space/heirs/rise-2026 */
export const eventPath = (churchSlug: string, e: Pick<ChurchEvent, "slug">) => `/${churchSlug}/${e.slug}`;

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

/** A copy for next year (or next time): same look and programme, new dates, no registrations. */
export function duplicateEvent(e: ChurchEvent, id: string, by: string, shiftDays = 365): ChurchEvent {
  const shift = (d: string) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + shiftDays); return x.toISOString().slice(0, 10); };
  const plan = daysOf(e).map((d) => ({ ...d, date: shift(d.date) }));
  const yr = (s: string) => s.replace(/\b(20\d\d)\b/g, (y) => String(Number(y) + Math.round(shiftDays / 365)));
  const copy: ChurchEvent = {
    ...JSON.parse(JSON.stringify(e)), id, title: shiftDays >= 300 ? yr(e.title) : `${e.title} (copy)`, slug: shiftDays >= 300 ? yr(e.slug) : `${e.slug}-copy`,
    status: "draft", createdById: by, approvedById: undefined, createdAt: new Date().toISOString(), closesAt: undefined,
    coOrganisers: e.coOrganisers.map((c) => ({ ...c, status: "requested" as const })),
  };
  return withDayPlan(copy, plan);
}

// ---------------- Form builder: questions people often ask ----------------
export type Suggestion = EventQuestion & { why?: string; match?: RegExp };
const q = (id: string, label: string, type: EventQuestion["type"], extra: Partial<Suggestion> = {}): Suggestion => ({ id, label, type, ...extra });

export const QUESTION_LIBRARY: Suggestion[] = [
  q("member", "Are you a member of our church?", "yesno", { why: "Helps follow-up know who is new" }),
  q("heard", "How did you hear about this event?", "choice", { options: ["A friend or family member", "WhatsApp", "Instagram", "Facebook", "At church", "Flyer or banner", "Other"] }),
  q("church", "Which church do you attend?", "text", { why: "Useful when other churches are invited" }),
  q("first", "Is this your first time at this event?", "yesno"),
  q("age", "Age range", "choice", { options: ["Under 13", "13 to 17", "18 to 24", "25 to 34", "35 to 44", "45 and above"], match: /youth|teen|young|campus|singles|career/i }),
  q("tshirt", "T-shirt size", "choice", { options: ["S", "M", "L", "XL", "XXL", "XXXL"], match: /youth|conference|camp|retreat|run|walk|outreach|summit/i, perPerson: true }),
  q("stay", "Will you need accommodation?", "yesno", { match: /conference|convention|retreat|camp|summit|congress|days|week/i, why: "For multi-day events" }),
  q("diet", "Any food needs or allergies?", "text", { match: /dinner|retreat|camp|lunch|banquet|feast|picnic/i, perPerson: true }),
  q("spouse", "Spouse's name", "text", { match: /couple|marri|marriage|family|wedding|valentine/i }),
  q("anniv", "Wedding anniversary date", "date", { match: /couple|marri|marriage|valentine/i }),
  q("school", "School or workplace", "text", { match: /youth|campus|career|student|graduate/i }),
  q("career", "What do you do?", "choice", { options: ["Student", "Employed", "Self-employed / business", "Looking for work", "Other"], match: /career|business|summit|work|entrepreneur|leadership/i }),
  q("kids", "How many children are coming with you?", "number", { match: /family|children|kids|picnic|christmas|carol/i }),
  q("parent", "Parent or guardian's phone number", "phone", { match: /teen|children|kids|camp|youth/i, perPerson: true }),
  q("emergency", "Emergency contact (name and phone)", "text", { match: /camp|retreat|trip|travel|run|walk|hike/i }),
  q("transport", "Will you need transport to the venue?", "yesno", { match: /retreat|camp|trip|outreach|convention|congress/i }),
  q("prayer", "Anything you'd like us to pray about?", "long", { match: /prayer|vigil|healing|deliverance|night|fast|crusade|revival/i }),
  q("expect", "What are you trusting God for at this event?", "long", { match: /conference|convention|revival|encounter|crusade|congress/i }),
  q("volunteer", "Would you like to volunteer at this event?", "yesno"),
  q("gender", "Gender", "choice", { options: ["Male", "Female"], perPerson: true }),
];

/** The questions that suit this event, judged from its title, theme and length. */
export function suggestQuestions(e: ChurchEvent, have: EventQuestion[] = e.questions): Suggestion[] {
  const text = `${e.title} ${themeOf(e)} ${e.description}`;
  const taken = new Set(have.map((x) => x.label.toLowerCase()));
  const multiDay = daysOf(e).length > 1;
  const scored = QUESTION_LIBRARY.filter((s) => !taken.has(s.label.toLowerCase())).map((s) => {
    let score = s.match ? (s.match.test(text) ? 3 : 0) : 1;
    if (s.id === "stay" && multiDay) score += 3;
    if (s.id === "member" && e.followup) score += 1;
    return { s, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 6).map((x) => x.s);
}

/** Options are entered one per line, so commas inside an option are fine ("Yes, I will"). */
export const cleanOptions = (opts: string[]) => [...new Set(opts.map((o) => o.trim()).filter(Boolean))];

export const PERSON_LABELS = ["Speaker", "Minister", "Music minister", "Host", "Special guest", "Panelist", "Facilitator"];

/** Ticket codes are short, readable and hard to guess. */
export function ticketCode(e: Pick<ChurchEvent, "slug">) {
  const pre = e.slug.replace(/[^a-z]/g, "").slice(0, 4).toUpperCase() || "TQ";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const r = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(6)) : Array.from({ length: 6 }, () => Math.floor(Math.random() * 2 ** 32));
  for (const n of r) out += alphabet[n % alphabet.length];
  return `${pre}-${out}`;
}

export { hm as timeHM, dateOf };
