/** Builds the same numbers the server's email_summary gives, from what's in the app, for previews. */
import type { SeedState } from "../seed";
import type { EmailSummary } from "./templates";
import { missedLastSunday } from "../ask";
import { attendance, goneQuiet } from "../metrics";
import { daysToBirthday, fullName } from "../format";
import { sundaySeries } from "../domain";
import { kindOf } from "../journey";

export function summaryFromState(s: SeedState): EmailSummary {
  const people = s.people.filter((p) => !p.inactive && !p.isChild);
  const missed = missedLastSunday(s, people);
  const att = attendance(s);
  const series = sundaySeries(s);
  const month = new Date(); month.setDate(1);
  const ms = month.toISOString().slice(0, 10);
  return {
    church: { name: s.church.name, slug: s.church.slug, color: s.church.profile?.color, logo: s.church.profile?.logo },
    lastSunday: series.at(-1)?.date ?? null, attendance: att.last, attendancePrev: series.at(-2)?.total ?? 0, goal: att.goal,
    missed: { leaders: missed.filter((p) => p.isLeader || kindOf(p.stage) === "leader").length, workers: missed.filter((p) => !p.isLeader && kindOf(p.stage) === "worker").length,
      members: missed.filter((p) => !p.isLeader && !["worker", "leader"].includes(kindOf(p.stage))).length },
    quiet: goneQuiet(people).length,
    firstTimersWeek: s.cases.filter((c) => Date.now() - Date.parse(c.createdAt) < 7 * 864e5).length,
    firstTimersMonth: s.cases.filter((c) => c.createdAt >= ms).length,
    notReached: s.cases.filter((c) => c.stage === "new").length, unassigned: s.cases.filter((c) => c.stage === "new" && !c.assigneeId).length,
    joinersWaiting: people.filter((p) => p.joinedVia === "search" && !p.confirmedAt).length,
    roleApprovals: s.assignments.filter((a) => a.pending).length,
    welfareOpen: s.welfare.filter((w) => !["closed", "declined", "given"].includes(w.stage)).length,
    prayersWeek: s.prayers.filter((p) => Date.now() - Date.parse(p.at) < 7 * 864e5).length,
    birthdays: people.filter((p) => { const d = daysToBirthday(p.birthday); return d !== null && d < 7; }).map(fullName),
    events: s.events.filter((e) => e.status === "published" && Date.parse(e.start) > Date.now() && Date.parse(e.start) - Date.now() < 45 * 864e5)
      .map((e) => ({ title: e.title, start: e.start, slug: e.slug, registered: s.registrations.filter((r) => r.eventId === e.id && r.status === "confirmed").length })),
    classesFinishedMonth: s.enrolments.filter((e) => e.status === "completed" && (e.completedAt ?? "") >= ms).length,
    people: people.length, serving: people.filter((p) => ["worker", "leader"].includes(kindOf(p.stage))).length,
  };
}
