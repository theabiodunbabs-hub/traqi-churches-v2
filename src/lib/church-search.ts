/**
 * Finding a church by what people actually type: part of a name, an abbreviation (CAC, RCCG),
 * or a name with a typo. The live site does the same in the database (find_churches).
 */
import type { FoundChurch } from "./live";

const FILLER = new Set(["the", "of", "and", "in", "for", "a", "an"]);
const GENERIC = new Set(["church", "churches", "ministries", "ministry", "international", "chapel", "assembly", "centre", "center", "incorporated", "inc", "global"]);

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
export const acronym = (name: string) => words(name).filter((w) => !FILLER.has(w)).map((w) => w[0]).join("");
const core = (name: string) => words(name).filter((w) => !FILLER.has(w) && !GENERIC.has(w)).join(" ");

function bigrams(s: string) { const t = ` ${s} `; const out: string[] = []; for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2)); return out; }
/** Dice similarity of letter pairs: forgiving of small typos. */
export function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  const x = bigrams(a), y = bigrams(b); const m = new Map<string, number>();
  x.forEach((g) => m.set(g, (m.get(g) ?? 0) + 1));
  let hit = 0; y.forEach((g) => { const n = m.get(g); if (n) { hit++; m.set(g, n - 1); } });
  return (2 * hit) / (x.length + y.length);
}

export function scoreChurch(q: string, c: { name: string; slug: string; city?: string }) {
  const s = q.toLowerCase().trim();
  if (s.length < 2) return 0;
  const a = acronym(c.name), n = c.name.toLowerCase();
  const wordBest = Math.max(0, ...words(c.name).map((w) => similarity(w, s)));
  return Math.max(
    a === s ? 1 : a.startsWith(s) ? 0.8 : 0,
    n.includes(s) ? 0.9 : 0,
    c.slug === s ? 1 : 0,
    similarity(core(c.name), s),
    wordBest * 0.95,
    c.city ? similarity(c.city.toLowerCase(), s) * 0.6 : 0,
  );
}

export function rankChurches<T extends { name: string; slug: string; city?: string }>(q: string, list: T[], min = 0.4): T[] {
  return list.map((c) => ({ c, s: scoreChurch(q, c) })).filter((x) => x.s >= min).sort((a, b) => b.s - a.s).slice(0, 10).map((x) => x.c);
}

/** A few made-up churches so the demo's search has something to find. */
export const DEMO_CHURCHES: Omit<FoundChurch, "id">[] = [
  { name: "Christ Apostolic Church Oke-Ira", slug: "cac-okeira", city: "Ogba, Lagos", address: "12 Oke-Ira Road, Ogba", color: "#b91c1c", verified: true, branches: [] },
  { name: "Redeemed Christian Church of God, Grace Parish", slug: "rccg-grace", city: "Ikeja, Lagos", address: "4 Allen Avenue, Ikeja", color: "#1e3a8a", verified: true, branches: [] },
  { name: "Living Faith Church", slug: "lfc-ajah", city: "Ajah, Lagos", address: "Km 22 Lekki-Epe Expressway", color: "#15803d", verified: false, branches: [] },
  { name: "Harvest House Chapel", slug: "harvest-house", city: "Ibadan", address: "8 Ring Road, Ibadan", color: "#c2410c", verified: false, branches: [] },
  { name: "Grace Assembly International", slug: "grace-assembly", city: "Abuja", address: "Plot 10 Wuse II, Abuja", color: "#7c3aed", verified: true,
    branches: [{ id: "b1", name: "Grace Assembly Wuse", city: "Abuja" }, { id: "b2", name: "Grace Assembly Lekki", city: "Lagos" }, { id: "b3", name: "Grace Assembly Port Harcourt", city: "Port Harcourt" }] },
];
