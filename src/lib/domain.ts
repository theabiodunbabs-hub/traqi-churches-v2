/**
 * Rules for attendance, welfare, classes, events, finance and notifications.
 * Pure functions over the church's data, shared by every screen.
 */
import { followSettings, teamFull } from "./metrics";
import type { SeedState } from "./seed";
import type { Access } from "./access";
import type { Attendance, ChurchEvent, ClassSession, Enrolment, Meeting, Person, Programme, ServiceSlot, WelfareRequest } from "./types";
import { addDays, at, lastSunday } from "./seed-more";
import { daysToBirthday, fullName, hoursSince, todayLagos } from "./format";
import { escalation, goneQuiet } from "./metrics";

// ---------------- Attendance ----------------

export const isSunday = (m: Meeting) => m.kind === "sunday";

/** Meetings from the schedule for the next few days that don't exist yet. */
export function upcomingFromSchedule(state: SeedState, days = 8): Meeting[] {
  const slots = state.church.profile?.services ?? [];
  const out: Meeting[] = [];
  const today = todayLagos();
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    slots.filter((s) => s.weekdays.includes(wd)).forEach((s) => {
      const id = `m-${date}-${s.id}`;
      if (state.meetings.some((m) => m.id === id)) return;
      out.push(meetingFromSlot(s, date));
    });
  }
  return out;
}

export function meetingFromSlot(s: ServiceSlot, date: string): Meeting {
  return {
    id: `m-${date}-${s.id}`, name: s.name, kind: s.kind, date, start: at(date, s.start), end: at(date, s.end), mode: s.mode,
    link: s.link, checkin: s.kind === "sunday" ? true : s.checkin, code: newCode(), slotId: s.id,
  };
}

export const newCode = () => String(1000 + Math.floor(Math.random() * 9000));

/** The gathering open for check-in right now: from 30 minutes before it starts until it ends. */
export function openMeeting(meetings: Meeting[], now = Date.now()) {
  return meetings
    .filter((m) => m.checkin && now >= Date.parse(m.start) - 30 * 6e4 && now <= Date.parse(m.end))
    .sort((a, b) => a.start.localeCompare(b.start))[0];
}
export function nextMeeting(meetings: Meeting[], now = Date.now(), kind?: Meeting["kind"]) {
  return meetings.filter((m) => Date.parse(m.end) >= now && (!kind || m.kind === kind)).sort((a, b) => a.start.localeCompare(b.start))[0];
}

