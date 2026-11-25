/**
 * Rules for attendance, welfare, classes, events, finance and notifications.
 * Pure functions over the church's data, shared by every screen.
 */
import { followSettings, isFollowLead, pastorMayAssign, teamFull } from "./metrics";
import type { SeedState } from "./seed";
import type { Access } from "./access";
import type { Attendance, ChurchEvent, ClassSession, Enrolment, Meeting, Person, Programme, ServiceSlot, Signer, OfferingType, Transfer, WelfareRequest } from "./types";
import { addDays, at, lastSunday } from "./seed-more";
import { daysToBirthday, fullName, hoursSince, todayLagos } from "./format";
import { actionsFor } from "./funds";
import { kindOf } from "./journey";
import { hasUploads, mediaRemovedOn } from "./event-page";
import { DUTY_LABEL, myEventDuties, nextDate, rsvpId } from "./event-mgmt";

const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const today0 = () => todayLagos();
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

/** Three plain statuses for lists: New, Being handled, Done. The detailed stage stays for the people deciding. */
export function welfareSimple(w: WelfareRequest): { label: "New" | "Being handled" | "Done"; tone: "glow" | "brand" | "good" | "neutral"; now?: string } {
  if (["given", "declined", "closed"].includes(w.stage)) return { label: "Done", tone: w.stage === "given" ? "good" : "neutral", now: w.stage === "given" ? "Support given" : w.stage === "declined" ? "Not approved" : "Closed" };
  const fresh = !w.minutes?.length && w.stage === firstStage(w.route, !!w.private);
  return { label: fresh ? "New" : "Being handled", tone: fresh ? "glow" : "brand", now: WELFARE_STAGE[w.stage].label };
}

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
    // The follow-up head is told at once; pastors only once nobody has been assigned for 24 hours
    const lead = isFollowLead(state, a);
    const waiting = state.cases.filter((c) => c.stage === "new" && !c.assigneeId && a.seesCase(c) && (lead || !a.isPastoral || pastorMayAssign(c)));
    if (waiting.length) out.push({ key: `assign-${waiting.length}`, title: `${waiting.length} first-timer${waiting.length > 1 ? "s" : ""} waiting to be assigned`, body: "Choose who will reach them.", href: "/first-timers", tone: "glow", at: waiting[0].createdAt });
    const cfg = followSettings(state);
    const fg = state.groups.find((g) => g.id === cfg.groupId);
    if (teamFull(state) && (a.isPastoral || fg?.leaderIds.includes(me.id))) out.push({ key: `full-${cfg.limit}-${waiting.length}`, title: "Everyone on follow-up is full",
      body: `Each person already has ${cfg.limit} open. Raise the limit or add people to the team.`, href: fg ? `/departments/${fg.id}?tab=followup` : "/first-timers", tone: "alert", at: new Date().toISOString() });
  }
  state.cases.filter((c) => c.stage === "new" && c.assigneeId).forEach((c) => {
    const e = escalation(state, c);
    const p = state.people.find((x) => x.id === c.personId);
    if ((c.assigneeId === me.id || c.helperIds?.includes(me.id)) && hoursSince(c.createdAt) <= 48) out.push({ key: `call-${c.id}`, title: `Call ${p?.firstName ?? "a first-timer"}`, body: "Assigned to you. Reach them within 48 hours.", href: `/people/${c.personId}`, tone: "brand", at: c.createdAt });
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
  state.placements.filter((x) => x.status === "open" && a.decidesPlacement(x)).forEach((x) => {
    const p = state.people.find((y) => y.id === x.personId);
    out.push({ key: `pl-${x.id}`, title: `${p?.firstName ?? "A member"} wants to join`, body: state.groups.find((g) => g.id === x.groupId)?.name ?? "", href: "/today", tone: "good", at: x.at });
  });
  if (a.isLead) state.counts.filter((c) => c.correction?.status === "pending").forEach((c) => out.push({ key: `fc-${c.id}`, title: "A count correction needs your approval", body: c.correction!.reason, href: "/finance", tone: "glow", at: c.correction!.at }));
  // Fund requests waiting on me, and my own requests that moved
  state.funds.filter((f) => !f.parentId && actionsFor(state, a, f).length).forEach((f) => out.push({ key: `fund-${f.id}-${f.stage}-${f.payments.length}-${!!f.report}`, title: f.stage === "paid" && f.report ? "A spending report needs checking" : f.stage === "approved" || f.stage === "paid" ? "A fund request is ready to pay" : "A fund request needs you", body: f.title, href: `/funds?id=${f.id}`, tone: "glow", at: f.history.at(-1)?.at ?? f.at }));
  state.funds.filter((f) => f.byId === me.id && (f.stage === "returned" || f.stage === "declined" || (f.stage === "paid" && !f.report && !f.refund))).forEach((f) => out.push({ key: `myfund-${f.id}-${f.stage}`, title: f.stage === "returned" ? "Your fund request was sent back" : f.stage === "declined" ? "Your fund request was declined" : "Send your spending report", body: f.title, href: `/funds?id=${f.id}`, tone: f.stage === "paid" ? "glow" : "alert", at: f.history.at(-1)?.at ?? f.at }));
  // Counselling: new requests for the pastor and his helpers; bookings for the member; referrals for whoever receives them
  const cs = state.church.profile?.counselling;
  const helpsPastor = !!cs?.delegates.some((d) => d.personId === me.id && d.perms.includes("manage"));
  state.counsel.forEach((r) => {
    if (r.status === "new" && r.personId !== me.id && ((a.isLead && !r.branchId) || (helpsPastor && !r.branchId))) out.push({ key: `cs-${r.id}`, title: r.urgency === "urgent" ? "Urgent counselling request" : "New counselling request", body: "Open to book a session", href: "/counselling", tone: r.urgency === "urgent" ? "alert" : "glow", at: r.at });
    else if ((r.status === "forwarded" || r.status === "referred") && r.handlerId === me.id) out.push({ key: `cs-${r.id}-${r.status}`, title: r.status === "referred" ? "A counselling request was referred to you" : "A counselling request was forwarded to you", body: "Open to book a session", href: "/counselling", tone: "glow", at: r.log.at(-1)?.at ?? r.at });
    else if (r.personId === me.id && r.status === "scheduled" && r.appt && r.appt.date >= today0()) out.push({ key: `csm-${r.id}-${r.appt.date}${r.appt.time}`, title: "Your counselling session is booked", body: `${r.appt.date} at ${r.appt.time}`, href: "/counselling", tone: "good", at: r.log.at(-1)?.at ?? r.at });
  });
  if (a.isPastoral || a.isAdmin) { const n = state.churchInvites.filter((i) => i.status === "new").length; if (n) out.push({ key: `ci-${n}`, title: `${n} invitation${n > 1 ? "s" : ""} to the church`, body: "Weddings, namings and more", href: "/invitations", tone: "brand", at: state.churchInvites.find((i) => i.status === "new")!.at }); }
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
  if (a.confirmsJoiners) {
    const waiting = state.people.filter(isUnconfirmed);
    if (waiting.length) {
      const oldest = Math.max(...waiting.map(daysSinceJoined));
      const band = oldest >= 60 ? 60 : oldest >= 30 ? 30 : 0;
      out.push({ key: `joined-${waiting.length}-${band}`, title: `${waiting.length} ${waiting.length === 1 ? "person" : "people"} joined and ${waiting.length === 1 ? "isn't" : "aren't"} confirmed yet`,
        body: band ? `Some have waited over ${band} days. Accounts pause after 90.` : "Confirm them, or merge with records you already have.", href: "/people?joined=1", tone: band ? "alert" : "brand", at: waiting[0].firstVisit });
    }
  }
  // Someone stopped being a department head: the admin decides whether they stay a Leader
  if (a.isAdmin || a.isLead) {
    state.people.filter((p) => p.formerHead && Date.now() - Date.parse(p.formerHead.at) < 30 * 864e5 && kindOf(p.stage) === "leader").forEach((p) => {
      const g = state.groups.find((x) => x.id === p.formerHead!.groupId);
      out.push({ key: `exhead-${p.id}-${p.formerHead!.at}`, title: `${fullName(p)} is no longer head of ${g?.name ?? "a department"}`,
        body: "They're still a Leader. Keep that, or change their stage on their profile.", href: `/people/${p.id}`, tone: "glow", at: p.formerHead!.at });
    });
    state.people.filter((p) => p.leftAll && Date.now() - Date.parse(p.leftAll.at) < 30 * 864e5 && kindOf(p.stage) === "worker"
      && !state.groups.some((g) => !g.tags?.includes("family") && g.memberIds.includes(p.id))).forEach((p) => {
      const g = state.groups.find((x) => x.id === p.leftAll!.groupId);
      out.push({ key: `leftall-${p.id}-${p.leftAll!.at}`, title: `${fullName(p)} no longer serves in any department`,
        body: `They left ${g?.name ?? "their last department"} and are still a Worker. Keep that, or change their stage on their profile.`, href: `/people/${p.id}`, tone: "glow", at: p.leftAll!.at });
    });
  }
  // Event pictures and videos are removed 14 days after the event: a notice first, to whoever made the event and the admin
  state.events.filter((e) => hasUploads(e) && (e.createdById === me.id || a.isAdmin)).forEach((e) => {
    const off = mediaRemovedOn(e).getTime();
    if (Date.now() < off - 4 * 864e5 || Date.now() > off) return;
    out.push({ key: `media-${e.id}`, title: `${e.title}: videos and pictures go soon`,
      body: `The headline video, carousel and host photos on its page are removed on ${new Date(off).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. Save any you want to keep. Registrations stay.`,
      href: `/events/${e.id}?edit=1`, tone: "glow", at: new Date(off - 4 * 864e5).toISOString() });
  });
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
    // "Gone quiet" is shown on Home and People, not in the bell: the bell is only for things to act on
  }
  // Events: committee appointments, committee meetings (new or changed), and check-in / follow-up duties
  for (const d of myEventDuties(state, me.id)) {
    const e = d.e;
    if (d.seat) {
      const added = e.committee?.members.find((m) => m.personId === me.id)?.addedAt ?? e.createdAt;
      out.push({ key: `cmt-${e.id}`, title: `You're on the ${e.title} committee`, body: `${d.seat}. Open the committee page for the brief, meetings and budget.`, href: `/events/${e.id}?tab=committee`, tone: "brand", at: added });
      if (d.next) out.push({ key: `cmm-${d.next.id}-${d.next.updatedAt ?? d.next.at}`, title: d.next.updatedAt ? `${e.title} committee meeting changed` : `${e.title} committee meeting`,
        body: `${dayLabel(d.next.date)} at ${d.next.time} · ${d.next.mode === "virtual" ? "Online" : d.next.venue || "Venue to be confirmed"}`, href: `/events/${e.id}?tab=committee`, tone: "glow", at: d.next.updatedAt ?? d.next.at });
    }
    if (d.duties.length) out.push({ key: `duty-${e.id}-${d.duties.join("")}`, title: `${e.title}: you're on the ${d.duties.map((x) => DUTY_LABEL[x].title.toLowerCase()).join(" and ")} team`,
      body: d.duties.includes("checkin") ? "Open it on the day to check people in from your phone." : "See who registered and reach out.", href: `/events/${e.id}?tab=door`, tone: "brand", at: e.createdAt });
  }
  // Department meetings set up or changed in the last two weeks that I haven't answered
  state.groups.filter((g) => g.memberIds.includes(me.id) || g.leaderIds.includes(me.id)).forEach((g) => (g.meetings ?? []).forEach((m) => {
    const date = nextDate(m); const when = m.updatedAt;
    if (!date || !when || m.byId === me.id || Date.now() - Date.parse(when) > 14 * 864e5) return;
    if (state.rsvps.some((r) => r.id === rsvpId("dept", m.id, date, me.id))) return;
    out.push({ key: `dm-${m.id}-${when}`, title: `${g.name}: ${m.title}`, body: `${dayLabel(date)} at ${m.time}. Will you be there?`, href: `/departments/${g.id}#meetings`, tone: "glow", at: when });
  }));
  // Course changes waiting for the owner's approval
  state.programmes.filter((x) => x.pendingEdit && approvesCourseEdit(x, a)).forEach((x) => out.push({ key: `pe-${x.id}`, title: `Approve a change to ${x.name}`, body: `${state.people.find((p) => p.id === x.pendingEdit!.byId)?.firstName ?? "Someone"} suggested changes.`, href: `/classes/${x.id}`, at: x.pendingEdit!.at, tone: "brand" } as Note));
  return out.sort((x, y) => y.at.localeCompare(x.at));
}

