/**
 * Event management: who may do what on a committee, the teams for follow-up, registration and check-in,
 * ticket IDs (CH26-00125), committee and department meetings, and the numbers behind the committee's
 * briefing view. Pure functions over the church's data, shared by the screens, the notices and the tests.
 */
import type { SeedState } from "./seed";
import type {
  ChurchEvent, CommitteeMeeting, CommitteePerm, DeptMeeting, DutyTeam, EventDuty, EventQuestion, FundRequest, Group, Registration, Rsvp,
} from "./types";
import { linesTotal, paidOf, spentOf, totalOf } from "./funds";
import { digits } from "./format";

/** The parts of someone's access these rules need. */
export type Who = { personId: string; isPastoral: boolean; isAdmin: boolean; isLead?: boolean; can?: (p: "events.manage") => boolean };

export const COMMITTEE_PERMS: { k: CommitteePerm; label: string; says: string }[] = [
  { k: "team", label: "Team", says: "Add people to the committee and give them roles" },
  { k: "meetings", label: "Meetings", says: "Schedule and change committee meetings" },
  { k: "landing", label: "Event page", says: "Edit the event page and registration form" },
  { k: "budget", label: "Budgets", says: "Review budgets before they go to church finance" },
  { k: "checkin", label: "Check-in", says: "Choose who follows up, registers and checks people in" },
];

// ---------------- Committee rights ----------------

/** Who can do what on an event's committee. */
export function committeeRights(e: ChurchEvent, a: Who) {
  const c = e.committee;
  /** The pastorate and the admin appoint the committee, its head and assistant. */
  const picks = a.isPastoral || a.isAdmin;
  const heads = !!c && (c.headId === a.personId || c.assistantId === a.personId);
  const mine = c?.members.find((m) => m.personId === a.personId);
  const member = !!mine || heads;
  const financeLead = !!c && c.financeLeadId === a.personId;
  const regLead = e.regLeadId === a.personId;
  const can = (p: CommitteePerm) => picks || heads || !!mine?.perms?.includes(p) || (p === "budget" && financeLead) || (p === "checkin" && regLead);
  return { picks, heads, member, financeLead, regLead, sees: picks || member, can };
}

/** Someone who may change the event itself: its page, form, teams or meetings. */
export function managesEvent(s: SeedState, e: ChurchEvent, a: Who & { leads?: Set<string> }) {
  const r = committeeRights(e, a);
  const coOrg = e.coOrganisers.some((c) => c.status === "approved" && a.leads?.has(c.groupId));
  return !!a.can?.("events.manage") || a.isPastoral || e.createdById === a.personId || coOrg || r.heads || r.can("landing");
}

// ---------------- Teams: follow-up, registration, check-in ----------------

export const DUTY_LABEL: Record<EventDuty, { title: string; says: string }> = {
  followup: { title: "Follow-up", says: "Calls and welcomes people who registered, especially those new to the church" },
  registration: { title: "Registration support", says: "Helps people register and answers their questions" },
  checkin: { title: "Check-in", says: "Checks people in at the door on the day" },
};

const groupAndUnits = (groups: Group[], id: string) => groups.filter((g) => g.id === id || g.parentId === id);

/** Everyone on a team: all members (and heads) of its departments and their units, plus named people. */
export function teamOf(s: SeedState, team?: DutyTeam): string[] {
  if (!team) return [];
  const ids = new Set(team.personIds);
  team.groupIds.forEach((gid) => groupAndUnits(s.groups, gid).forEach((g) => [...g.leaderIds, ...g.memberIds].forEach((p) => ids.add(p))));
  return [...ids];
}
export const onDuty = (s: SeedState, e: ChurchEvent, personId: string, duty: EventDuty) => teamOf(s, e.duties?.[duty]).includes(personId);

/** May check people in: the pastorate, event managers, the committee's check-in managers, the Registration Lead and the check-in team. */
export function checksIn(s: SeedState, e: ChurchEvent, a: Who & { leads?: Set<string> }) {
  return managesEvent(s, e, a) || committeeRights(e, a).can("checkin") || onDuty(s, e, a.personId, "checkin");
}