/** Headcount totals per Sunday (both services), oldest first. */
export function sundaySeries(state: SeedState) {
  const byDate = new Map<string, { date: string; total: number; men: number; women: number; children: number; firstTimers: number; online: number }>();
  state.meetings.filter(isSunday).forEach((m) => {
    const h = state.headcounts.find((x) => x.meetingId === m.id);
    if (!h) return;
    const d = byDate.get(m.date) ?? { date: m.date, total: 0, men: 0, women: 0, children: 0, firstTimers: 0, online: 0 };
    d.men += h.men; d.women += h.women; d.children += h.children; d.firstTimers += h.firstTimers; d.online += h.online ?? 0;
    d.total += h.men + h.women + h.children;
    byDate.set(m.date, d);
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
}

export const checkinsFor = (state: SeedState, meetingId: string) => state.attendance.filter((a) => a.meetingId === meetingId);

/** A person's last 12 Sundays: true = came, false = missed, null = away or no service. */
export function sundayDots(state: SeedState, personId: string) {
  const dates = [...new Set(state.meetings.filter((m) => isSunday(m) && Date.parse(m.end) < Date.now()).map((m) => m.date))].sort().slice(-12);
  return dates.map((d) => {
    const ids = state.meetings.filter((m) => isSunday(m) && m.date === d).map((m) => m.id);
    const came = state.attendance.some((a) => a.personId === personId && ids.includes(a.meetingId));
    const away = state.away.some((w) => w.personId === personId && w.from <= d && w.to >= d);
    return { date: d, came, away };
  });
}

export const isAway = (state: SeedState, personId: string, date = todayLagos()) =>
  state.away.find((w) => w.personId === personId && w.from <= date && w.to >= date);

/** Gone quiet, leaving out people who told us they're away or who have moved. */
export const quietPeople = (state: SeedState, people: Person[]) =>
  goneQuiet(people).filter((p) => !p.inactive && !isAway(state, p.id));

export function record(meetingId: string, personId: string, method: Attendance["method"], id: string, status?: Attendance["status"]): Attendance {
  return { id, meetingId, personId, method, status, at: new Date().toISOString() };
}

// ---------------- Welfare ----------------

export const WELFARE_KINDS = ["Rent", "Medical", "Food", "School fees", "Bereavement", "Job loss", "Business support", "Other"];

/** Who should minute a new request, from who it's for. */
export function welfareRoute(state: SeedState, personId: string): { route: WelfareRequest["route"]; deptGroupId?: string; who: "member" | "worker" | "leader" | "pastor" } {
  const pastorRoles = new Set(state.roles.filter((r) => r.key === "pastor" || r.key === "lead").map((r) => r.id));
  if (state.assignments.some((a) => a.personId === personId && pastorRoles.has(a.roleId))) return { route: ["lead"], who: "pastor" };
  const p = state.people.find((x) => x.id === personId);
  const leaderRoles = new Set(state.roles.filter((r) => r.key === "admin" || r.key === "dept").map((r) => r.id));
  const isLeader = p?.isLeader || state.groups.some((g) => g.leaderIds.includes(personId)) || state.assignments.some((a) => a.personId === personId && leaderRoles.has(a.roleId));
  if (isLeader) return { route: ["pastorate"], who: "leader" };
  const dept = state.groups.find((g) => g.kind === "department" && g.memberIds.includes(personId) && !g.tags?.includes("welfare"));
  if (p?.stage === "worker" && dept) return { route: ["dept", "welfare", "pastorate"], deptGroupId: dept.id, who: "worker" };
  return { route: ["welfare", "pastorate"], who: "member" };
}

export const WELFARE_STAGE: Record<WelfareRequest["stage"], { label: string; tone: "neutral" | "brand" | "glow" | "good" | "alert" | "dark" }> = {
  dept: { label: "With department head", tone: "glow" }, welfare: { label: "With Welfare head", tone: "glow" },
  pastorate: { label: "With the pastorate", tone: "brand" }, lead: { label: "With the lead pastor", tone: "brand" },
  approved: { label: "Approved", tone: "good" }, declined: { label: "Not approved", tone: "neutral" },
  delivering: { label: "Being delivered", tone: "good" }, given: { label: "Support given", tone: "good" }, closed: { label: "Closed", tone: "neutral" },
};

/** The first stage a request starts at, skipping the department head for private requests. */
export function firstStage(route: WelfareRequest["route"], priv: boolean): WelfareRequest["stage"] {
  const r = priv ? route.filter((x) => x !== "dept") : route;
  return r[0];
}
export function nextStage(w: WelfareRequest): WelfareRequest["stage"] {
  const r = w.private ? w.route.filter((x) => x !== "dept") : w.route;
  const i = r.indexOf(w.stage as never);
  return (r[i + 1] ?? "pastorate") as WelfareRequest["stage"];
}

/** What this person can do on a request right now. */
export function welfareAction(state: SeedState, a: Access, w: WelfareRequest): "minute" | "decide" | "deliver" | "assign" | null {
  const limit = state.church.profile?.approvalLimit ?? 100000;
  const ask = Math.max(0, ...w.minutes.map((m) => m.amount ?? 0));
  if (w.stage === "dept" && w.deptGroupId && a.leads.has(w.deptGroupId) && !w.private) return "minute";
  if (w.stage === "welfare" && a.isWelfareHead) return "minute";
  if (w.stage === "pastorate" && a.isPastoral) return ask > limit && !a.isLead ? null : "decide";
  if (w.stage === "lead" && a.isLead) return "decide";
  if (w.stage === "approved" && w.involveWelfare && a.isWelfareHead) return "assign";
  if (w.stage === "approved" && !w.involveWelfare && a.isPastoral) return "deliver";
  if (w.stage === "delivering" && (w.assigneeId === a.personId || a.isWelfareHead || a.isPastoral)) return "deliver";
  return null;
}

/** Can this person see the request at all (mirrors the database rule). */
export function welfareVisible(a: Access, w: WelfareRequest) {
  if (a.isLead) return true;
  if (a.isPastoral && !w.route.includes("lead")) return true;
  if (a.isWelfareHead && w.route.includes("welfare")) return true;
  if (!w.private && w.route.includes("dept") && w.deptGroupId && a.leads.has(w.deptGroupId)) return true;
  if (w.assigneeId === a.personId) return true;
  return w.personId === a.personId || w.raisedById === a.personId;
}
/** The person who asked sees status only, never the minutes. */
export const welfareStaff = (a: Access, w: WelfareRequest) => welfareVisible(a, w) && !(w.personId === a.personId || w.raisedById === a.personId) || a.isLead;

// ---------------- Classes ----------------

export function progress(state: SeedState, e: Enrolment) {
  const prog = state.programmes.find((p) => p.id === e.programmeId)!;
  const sessions = state.sessions.filter((s) => s.programmeId === e.programmeId);
  const attended = new Map<string, Attendance["method"]>();
  state.attendance.filter((a) => a.personId === e.personId).forEach((a) => {
    const sess = sessions.find((x) => x.id === a.meetingId);
    if (!sess || (a.method === "recording" && !prog.recordingsCount)) return;
    // In the room or live online beats catching up by recording
    if (!attended.has(sess.moduleId) || attended.get(sess.moduleId) === "recording") attended.set(sess.moduleId, a.method);
  });
  const done = prog.modules.filter((m) => attended.has(m.id));
  return { prog, done, left: prog.modules.filter((m) => !attended.has(m.id)), ready: done.length >= prog.completeAfter, attended };
}

export const sessionMeeting = (s: ClassSession, p: Programme): Meeting => ({
  id: s.id, name: `${p.name}: ${p.modules.find((m) => m.id === s.moduleId)?.title ?? ""}`, kind: "class", date: s.date, start: s.start,
  end: new Date(Date.parse(s.start) + p.minutes * 6e4).toISOString(), mode: p.mode, venue: s.venue ?? p.venue, link: s.link ?? p.link, checkin: true, refId: p.id,
});

/** A Join click counts from 15 minutes before a virtual class until it ends. */
export function joinCounts(s: ClassSession, p: Programme, now = Date.now()) {
  const start = Date.parse(s.start);
  return now >= start - 15 * 6e4 && now <= start + p.minutes * 6e4;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const PROGRAMME_TINTS = [
  { bg: "bg-brand-soft", fg: "text-brand", bar: "bg-brand" },
  { bg: "bg-glow-soft", fg: "text-glow-ink", bar: "bg-glow" },
  { bg: "bg-good-soft", fg: "text-good", bar: "bg-good" },
  { bg: "bg-alert-soft", fg: "text-alert", bar: "bg-alert" },
];

// ---------------- Events ----------------

export const eventState = (e: ChurchEvent) =>
  e.status !== "published" ? e.status : Date.parse(e.end) < Date.now() ? "past" : Date.parse(e.start) <= Date.now() ? "live" : "upcoming";

export function eventCounts(state: SeedState, e: ChurchEvent) {
  const regs = state.registrations.filter((r) => r.eventId === e.id);
  const confirmed = regs.filter((r) => r.status === "confirmed");
  return {
    regs, confirmed, people: confirmed.reduce((n, r) => n + 1 + r.guests, 0),
    waitlist: regs.filter((r) => r.status === "waitlist").length, pending: regs.filter((r) => r.status === "pending").length,
    checkedIn: regs.filter((r) => r.checkins.length > 0).length, newContacts: regs.filter((r) => !r.personId).length,
  };
}

export const STATE_BADGE = {
  draft: { label: "Draft", tone: "neutral" }, pending: { label: "Waiting for approval", tone: "glow" }, upcoming: { label: "Open", tone: "good" },
  live: { label: "Happening now", tone: "alert" }, past: { label: "Ended", tone: "neutral" }, published: { label: "Open", tone: "good" },
} as const;
export const canCreateEvents = (a: Access) => a.can("events.manage") || a.isMediaHead || a.isLead;

// ---------------- Finance ----------------

export const lineTotal = (lines: { amount: number; currency: string }[], currency = "NGN") =>
  lines.filter((l) => l.currency === currency).reduce((n, l) => n + l.amount, 0);

export function financeByMonth(state: SeedState) {
  const months = new Map<string, { month: string; cash: number; transfer: number }>();
  state.counts.forEach((c) => {
    const m = state.meetings.find((x) => x.id === c.meetingId);
    if (!m) return;
    const k = m.date.slice(0, 7);
    const v = months.get(k) ?? { month: k, cash: 0, transfer: 0 };
    v.cash += lineTotal(c.correction?.status === "approved" ? c.correction.lines : c.lines);
    months.set(k, v);
  });
  state.transfers.forEach((t) => { const k = t.date.slice(0, 7); const v = months.get(k) ?? { month: k, cash: 0, transfer: 0 }; v.transfer += t.amount; months.set(k, v); });
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// ---------------- Notifications ----------------

export type Note = { key: string; title: string; body: string; href: string; tone: "alert" | "glow" | "brand" | "good"; at: string };

/** Everything waiting on this person, worked out from the church's data. */
export function notificationsFor(state: SeedState, a: Access, me: Person): Note[] {
  const out: Note[] = [];
  const sun = lastSunday();
  if (a.can("followup.assign")) {
    const waiting = state.cases.filter((c) => c.stage === "new" && !c.assigneeId && a.seesCase(c));
    if (waiting.length) out.push({ key: `assign-${waiting.length}`, title: `${waiting.length} first-timer${waiting.length > 1 ? "s" : ""} waiting to be assigned`, body: "Choose who will reach them.", href: "/first-timers", tone: "glow", at: waiting[0].createdAt });
    const cfg = followSettings(state);
    const fg = state.groups.find((g) => g.id === cfg.groupId);
    if (teamFull(state) && (a.isPastoral || fg?.leaderIds.includes(me.id))) out.push({ key: `full-${cfg.limit}-${waiting.length}`, title: "Everyone on follow-up is full",
      body: `Each person already has ${cfg.limit} open. Raise the limit or add people to the team.`, href: fg ? `/departments/${fg.id}?tab=followup` : "/first-timers", tone: "alert", at: new Date().toISOString() });
  }
  state.cases.filter((c) => c.stage === "new" && c.assigneeId).forEach((c) => {
    const e = escalation(state, c);
    const p = state.people.find((x) => x.id === c.personId);
    if (c.assigneeId === me.id && hoursSince(c.createdAt) <= 48) out.push({ key: `call-${c.id}`, title: `Call ${p?.firstName ?? "a first-timer"}`, body: "Assigned to you. Reach them within 48 hours.", href: `/people/${c.personId}`, tone: "brand", at: c.createdAt });
    else if (e.level > 0 && e.who?.id === me.id) out.push({ key: `esc-${c.id}-${e.level}`, title: `${p ? fullName(p) : "A first-timer"} hasn't been reached`, body: e.label, href: `/people/${c.personId}`, tone: "alert", at: c.createdAt });
  });
  state.welfare.forEach((w) => {
    const act = welfareAction(state, a, w);
    if (!act || !welfareVisible(a, w)) return;
    const p = state.people.find((x) => x.id === w.personId);
    const who = w.private && !welfareStaff(a, w) ? "Someone" : p?.firstName ?? "Someone";
    out.push({ key: `wf-${w.id}-${w.stage}`, title: act === "minute" ? "A welfare request needs your minute" : act === "decide" ? "A welfare request needs a decision" : act === "assign" ? "Approved support to assign" : "Support to deliver",
      body: `${who} · ${w.kind}${w.urgent ? " · urgent" : ""}`, href: `/welfare#${w.id}`, tone: w.urgent ? "alert" : "glow", at: w.createdAt });
  });
  if (a.isPastoral) state.events.filter((e) => e.status === "pending").forEach((e) => out.push({ key: `ev-${e.id}`, title: "An event needs your approval", body: e.title, href: `/events/${e.id}`, tone: "brand", at: e.createdAt }));
  if (a.handlesPlacement) state.placements.filter((x) => x.status === "open").forEach((x) => {
    const p = state.people.find((y) => y.id === x.personId);
    out.push({ key: `pl-${x.id}`, title: `${p?.firstName ?? "A member"} wants to serve`, body: state.groups.find((g) => g.id === x.groupId)?.name ?? "", href: "/today", tone: "good", at: x.at });
  });
  if (a.isLead) state.counts.filter((c) => c.correction?.status === "pending").forEach((c) => out.push({ key: `fc-${c.id}`, title: "A count correction needs your approval", body: c.correction!.reason, href: "/finance", tone: "glow", at: c.correction!.at }));
  // Journey: finished a class and waiting for a leader; probation periods that are over
  if (a.isPastoral || a.can("people.edit")) {
    const awaiting = state.people.filter((p) => p.awaitingStage && !p.inactive && a.can("people.edit", { personId: p.id }));
    if (awaiting.length) out.push({ key: `await-${awaiting.length}`, title: `${awaiting.length} ${awaiting.length === 1 ? "person" : "people"} ready for the next step`, body: "They finished the class. Confirm them to move them on.", href: "/settings/journey", tone: "brand", at: new Date().toISOString() });
  }
  const today = new Date().toISOString().slice(0, 10);
  const dueProb = state.people.filter((p) => p.probation && p.probation.until <= today && (a.isPastoral || state.groups.some((g) => g.id === p.probation!.groupId && g.leaderIds.includes(me.id))));
  if (dueProb.length) out.push({ key: `prob-${dueProb.length}-${today.slice(0, 7)}`, title: `${dueProb.length} probation${dueProb.length > 1 ? "s" : ""} ended`, body: "Confirm, extend, or ask them to step down.", href: "/settings/journey", tone: "glow", at: dueProb[0].probation!.until });
  // Role changes an admin proposed, waiting for the pastor
  const pendingRoles = state.assignments.filter((x) => x.pending);
  if (pendingRoles.length && a.isPastoral) out.push({ key: `roles-${pendingRoles.length}-${pendingRoles[0].pending!.at}`, title: `${pendingRoles.length} role change${pendingRoles.length > 1 ? "s" : ""} need your approval`,
    body: "An admin asked to give or remove roles.", href: "/settings/roles", tone: "glow", at: pendingRoles[0].pending!.at });
  // People who joined from search and are waiting for confirmation (reminders at 30 and 60 days)
  if (a.can("people.edit")) {
    const waiting = state.people.filter(isUnconfirmed);
    if (waiting.length) {
      const oldest = Math.max(...waiting.map(daysSinceJoined));
      const band = oldest >= 60 ? 60 : oldest >= 30 ? 30 : 0;
      out.push({ key: `joined-${waiting.length}-${band}`, title: `${waiting.length} ${waiting.length === 1 ? "person" : "people"} joined and ${waiting.length === 1 ? "isn't" : "aren't"} confirmed yet`,
        body: band ? `Some have waited over ${band} days. Accounts pause after 90.` : "Confirm them, or merge with records you already have.", href: "/people?joined=1", tone: band ? "alert" : "brand", at: waiting[0].firstVisit });
    }
  }
  // Classes tomorrow for teachers and students
  const tomorrow = addDays(new Date(Date.now() + 36e5).toISOString().slice(0, 10), 1);
  state.sessions.filter((s) => s.date === tomorrow && !s.cancelled).forEach((s) => {
    const p = state.programmes.find((x) => x.id === s.programmeId);
    const mine = s.teacherId === me.id || state.enrolments.some((e) => e.programmeId === s.programmeId && e.personId === me.id && e.status === "active");
    if (p && mine) out.push({ key: `cl-${s.id}`, title: `${p.name} is tomorrow`, body: p.modules.find((m) => m.id === s.moduleId)?.title ?? "", href: `/classes/${p.id}`, tone: "brand", at: s.start });
  });
  // Birthdays for people in my care, today
  if (a.can("people.view")) {
    const b = a.visiblePeople().filter((p) => p.id !== me.id && !p.isChild && daysToBirthday(p.birthday) === 0);
    if (b.length) out.push({ key: `bd-${todayLagos()}`, title: `${b.length} birthday${b.length > 1 ? "s" : ""} today`, body: b.slice(0, 3).map((p) => p.firstName).join(", "), href: "/messages", tone: "good", at: new Date().toISOString() });
    const quiet = quietPeople(state, a.visiblePeople());
    if (quiet.length && !a.isMemberOnly) out.push({ key: `q-${sun}-${quiet.length}`, title: `${quiet.length} people have gone quiet`, body: "Missed three Sundays or more.", href: "/people", tone: "glow", at: sun });
  }
  return out.sort((x, y) => y.at.localeCompare(x.at));
}

// ---------- People who joined from search ----------
export const isUnconfirmed = (p: Person) => p.joinedVia === "search" && !p.confirmedAt;
export const daysSinceJoined = (p: Person) => Math.floor((Date.now() - Date.parse(`${p.firstVisit}T12:00:00Z`)) / 864e5);
/** After 90 days without confirmation, member features pause until the admin confirms them. */
export const isLimited = (p: Person) => isUnconfirmed(p) && daysSinceJoined(p) >= 90;