// ---------- People who joined from search ----------
/** Joined by themselves (search, an event, Sunday check-in, the church page) and waiting for the church to recognise them. They are members already. */
export const isUnconfirmed = (p: Person) => p.joinedVia === "search" && !p.confirmedAt && !p.notConfirmed && !p.removed;
export const daysSinceJoined = (p: Person) => Math.floor((Date.now() - Date.parse(`${p.firstVisit}T12:00:00Z`)) / 864e5);
/** After 90 days without confirmation, member features pause until the admin confirms them. */
/** No pause any more: people who joined keep member access whether or not they are confirmed. */
export const isLimited = (_p: Person) => false;

// ---------- Course words and certificate signers ----------
export const courseWords = (p?: Pick<Programme, "words">) => ({ course: p?.words?.course || "Course", part: p?.words?.part || "Lesson" });
export const plural = (w: string) => (/(s|x|ch|sh)$/i.test(w) ? `${w}es` : /[^aeiou]y$/i.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);
/** Older courses kept only titles ("Lead pastor"); newer ones keep the person, title and signature. */
export const signersOf = (p: Pick<Programme, "signers" | "signatories">): Signer[] => p.signers?.length ? p.signers : p.signatories.map((t) => ({ name: "", title: t }));

// ---------- Offering types ----------
/** The church's kinds of offering. Older churches only kept names; those are all counted by ushers. */
export const offeringTypes = (p?: { offeringTypes?: OfferingType[]; categories?: string[] }): OfferingType[] =>
  p?.offeringTypes?.length ? p.offeringTypes : (p?.categories ?? ["Offering", "Tithe"]).map((name) => ({ name, ushers: true }));