/** May change who is on the teams: committee leadership, anyone with the check-in right, and the Registration Lead if allowed. */
export function managesTeams(e: ChurchEvent, a: Who) {
  const r = committeeRights(e, a);
  return r.picks || r.heads || !!e.committee?.members.find((m) => m.personId === a.personId)?.perms?.includes("checkin") || (r.regLead && e.regLeadAdds !== false);
}

const live = (e: ChurchEvent, now = Date.now()) => Date.parse(e.end) + 2 * 864e5 > now;

/** This person's jobs on upcoming events: committee seats and team duties. */
export function myEventDuties(s: SeedState, personId: string, now = Date.now()) {
  return s.events.filter((e) => live(e, now)).map((e) => {
    const c = e.committee;
    const seat = c && (c.headId === personId ? "Committee head" : c.assistantId === personId ? "Assistant head" : c.members.find((m) => m.personId === personId) ? (c.members.find((m) => m.personId === personId)!.role || "Committee member") : undefined);
    const duties = (["checkin", "followup", "registration"] as EventDuty[]).filter((d) => e.status === "published" && (onDuty(s, e, personId, d) || (d === "checkin" && e.regLeadId === personId)));
    return { e, seat, duties, next: nextCommitteeMeeting(e, now) };
  }).filter((x) => x.seat || x.duties.length).sort((a, b) => a.e.start.localeCompare(b.e.start));
}

// ---------------- Ticket IDs ----------------

