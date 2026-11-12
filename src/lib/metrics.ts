import type { SeedState } from "./seed";
import type { FollowCase, Person, RoleKey } from "./types";
import { fullName, hoursSince } from "./format";

export const holdersOf = (s: SeedState, key: RoleKey) => {
  const ids = new Set(s.roles.filter((r) => r.key === key).map((r) => r.id));
  return [...new Set(s.assignments.filter((a) => ids.has(a.roleId)).map((a) => a.personId))];
};

export const followTeam = (s: SeedState) =>
  [...new Set(s.groups.filter((g) => g.tags?.includes("followup")).flatMap((g) => [...g.leaderIds, ...g.memberIds]))];

/**
 * Who a first-timer's follow-up currently rests with.
 * Up to 48 hrs: the worker. Then a day each: follow-up lead, overseeing pastor, lead pastor.
 */
export function escalation(s: SeedState, c: FollowCase): { level: 0 | 1 | 2 | 3; who?: Person; label: string } {
  const person = (id?: string) => s.people.find((p) => p.id === id);
  if (c.stage !== "new" || !c.assigneeId) return { level: 0, label: "" };
  const h = hoursSince(c.createdAt);
  const dept = s.groups.find((g) => g.tags?.includes("followup") && g.memberIds.includes(c.assigneeId!)) ?? s.groups.find((g) => g.tags?.includes("followup"));
  if (h <= 48) return { level: 0, who: person(c.assigneeId), label: "" };
  if (h <= 72) { const who = person(dept?.leaderIds[0]); return { level: 1, who, label: `Raised to ${who?.firstName ?? "the follow-up lead"}` }; }
  if (h <= 96) { const who = person(dept?.overseerId); return { level: 2, who, label: `Raised to Pastor ${who?.firstName ?? ""}`.trim() }; }
  const who = person(holdersOf(s, "lead")[0]);
  return { level: 3, who, label: `Raised to the lead pastor` };
}

/** Open follow-ups each team member is carrying, with an area match for suggestions. */
/** The follow-up team's settings, with sensible defaults: auto on, 5 open cases each, any gender. */
export function followSettings(s: SeedState) {
  const g = s.groups.find((x) => x.tags?.includes("followup"));
  return { auto: g?.followup?.auto ?? true, limit: g?.followup?.limit ?? 5, sameGender: g?.followup?.sameGender ?? false, groupId: g?.id };
}

/**
 * Who could follow someone up, best first: available people with the fewest open cases,
 * same area as a tiebreaker, and same gender first when the team asks for that.
 */
export function teamLoad(s: SeedState, forPerson?: Person) {
  const cfg = followSettings(s);
  return followTeam(s)
    .map((id) => {
      const p = s.people.find((x) => x.id === id)!;
      const open = s.cases.filter((c) => c.assigneeId === id && ["new", "contacted", "visited"].includes(c.stage)).length;
      const near = !!forPerson?.location && p?.location === forPerson.location;
      const sameGender = !!forPerson && p?.gender === forPerson.gender;
      const away = !!p?.unavailable;
      const full = open >= cfg.limit;
      return { person: p, open, near, sameGender, away, full, ok: !away && !full && (!cfg.sameGender || !forPerson || sameGender) };
    })
    .filter((x) => x.person)
    .sort((a, b) => Number(b.ok) - Number(a.ok) || a.open - b.open || Number(b.near) - Number(a.near)
      || fullName(a.person).localeCompare(fullName(b.person)));
}

/** The person auto-assign would choose, or nobody when auto is off or everyone is full or away. */
export function autoPick(s: SeedState, forPerson: Person) {
  if (!followSettings(s).auto) return undefined;
  return teamLoad(s, forPerson).find((x) => x.ok)?.person;
}

/** True when nobody on the follow-up team can take another case. */
export function teamFull(s: SeedState) {
  const t = teamLoad(s);
  return t.length > 0 && t.every((x) => x.away || x.full);
}

/** Of first-timers who visited 2 to 8 weeks ago, the share who have come back. A fair, settled cohort. */
export function cameBack(s: SeedState) {
  const cohort = s.cases.filter((c) => { const h = hoursSince(c.createdAt); return h >= 24 * 14 && h <= 24 * 56; });
  const back = cohort.filter((c) => ["returned", "in_class", "member"].includes(c.stage)).length;
  return { pct: cohort.length ? Math.round((back / cohort.length) * 100) : 0, back, of: cohort.length };
}

/** Last Sunday against the average of the four before it, plus progress to the goal. */
export function attendance(s: SeedState) {
  // Sunday headcounts (both services) when recorded; older weekly totals otherwise.
  const byDate = new Map<string, number>();
  s.meetings.filter((m) => m.kind === "sunday").forEach((m) => {
    const h = s.headcounts.find((x) => x.meetingId === m.id);
    if (h) byDate.set(m.date, (byDate.get(m.date) ?? 0) + h.men + h.women + h.children);
  });
  const series = byDate.size ? [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, n]) => n).slice(-8)
    : s.weeks.map((w) => w.first + w.second + w.children);
  const last = series.at(-1) ?? 0;
  const prev4 = series.slice(-5, -1);
  const avg = prev4.length ? prev4.reduce((a, b) => a + b, 0) / prev4.length : last;
  const best = series.length > 1 ? Math.max(...series.slice(0, -1)) : Infinity;
  return {
    last, series,
    vsAvg: Math.round(((last - avg) / Math.max(avg, 1)) * 100),
    goal: s.church.attendanceGoal,
    ofGoal: s.church.attendanceGoal ? Math.round((last / s.church.attendanceGoal) * 100) : null,
    isBest: last > best,
  };
}

/** Only people whose attendance we actually record can be called "gone quiet". */
export const goneQuiet = (people: Person[]) => people.filter((p) => p.tracked && !p.isChild && !p.inactive && p.missedInARow >= 3 && p.stage !== "first_timer");