export const INCOME_METHODS: { k: NonNullable<Transfer["method"]>; label: string }[] = [
  { k: "transfer", label: "Bank transfer" }, { k: "cheque", label: "Cheque" }, { k: "pos", label: "POS" }, { k: "online", label: "Online giving" }, { k: "other", label: "Other" },
];

// ---------- Who may edit a course ----------
/**
 * The owner edits directly (faculty of training for its courses, family life for theirs). Faculty can also edit family life
 * courses and the pastorate any course, but those edits wait for the owner to approve. Family life can't edit faculty courses.
 */
export function courseEditRights(p: Pick<Programme, "owner">, a: { isPastoral: boolean; leadsTraining: boolean; leadsFamilyLife: boolean; can: (k: "classes.manage") => boolean }): "direct" | "approval" | "none" {
  const faculty = a.leadsTraining || a.can("classes.manage");
  if ((p.owner ?? "training") === "family") {
    if (a.leadsFamilyLife) return "direct";
    if (faculty || a.isPastoral) return "approval";
    return "none";
  }
  if (a.leadsTraining || (faculty && !a.isPastoral)) return "direct";
  if (a.isPastoral) return "approval";
  return "none";
}
/** Who approves an edit: the owner's side. */
export const approvesCourseEdit = (p: Pick<Programme, "owner">, a: { leadsTraining: boolean; leadsFamilyLife: boolean; can: (k: "classes.manage") => boolean; isPastoral: boolean }) =>
  (p.owner ?? "training") === "family" ? a.leadsFamilyLife : a.leadsTraining || (a.can("classes.manage") && !a.isPastoral);
