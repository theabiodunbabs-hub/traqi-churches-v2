/**
 * Ask Traqi, built in: ready-made questions plus a typed box that understands
 * everyday wording and spelling slips ("frist timers", "birthdys"). No AI needed.
 */
import type { SeedState } from "./seed";
import type { Access } from "./access";
import type { Person } from "./types";
import { attendance, cameBack, goneQuiet } from "./metrics";
import { daysToBirthday, fullName } from "./format";
import { eventCounts, eventState, financeByMonth, isAway } from "./domain";
import { kindOf } from "./journey";

export type Answer = { title: string; text: string; people?: Person[]; href?: string; number?: string };
type Intent = { key: string; words: string[][]; label: string; staffOnly?: boolean; finance?: boolean; run: (s: SeedState, a: Access) => Answer };

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const sundayIds = (s: SeedState) => {
  const done = s.meetings.filter((m) => m.kind === "sunday" && Date.parse(m.end) < Date.now()).sort((a, b) => b.date.localeCompare(a.date));
  const d = done[0]?.date;
  return { date: d, ids: done.filter((m) => m.date === d).map((m) => m.id) };
};

/** People who check in and weren't at church last Sunday (and didn't say they'd be away). */
export function missedLastSunday(s: SeedState, people: Person[]) {
  const { date, ids } = sundayIds(s);
  if (!date) return [];
  const came = new Set(s.attendance.filter((x) => ids.includes(x.meetingId)).map((x) => x.personId));
  return people.filter((p) => p.tracked && !p.isChild && !p.inactive && !came.has(p.id) && !isAway(s, p.id, date) && p.firstVisit < date);
}

export const INTENTS: Intent[] = [
  { key: "missed", label: "Who missed last Sunday?", words: [["missed", "absent", "miss", "didnt", "didn't", "not"], ["sunday", "service", "church"]], staffOnly: true,
    run: (s, a) => { const m = missedLastSunday(s, a.visiblePeople()); return { title: "Missed last Sunday", number: String(m.length), text: m.length ? `${m.length} people who usually check in weren't there. Leaders first.` : "Everyone who usually checks in was there.", people: m.sort((x, y) => rank(y) - rank(x)), href: "/people?missed=1" }; } },
  { key: "attendance", label: "How many came last Sunday?", words: [["attendance", "came", "many", "people", "turnout", "headcount"], ["sunday", "service", "last", "church"]],
    run: (s) => { const t = attendance(s); return t.series.length ? { title: "Last Sunday", number: String(t.last), text: `${t.last} people at church. ${t.vsAvg >= 0 ? "Up" : "Down"} ${Math.abs(t.vsAvg)}% on the 4-week average${t.goal ? `, goal ${t.goal}` : ""}.`, href: "/attendance" } : { title: "Last Sunday", text: "No headcount recorded yet.", href: "/attendance" }; } },
  { key: "firsttimers", label: "First-timers this month", words: [["first", "new", "visitors", "visitor", "firsttimers", "guests"], ["timers", "timer", "month", "visitors", "came", "people"]], staffOnly: true,
    run: (s) => { const since = new Date(); since.setDate(1); const c = s.cases.filter((x) => x.createdAt >= since.toISOString().slice(0, 10)); const b = cameBack(s);
      return { title: "First-timers this month", number: String(c.length), text: `${c.length} so far this month. ${b.of ? `${b.pct}% of earlier first-timers came back.` : ""}`, people: c.map((x) => s.people.find((p) => p.id === x.personId)!).filter(Boolean), href: "/first-timers" }; } },
  { key: "notreached", label: "Who hasn't been followed up?", words: [["followed", "follow", "reached", "called", "contacted"], ["not", "hasnt", "hasn't", "havent", "nobody", "up", "yet"]], staffOnly: true,
    run: (s) => { const c = s.cases.filter((x) => x.stage === "new"); return { title: "Not reached yet", number: String(c.length), text: c.length ? `${c.length} first-timers haven't been reached. ${c.filter((x) => !x.assigneeId).length} have no one assigned.` : "Every first-timer has been reached.", people: c.map((x) => s.people.find((p) => p.id === x.personId)!).filter(Boolean), href: "/first-timers" }; } },
  { key: "birthdays", label: "Birthdays this week", words: [["birthday", "birthdays", "born", "celebrating", "celebrate"]],
    run: (s, a) => { const b = a.visiblePeople().filter((p) => { const d = daysToBirthday(p.birthday); return d !== null && d <= 6; }).sort((x, y) => daysToBirthday(x.birthday)! - daysToBirthday(y.birthday)!);
      return { title: "Birthdays this week", number: String(b.length), text: b.length ? `${b.length} people celebrate this week.` : "No birthdays this week.", people: b }; } },
  { key: "quiet", label: "Who has gone quiet?", words: [["quiet", "stopped", "missing", "backslid", "lost", "away"], ["coming", "people", "gone", "who"]], staffOnly: true,
    run: (s, a) => { const q = goneQuiet(a.visiblePeople()).filter((p) => !isAway(s, p.id)); return { title: "Gone quiet", number: String(q.length), text: q.length ? `${q.length} people have missed 3 or more Sundays in a row.` : "No one has gone quiet.", people: q, href: "/people?quiet=1" }; } },
  { key: "workers", label: "How many workers do we have?", words: [["workers", "worker", "serving", "volunteers"]], staffOnly: true,
    run: (s) => { const w = s.people.filter((p) => !p.inactive && kindOf(p.stage) === "worker"); const l = s.people.filter((p) => !p.inactive && kindOf(p.stage) === "leader"); return { title: "Workers", number: String(w.length), text: `${w.length} workers and ${l.length} leaders.`, href: "/departments" }; } },
  { key: "members", label: "How many members?", words: [["members", "member", "congregation", "membership", "people"], ["many", "total", "count", "number", "how"]],
    run: (s) => { const act = s.people.filter((p) => !p.inactive && !p.isChild); const m = act.filter((p) => kindOf(p.stage) !== "visitor"); return { title: "Members", number: String(m.length), text: `${m.length} members, workers and leaders. ${act.length - m.length} visitors still getting to know the church.`, href: "/people" }; } },
  { key: "events", label: "Upcoming events", words: [["events", "event", "programmes", "programme", "program", "conference"], ["upcoming", "next", "coming", "registered", "registrations"]],
    run: (s) => { const e = s.events.filter((x) => ["upcoming", "live"].includes(eventState(x))).sort((x, y) => x.start.localeCompare(y.start));
      return { title: "Upcoming events", number: String(e.length), text: e.length ? e.slice(0, 3).map((x) => `${x.title}: ${eventCounts(s, x).people} coming`).join(" · ") : "No events coming up.", href: "/events" }; } },
  { key: "giving", label: "Giving this month", words: [["giving", "offering", "offerings", "tithe", "tithes", "money", "finance", "income"]], finance: true,
    run: (s) => { const m = financeByMonth(s); const cur = m.at(-1), prev = m.at(-2); if (!cur) return { title: "Giving", text: "Nothing recorded yet.", href: "/finance" };
      const t = cur.cash + cur.transfer, p = prev ? prev.cash + prev.transfer : 0; return { title: "Giving this month", number: naira(t), text: prev ? `${t >= p ? "Up" : "Down"} ${p ? Math.abs(Math.round(((t - p) / p) * 100)) : 0}% on last month.` : "First month recorded.", href: "/finance" }; } },
  { key: "class", label: "Who is in a class?", words: [["class", "classes", "foundation", "school", "training", "discipleship"]],
    run: (s) => { const e = s.enrolments.filter((x) => x.status === "active"); return { title: "In a class now", number: String(e.length), text: s.programmes.map((p) => `${p.name}: ${e.filter((x) => x.programmeId === p.id).length}`).join(" · "), href: "/classes" }; } },
];

