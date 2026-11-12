/**
 * What goes into each download. Phone numbers and addresses only appear for people
 * the downloader is allowed to see them for. Care notes, welfare and prayer requests never do.
 */
import type { SeedState } from "./seed";
import type { Access } from "./access";
import type { ChurchEvent, Person } from "./types";
import type { SheetSpec } from "./download";
import { stageView } from "./journey";
import { FOLLOW_STAGES, fullName } from "./format";
import { eventCounts, financeByMonth, lineTotal, sundaySeries } from "./domain";

const nm = (s: SeedState, id?: string) => { const p = s.people.find((x) => x.id === id); return p ? fullName(p) : ""; };
const deptsOf = (s: SeedState, id: string) => s.groups.filter((g) => g.memberIds.includes(id) || g.leaderIds.includes(id)).map((g) => g.name).join(", ");

/** Who may download what. */
export const canDownloadAll = (a: Access) => a.isLead || a.can("sheets.connect");
export const canDownloadGroup = (s: SeedState, a: Access, groupId: string) =>
  canDownloadAll(a) || s.groups.some((g) => (g.id === groupId || g.id === s.groups.find((x) => x.id === groupId)?.parentId) && g.leaderIds.includes(a.personId));

export function peopleSheet(s: SeedState, a: Access, people: Person[], name = "People"): SheetSpec<Person> {
  const fields = (s.church.profile?.customFields ?? []).filter((f) => !f.hidden);
  const contact = (p: Person) => a.canSeeContacts(p);
  return {
    name, rows: people,
    columns: [
      { key: "first", label: "First name", value: (p) => p.firstName },
      { key: "last", label: "Last name", value: (p) => p.lastName },
      { key: "gender", label: "Gender", value: (p) => (p.gender === "M" ? "Male" : "Female"), width: 9 },
      { key: "phone", label: "Phone", value: (p) => (contact(p) ? p.phone : "Hidden"), width: 16 },
      { key: "email", label: "Email", value: (p) => (contact(p) ? p.email : ""), width: 26 },
      { key: "area", label: "Area", value: (p) => (contact(p) ? p.location : ""), width: 16 },
      { key: "stage", label: "Stage", value: (p) => stageView(p.stage).name },
      { key: "depts", label: "Departments", value: (p) => deptsOf(s, p.id), width: 30 },
      { key: "birthday", label: "Birthday", value: (p) => p.birthday?.slice(5) },
      { key: "first_visit", label: "First visit", value: (p) => p.firstVisit, width: 12 },
      { key: "last_seen", label: "Last seen", value: (p) => p.lastSeen, width: 12 },
      { key: "missed", label: "Sundays missed in a row", value: (p) => (p.tracked ? p.missedInARow : "") },
      { key: "occupation", label: "Occupation", value: (p) => p.occupation },
      ...fields.map((f) => ({ key: `x_${f.id}`, label: f.label, value: (p: Person) => p.custom?.[f.id] })),
    ],
  };
}

export function firstTimersSheet(s: SeedState, a: Access): SheetSpec<SeedState["cases"][number]> {
  return {
    name: "First-timers", rows: [...s.cases].sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
    columns: [
      { key: "name", label: "Name", value: (c) => nm(s, c.personId), width: 24 },
      { key: "phone", label: "Phone", value: (c) => { const p = s.people.find((x) => x.id === c.personId); return p && a.canSeeContacts(p) ? p.phone : "Hidden"; }, width: 16 },
      { key: "first_visit", label: "First visit", value: (c) => c.createdAt.slice(0, 10), width: 12 },
      { key: "stage", label: "Follow-up stage", value: (c) => FOLLOW_STAGES.find((f) => f.key === c.stage)?.label ?? c.stage },
      { key: "assignee", label: "Following up", value: (c) => nm(s, c.assigneeId), width: 22 },
      { key: "contacts", label: "Calls and visits", value: (c) => c.contacts.length },
      { key: "heard", label: "Heard about us from", value: (c) => s.people.find((x) => x.id === c.personId)?.heardFrom, width: 22 },
    ],
  };
}

export function attendanceSheet(s: SeedState): SheetSpec<ReturnType<typeof sundaySeries>[number]> {
  return {
    name: "Sundays", rows: sundaySeries(s),
    columns: [
      { key: "date", label: "Date", value: (r) => r.date, width: 12 },
      { key: "total", label: "Total", value: (r) => r.total },
      { key: "men", label: "Men", value: (r) => r.men },
      { key: "women", label: "Women", value: (r) => r.women },
      { key: "children", label: "Children", value: (r) => r.children },
      { key: "ft", label: "First-timers", value: (r) => r.firstTimers },
      { key: "online", label: "Online", value: (r) => r.online },
    ],
  };
}

export function departmentsSheet(s: SeedState): SheetSpec<SeedState["groups"][number]> {
  return {
    name: "Departments", rows: s.groups,
    columns: [
      { key: "name", label: "Name", value: (g) => g.name, width: 28 },
      { key: "kind", label: "Kind", value: (g) => (g.kind === "unit" ? `Unit of ${s.groups.find((x) => x.id === g.parentId)?.name ?? ""}` : "Department"), width: 22 },
      { key: "head", label: "Head", value: (g) => g.leaderIds.map((id) => nm(s, id)).join(", "), width: 24 },
      { key: "pastor", label: "Overseeing pastor", value: (g) => nm(s, g.overseerId), width: 22 },
      { key: "size", label: "People", value: (g) => g.memberIds.length },
    ],
  };
}