/** "Charisma Conference 2026" gives CH26; the committee can choose its own. */
export function ticketPrefix(e: Pick<ChurchEvent, "title" | "start" | "ticketPrefix">) {
  const own = (e.ticketPrefix ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (own) return own;
  const letters = (e.title.match(/[A-Za-z]{2}/)?.[0] ?? "TQ").toUpperCase();
  return `${letters}${e.start.slice(2, 4)}`;
}
export const ticketId = (prefix: string, n: number) => `${prefix}-${String(n).padStart(5, "0")}`;
/** The next ticket for this event: one more than the highest so far. The database does the same, under a lock. */
export function nextTicket(e: ChurchEvent, regs: Pick<Registration, "eventId" | "ticket">[], plus = 0) {
  const pre = ticketPrefix(e);
  const re = new RegExp(`^${pre}-(\\d+)$`);
  const top = regs.filter((r) => r.eventId === e.id).reduce((m, r) => Math.max(m, Number(re.exec(r.ticket)?.[1] ?? 0)), 0);
  return ticketId(pre, top + 1 + plus);
}

// ---------------- Finding a registration at the door ----------------

export type Lookup = { by: "ticket" | "phone" | "email" | "name"; q: string };
/** Ticket IDs, phone numbers, emails, then names. */
export function lookupKind(raw: string): Lookup {
  const q = raw.trim();
  if (q.includes("@")) return { by: "email", q: q.toLowerCase() };
  if (/^[A-Za-z0-9]{2,6}-[A-Za-z0-9]{3,}$/.test(q)) return { by: "ticket", q: q.toUpperCase() };
  if (digits(q).length >= 7 && !/[a-z]{3,}/i.test(q)) return { by: "phone", q: digits(q).slice(-10) };
  return { by: "name", q: q.toLowerCase() };
}
export function findRegs(regs: Registration[], raw: string, limit = 8): Registration[] {
  const k = lookupKind(raw);
  if (!k.q) return [];
  const hit = regs.filter((r) =>
    k.by === "ticket" ? r.ticket.toUpperCase() === k.q
    : k.by === "phone" ? [r.phone, r.altPhone].some((n) => !!n && digits(n).slice(-10).endsWith(k.q))
    : k.by === "email" ? (r.email ?? "").toLowerCase() === k.q
    : k.q.length >= 3 && r.name.toLowerCase().includes(k.q));
  return hit.slice(0, limit);
}

/** Checked in on this day (and this session, when given)? */
export const isIn = (r: Registration, day: string, session?: string) => r.checkins.includes(day) && (!session || (r.sessions ?? []).includes(session));
/** Who checked them in, for "already checked in by Ada at 10:14". */
export const inMark = (r: Registration, day: string, session?: string) => [...(r.checkinLog ?? [])].reverse().find((m) => m.day === day && (!session || m.session === session));

// ---------------- Meetings ----------------

const todayISO = (now: number) => new Date(now + 36e5).toISOString().slice(0, 10);
const atOf = (date: string, time: string) => Date.parse(`${date}T${time || "00:00"}:00+01:00`);

/** The committee's next meeting that hasn't ended (allow two hours). */
export function nextCommitteeMeeting(e: ChurchEvent, now = Date.now()): CommitteeMeeting | undefined {
  return [...(e.committee?.meetings ?? [])].filter((m) => !m.cancelled && atOf(m.date, m.time) + 2 * 36e5 > now).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
}

/** A department meeting's next date: the programme's date, or the next matching weekday. */
export function nextDate(m: DeptMeeting, now = Date.now()): string | undefined {
  const today = todayISO(now);
  if (m.kind === "programme") return m.date && m.date >= today ? m.date : undefined;
  if (m.weekday === undefined) return undefined;
  const d = new Date(`${today}T12:00:00Z`);
  for (let i = 0; i < 7; i++) { if (d.getUTCDay() === m.weekday) return d.toISOString().slice(0, 10); d.setUTCDate(d.getUTCDate() + 1); }
  return undefined;
}
export const meetingMode = (m: { mode?: DeptMeeting["mode"]; venue?: string; link?: string }) => m.mode ?? (m.link && !m.venue ? "virtual" : m.link && m.venue ? "hybrid" : "physical");

export const rsvpId = (kind: Rsvp["kind"], meetingId: string, date: string, personId: string) => `${kind}|${meetingId}|${date}|${personId}`;
export function rsvpsFor(s: SeedState, kind: Rsvp["kind"], meetingId: string, date: string) {
  const list = s.rsvps.filter((r) => r.kind === kind && r.meetingId === meetingId && r.date === date);
  return { list, yes: list.filter((r) => r.answer === "yes"), no: list.filter((r) => r.answer === "no") };
}

// ---------------- Briefing: the smart committee meeting view ----------------

const find = (qs: EventQuestion[], re: RegExp) => qs.find((q) => re.test(q.label) || re.test(q.id));
const GENDER = /gender|\bsex\b/i;
const LOCATION = /where.*(from|live|coming|based)|location|city|\barea\b|state of|town|address/i;
const STAY = /accommodation|lodging|where to stay|need.*(room|stay)|\bstay\b/i;
const titleCase = (s: string) => s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const tally = (vals: string[]) => {
  const m = new Map<string, number>();
  vals.forEach((v) => { if (v) m.set(v, (m.get(v) ?? 0) + 1); });
  return [...m].sort((a, b) => b[1] - a[1]);
};

/** Everything the committee needs when briefing the Pastorate, in one place. */
export function briefing(s: SeedState, e: ChurchEvent, now = Date.now()) {
  const regs = s.registrations.filter((r) => r.eventId === e.id);
  const confirmed = regs.filter((r) => r.status === "confirmed");
  const people = confirmed.reduce((n, r) => n + 1 + (r.guests ?? 0), 0);
  const target = e.regTarget ?? e.capacity ?? 0;
  const person = (r: Registration) => (r.personId ? s.people.find((p) => p.id === r.personId) : undefined);

  // Gender: the form's question, or what the church already knows
  const gq = find(e.questions, GENDER);
  const genderOf = (r: Registration) => {
    const a = gq ? (r.answers[gq.id] ?? "") : "";
    if (/^(m|male|man|boy)$/i.test(a)) return "Male";
    if (/^(f|female|woman|girl)$/i.test(a)) return "Female";
    const p = person(r); return p ? (p.gender === "M" ? "Male" : "Female") : "Not given";
  };
  const gender = tally(confirmed.map(genderOf));
  const lq = find(e.questions, LOCATION);
  const locs = tally(confirmed.map((r) => titleCase((lq ? r.answers[lq.id] : "") || person(r)?.location?.split(",")[0] || "")));
  const locations = { top: locs.slice(0, 8), others: locs.slice(8).reduce((n, [, c]) => n + c, 0), unknown: confirmed.length - locs.reduce((n, [, c]) => n + c, 0) };
  const sq = find(e.questions.filter((q) => q.type === "yesno" || q.type === "choice"), STAY);
  const stay = sq ? confirmed.filter((r) => /^(yes|y|true)/i.test(r.answers[sq.id] ?? "")).length : undefined;
  // Every other question with choices, as a breakdown
  const used = new Set([gq?.id, lq?.id, sq?.id]);
  const answers = e.questions.filter((q) => !used.has(q.id) && ["choice", "yesno", "multi"].includes(q.type)).map((q) => ({
    q, counts: tally(confirmed.flatMap((r) => (r.answers[q.id] ?? "").split(" | ").filter(Boolean))),
    answered: confirmed.filter((r) => r.answers[q.id]).length,
  }));

  // Pace: registrations a day over the last week, and what's needed to reach the target in time
  const day = 864e5;
  const daysLeft = Math.max(0, Math.ceil((Date.parse(e.start) - now) / day));
  const trend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now + 36e5 - (13 - i) * day).toISOString().slice(0, 10);
    return { d, n: regs.filter((r) => new Date(Date.parse(r.at) + 36e5).toISOString().slice(0, 10) === d).length };
  });
  const lastWeek = regs.filter((r) => now - Date.parse(r.at) <= 7 * day).length;
  const pace = lastWeek / 7;
  const remaining = Math.max(0, target - people);

  // Check-in
  const inPerson = confirmed.filter((r) => r.type !== "online");
  const checkedIn = inPerson.filter((r) => r.checkins.length > 0).length;

  // Money: everything raised for this event, by where it is
  const funds = s.funds.filter((f) => f.eventId === e.id);
  const top = funds.filter((f) => !f.parentId);
  const sum = (fs: FundRequest[]) => fs.reduce((t, f) => t + totalOf(s, f), 0);
  const isApproved = (f: FundRequest) => ["approved", "paid", "closed"].includes(f.stage);
  const money = {
    submitted: { n: top.length, amount: sum(top) },
    budgets: { n: funds.filter((f) => !f.refund && !f.childIds?.length).length, amount: funds.filter((f) => !f.refund && !f.childIds?.length).reduce((t, f) => t + linesTotal(f.lines), 0) },
    atCommittee: sum(top.filter((f) => f.stage === "committee")),
    atFinance: sum(top.filter((f) => f.stage === "finance")),
    atPastor: sum(top.filter((f) => f.stage === "pastor")),
    returned: top.filter((f) => f.stage === "returned").length,
    approved: { n: top.filter(isApproved).length, amount: sum(top.filter(isApproved)) },
    deployed: top.reduce((t, f) => t + paidOf(f), 0),
    spent: top.reduce((t, f) => t + spentOf(f), 0),
    reportsDue: top.filter((f) => f.stage === "paid" && !f.report && !f.refund).length,
    target: e.targetBudget ?? 0,
  };

  const notes = s.eventNotes.filter((n) => n.eventId === e.id);
  return {
    regs, confirmed, people, target, pct: target ? people / target : 0, remaining,
    waitlist: regs.filter((r) => r.status === "waitlist").length, pending: regs.filter((r) => r.status === "pending").length,
    newToChurch: confirmed.filter((r) => !r.personId).length,
    types: tally(confirmed.map((r) => r.type ?? "individual")),
    gender, genderAsked: !!gq, locations, locationAsked: !!lq, stay, stayAsked: !!sq, answers,
    daysLeft, trend, pace, neededPerDay: daysLeft ? remaining / daysLeft : remaining, projected: Math.round(people + pace * daysLeft),
    checkin: { expected: inPerson.length, in: checkedIn, notYet: inPerson.length - checkedIn, pct: inPerson.length ? checkedIn / inPerson.length : 0 },
    money, notes: { total: notes.length, open: notes.filter((n) => (n.status ?? "open") === "open").length },
    next: nextCommitteeMeeting(e, now),
  };
}
export type Briefing = ReturnType<typeof briefing>;