const rank = (p: Person) => (p.isLeader || kindOf(p.stage) === "leader" ? 2 : kindOf(p.stage) === "worker" ? 1 : 0);

function lev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    // Swapped letters ("frist") count as one slip
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
/** Does any word in the question match this word, allowing a slip or two? */
const near = (tokens: string[], w: string) => tokens.some((t) => t === w || (w.length >= 4 && lev(t, w) <= (w.length >= 7 ? 2 : 1)));

/** Best match for a typed question, or null. */
export function understand(q: string, a: Access): Intent | null {
  const tokens = q.toLowerCase().replace(/first[\s-]*timers?/g, "firsttimers first timers").replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  let best: { i: Intent; score: number } | null = null;
  for (const i of allowed(a)) {
    const hits = i.words.filter((group) => group.some((w) => near(tokens, w))).length;
    const score = hits / i.words.length + (hits ? hits * 0.01 : 0);
    if (hits && (!best || score > best.score)) best = { i, score };
  }
  return best && best.score >= 0.5 ? best.i : null;
}

export const allowed = (a: Access) => INTENTS.filter((i) => (!i.staffOnly || !a.isMemberOnly) && (!i.finance || a.canFinance));

export function ask(s: SeedState, a: Access, q: string): Answer {
  const i = understand(q, a);
  if (!i) return { title: "I'm not sure yet", text: "Try one of the questions below, or ask about Sunday attendance, first-timers, birthdays, workers, events or classes." };
  const r = i.run(s, a);
  return { ...r, people: r.people?.slice(0, 30) };
}

export const fullNames = (ps: Person[]) => ps.map(fullName).join(", ");
