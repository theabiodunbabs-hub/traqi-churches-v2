/** Branches: how each one is doing, for the league table. */
import type { SeedState } from "./seed";
import type { Branch } from "./types";
import { kindOf } from "./journey";

export type BranchRow = { id: string; name: string; city?: string; people: number; lastSunday: number; firstTimers: number; cameBack: number | null; serving: number; growth: number };

export function branchStats(s: SeedState): BranchRow[] {
  const branches: (Branch | { id: undefined; name: string; city?: string })[] = [{ id: undefined, name: "Headquarters", city: s.church.profile?.city }, ...(s.church.profile?.branches ?? [])];
  const sundays = s.meetings.filter((m) => m.kind === "sunday" && Date.parse(m.end) < Date.now()).sort((a, b) => b.date.localeCompare(a.date));
  const last = sundays[0]?.date;
  const lastIds = new Set(sundays.filter((m) => m.date === last).map((m) => m.id));
  const monthStart = new Date(); monthStart.setDate(1);
  const ms = monthStart.toISOString().slice(0, 10);
  const prev = new Date(monthStart); prev.setMonth(prev.getMonth() - 1);
  const ps = prev.toISOString().slice(0, 10);
  return branches.map((b) => {
    const people = s.people.filter((p) => !p.inactive && !p.isChild && (p.branchId ?? undefined) === b.id);
    const ids = new Set(people.map((p) => p.id));
    const came = new Set(s.attendance.filter((a) => lastIds.has(a.meetingId) && ids.has(a.personId)).map((a) => a.personId));
    const ft = s.cases.filter((c) => ids.has(c.personId));
    const thisMonth = ft.filter((c) => c.createdAt >= ms).length;
    const lastMonth = ft.filter((c) => c.createdAt >= ps && c.createdAt < ms).length;
    const old = ft.filter((c) => Date.now() - Date.parse(c.createdAt) > 14 * 864e5);
    const back = old.filter((c) => ["returned", "member", "in_class"].includes(c.stage)).length;
    const serving = people.filter((p) => ["worker", "leader"].includes(kindOf(p.stage))).length;
    return { id: b.id ?? "hq", name: b.name, city: b.city, people: people.length, lastSunday: came.size, firstTimers: thisMonth,
      cameBack: old.length ? Math.round((back / old.length) * 100) : null, serving: people.length ? Math.round((serving / people.length) * 100) : 0,
      growth: thisMonth - lastMonth };
  });
}

export const branchName = (s: SeedState, id?: string) => (id ? s.church.profile?.branches?.find((b) => b.id === id)?.name : undefined) ?? "Headquarters";