export function registrationsSheet(s: SeedState, e: ChurchEvent): SheetSpec<SeedState["registrations"][number]> {
  const qs = e.questions ?? [];
  return {
    name: e.title.slice(0, 31), rows: eventCounts(s, e).regs,
    columns: [
      { key: "name", label: "Name", value: (r) => r.name, width: 24 },
      { key: "phone", label: "Phone", value: (r) => r.phone, width: 16 },
      { key: "email", label: "Email", value: (r) => r.email, width: 26 },
      { key: "ticket", label: "Ticket", value: (r) => r.ticket, width: 12 },
      { key: "status", label: "Status", value: (r) => r.status },
      { key: "guests", label: "Guests", value: (r) => r.guests },
      { key: "days", label: "Days", value: (r) => r.days.join(", "), width: 20 },
      { key: "member", label: "In the church", value: (r) => !!r.personId },
      { key: "checked", label: "Checked in", value: (r) => r.checkins.length > 0 },
      ...qs.map((q) => ({ key: `q_${q.id}`, label: q.label, value: (r: SeedState["registrations"][number]) => r.answers[q.id], width: 24 })),
      { key: "at", label: "Registered", value: (r) => r.at.slice(0, 16).replace("T", " "), width: 17 },
    ],
  };
}

export function eventsSheet(s: SeedState): SheetSpec<ChurchEvent> {
  return {
    name: "Events", rows: s.events,
    columns: [
      { key: "title", label: "Event", value: (e) => e.title, width: 30 },
      { key: "start", label: "Starts", value: (e) => e.start.slice(0, 16).replace("T", " "), width: 17 },
      { key: "end", label: "Ends", value: (e) => e.end.slice(0, 16).replace("T", " "), width: 17 },
      { key: "venue", label: "Venue", value: (e) => e.venue ?? (e.mode === "virtual" ? "Online" : ""), width: 24 },
      { key: "status", label: "Status", value: (e) => e.status },
      { key: "regs", label: "Registered", value: (e) => eventCounts(s, e).confirmed.length },
      { key: "people", label: "People coming", value: (e) => eventCounts(s, e).people },
      { key: "checked", label: "Checked in", value: (e) => eventCounts(s, e).checkedIn },
      { key: "new", label: "New contacts", value: (e) => eventCounts(s, e).newContacts },
    ],
  };
}

export function givingSheet(s: SeedState): SheetSpec<ReturnType<typeof financeByMonth>[number]> {
  return {
    name: "Giving by month", rows: financeByMonth(s),
    columns: [
      { key: "month", label: "Month", value: (r) => r.month, width: 10 },
      { key: "cash", label: "Cash counted", value: (r) => r.cash, width: 16 },
      { key: "transfer", label: "Transfers", value: (r) => r.transfer, width: 16 },
      { key: "total", label: "Total", value: (r) => r.cash + r.transfer, width: 16 },
    ],
  };
}

export function countsSheet(s: SeedState): SheetSpec<SeedState["counts"][number]> {
  return {
    name: "Service counts", rows: s.counts,
    columns: [
      { key: "service", label: "Service", value: (c) => { const m = s.meetings.find((x) => x.id === c.meetingId); return m ? `${m.date} ${m.name}` : ""; }, width: 30 },
      { key: "total", label: "Total (NGN)", value: (c) => lineTotal(c.correction?.status === "approved" ? c.correction.lines : c.lines), width: 14 },
      { key: "by", label: "Counted by", value: (c) => nm(s, c.byId), width: 22 },
      { key: "corr", label: "Correction", value: (c) => c.correction?.status ?? "" },
    ],
  };
}

/** Everything the lead pastor or admin can take away, one sheet per list. */
export function fullChurch(s: SeedState, a: Access): SheetSpec[] {
  const people = s.people.filter((p) => !p.inactive);
  const out: SheetSpec[] = [
    peopleSheet(s, a, people.filter((p) => !p.isChild)),
    peopleSheet(s, a, people.filter((p) => p.isChild), "Children"),
    firstTimersSheet(s, a),
    departmentsSheet(s),
    attendanceSheet(s),
    eventsSheet(s),
  ];
  if (a.canFinance) out.push(givingSheet(s), countsSheet(s) as SheetSpec);
  return out;
}

/** A department head's own department: its people, with units. */
export function departmentDownload(s: SeedState, a: Access, groupId: string): SheetSpec[] {
  const g = s.groups.find((x) => x.id === groupId);
  if (!g) return [];
  const units = s.groups.filter((u) => u.parentId === g.id);
  const ids = [...new Set([...g.leaderIds, ...g.memberIds, ...units.flatMap((u) => [...u.leaderIds, ...u.memberIds])])];
  const people = ids.map((id) => s.people.find((p) => p.id === id)!).filter(Boolean);
  return [peopleSheet(s, a, people, g.name), ...units.map((u) => peopleSheet(s, a, u.memberIds.map((id) => s.people.find((p) => p.id === id)!).filter(Boolean), u.name))];
}
