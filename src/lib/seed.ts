import type {
  Church, Placement, PendingContact, Activity, CareNote, FollowCase, Group, Household, Person, Role, RoleAssignment, ServiceWeek, Stage, PermissionKey,
} from "./types";

// Deterministic random so the demo looks the same on every load.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(20261105);
const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];

export const DAY = 864e5;
export function dayISO(offsetDays: number) {
  return new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
}
export function stampISO(offsetHours: number) {
  return new Date(Date.now() + offsetHours * 36e5).toISOString();
}

const maleFirst = ["Tunde", "Emeka", "Ibrahim", "Segun", "Chinedu", "Kayode", "Uche", "Musa", "Dapo", "Obinna", "Femi", "Kunle", "Tobi", "Ayo", "Ifeanyi", "Samuel", "David", "Joshua", "Victor", "Gbenga", "Olumide", "Babatunde", "Nnamdi", "Yemi"];
const femaleFirst = ["Funke", "Adaeze", "Aisha", "Bukola", "Chioma", "Yetunde", "Ngozi", "Halima", "Temitope", "Amaka", "Folake", "Blessing", "Ruth", "Esther", "Damilola", "Ijeoma", "Mercy", "Joy", "Omolara", "Nkechi", "Precious", "Zainab", "Deborah", "Sade"];
const lastNames = ["Adeyemi", "Okonkwo", "Balogun", "Eze", "Ogunleye", "Nwachukwu", "Abubakar", "Afolabi", "Okeke", "Oladipo", "Ibe", "Fashola", "Olatunji", "Udeh", "Salami", "Onyeka", "Akinola", "Danladi", "Ajayi", "Chukwu", "Bamidele", "Oyelaran", "Adebisi", "Nwosu"];
const areas = ["Ikeja", "Yaba", "Surulere", "Lekki", "Ajah", "Gbagada", "Ogba", "Ikorodu", "Maryland", "Ojodu", "Magodo", "Festac"];
const jobs = ["Banker", "Software developer", "Nurse", "Teacher", "Student", "Trader", "Civil engineer", "Accountant", "Fashion designer", "Pharmacist", "Lawyer", "Entrepreneur", "Civil servant", "Doctor", "Sales executive"];

function phone() {
  const p = pick(["803", "806", "813", "816", "703", "706", "810", "905", "807", "802", "701", "909"]);
  let n = ""; for (let i = 0; i < 7; i++) n += Math.floor(r() * 10);
  return `+234 ${p} ${n.slice(0, 3)} ${n.slice(3)}`;
}
function birthday(minAge: number, maxAge: number) {
  const y = new Date().getFullYear() - (minAge + Math.floor(r() * (maxAge - minAge)));
  const m = 1 + Math.floor(r() * 12); const d = 1 + Math.floor(r() * 28);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

let pid = 0;
const people: Person[] = [];
function person(p: Partial<Person> & { firstName: string; lastName: string; gender: "M" | "F"; stage: Stage }): Person {
  const full = {
    id: `p${++pid}`,
    phone: phone(),
    location: pick(areas),
    occupation: pick(jobs),
    birthday: birthday(19, 58),
    firstVisit: dayISO(-(200 + Math.floor(r() * 1500))),
    lastSeen: dayISO(-Math.floor(r() * 7)),
    missedInARow: 0,
    ...(Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as typeof p),
  } as Person;
  if (full.whatsapp === undefined && r() > 0.25) full.whatsapp = full.phone;
  if (full.email === undefined && r() > 0.35) full.email = `${full.firstName}.${full.lastName}`.toLowerCase() + "@gmail.com";
  people.push(full);
  return full;
}

// Named staff and personas used by the demo sign-in
export const P = {
  lead: person({ firstName: "Femi", lastName: "Oyelaran", gender: "M", stage: "leader", occupation: "Lead pastor", birthday: dayISO(2).replace(/^\d{4}/, "1978") }),
  resident: person({ firstName: "Segun", lastName: "Ademola", gender: "M", stage: "leader", occupation: "Resident pastor" }),
  associate: person({ firstName: "Samuel", lastName: "Kayode", gender: "M", stage: "leader", occupation: "Associate pastor" }),
  admin: person({ firstName: "Adebola", lastName: "Ademola", gender: "F", stage: "worker", occupation: "Church administrator" }),
  outreach: person({ firstName: "Adewole", lastName: "Adelabu", gender: "M", stage: "leader" }),
  membership: person({ firstName: "Adewale", lastName: "Orebanwo", gender: "M", stage: "leader" }),
  training: person({ firstName: "Abiodun", lastName: "Babatunde", gender: "M", stage: "leader" }),
  media: person({ firstName: "Kayode", lastName: "Oluwanifemi", gender: "M", stage: "leader" }),
  usher: person({ firstName: "Feyisarami", lastName: "Omotayo", gender: "F", stage: "leader" }),
  welfare: person({ firstName: "Esther", lastName: "Danjuma", gender: "F", stage: "leader" }),
  worker: person({ firstName: "Ifeoma", lastName: "Nwosu", gender: "F", stage: "worker" }),
  member: person({ firstName: "Yusuf", lastName: "Bello", gender: "M", stage: "member" }),
  choir: person({ firstName: "Adesoji", lastName: "Adewanbo", gender: "M", stage: "leader", occupation: "Music director" }),
  technical: person({ firstName: "Ogunkola", lastName: "Kolawole", gender: "M", stage: "leader", occupation: "Sound engineer" }),
  protocol: person({ firstName: "Chinonso", lastName: "Ogwurumba", gender: "M", stage: "leader", occupation: "Civil engineer" }),
  family: person({ firstName: "Omotayo", lastName: "Babatunde", gender: "F", stage: "leader", occupation: "Family counsellor" }),
};

// The wider congregation
const stageMix: Stage[] = ["member", "member", "member", "member", "worker", "worker", "worker", "discipleship", "returning", "leader"];
for (let i = 0; i < 132; i++) {
  const g = r() > 0.52 ? "F" : "M";
  const stage = pick(stageMix);
  const p = person({
    firstName: pick(g === "F" ? femaleFirst : maleFirst),
    lastName: pick(lastNames),
    gender: g,
    stage,
    firstVisit: stage === "returning" ? dayISO(-(14 + Math.floor(r() * 40))) : stage === "discipleship" ? dayISO(-(30 + Math.floor(r() * 90))) : undefined,
  });
  p.tracked = stage === "worker" || stage === "leader" || r() < 0.45;
  if (p.tracked && r() < 0.12) { p.missedInARow = 3 + Math.floor(r() * 3); p.lastSeen = dayISO(-7 * p.missedInARow); }
  if (r() < 0.18) p.birthday = undefined;
  if (r() < 0.2) p.occupation = undefined;
}
// A few birthdays this week
[P.lead.id, "p20", "p33", "p47", "p58", "p71"].forEach((id, i) => {
  const p = people.find((x) => x.id === id);
  if (p) p.birthday = `${1975 + i * 4}${dayISO(i).slice(4)}`;
});

// First-timers from the last few weeks
const firstTimerCases: FollowCase[] = [];
const ftPlan: { days: number; stage: FollowCase["stage"]; contacted: boolean }[] = [
  { days: 0.2, stage: "new", contacted: false }, { days: 0.3, stage: "new", contacted: false },
  { days: 0.4, stage: "new", contacted: false }, { days: 1, stage: "new", contacted: false },
  { days: 3.2, stage: "new", contacted: false }, { days: 3.3, stage: "new", contacted: false },
  { days: 4, stage: "new", contacted: false }, { days: 3.1, stage: "contacted", contacted: true },
  { days: 3.4, stage: "contacted", contacted: true }, { days: 6, stage: "contacted", contacted: true },
  { days: 10, stage: "visited", contacted: true }, { days: 10.2, stage: "visited", contacted: true },
  { days: 10.1, stage: "returned", contacted: true }, { days: 17, stage: "returned", contacted: true },
  { days: 17.2, stage: "returned", contacted: true }, { days: 24, stage: "in_class", contacted: true },
  { days: 24.1, stage: "in_class", contacted: true }, { days: 31, stage: "in_class", contacted: true },
  { days: 38, stage: "member", contacted: true }, { days: 9, stage: "unreachable", contacted: true },
  { days: 20, stage: "contacted", contacted: true }, { days: 27, stage: "visited", contacted: true },
  { days: 33, stage: "unreachable", contacted: true }, { days: 44, stage: "contacted", contacted: true },
];
const followTeam = [P.outreach.id, P.membership.id, P.worker.id];
ftPlan.forEach((plan, i) => {
  const g = r() > 0.5 ? "F" : "M";
  const stage: Stage = plan.stage === "in_class" ? "discipleship" : plan.stage === "member" ? "member" : plan.stage === "returned" ? "returning" : "first_timer";
  const p = person({
    firstName: pick(g === "F" ? femaleFirst : maleFirst), lastName: pick(lastNames), gender: g, stage,
    firstVisit: dayISO(-Math.floor(plan.days)), lastSeen: dayISO(-Math.floor(plan.days)),
  });
  if (r() <= 0.4) p.occupation = undefined;
  if (r() <= 0.5) p.birthday = undefined; else p.birthday = birthday(18, 45);
  const assignee = i < 2 ? undefined : followTeam[i % followTeam.length];
  firstTimerCases.push({
    id: `f${i + 1}`,
    personId: p.id,
    assigneeId: assignee,
    stage: plan.stage,
    createdAt: stampISO(-plan.days * 24),
    contacts: plan.contacted && assignee
      ? [{ at: stampISO(-plan.days * 24 + 20), byId: assignee, method: pick(["call", "whatsapp"] as const), outcome: pick(["Reached, says she'll come again Sunday", "Reached, very happy with the service", "Spoke briefly, asked for the midweek time", "Sent welcome message, replied with thanks"]) }]
      : [],
  });
});

// Households
const households: Household[] = [
  { id: "h1", name: "Oyelaran household", address: "14 Adeniyi Jones Avenue, Ikeja" },
  { id: "h2", name: "Bello household", address: "3 Ogunlana Drive, Surulere" },
  { id: "h3", name: "Orebanwo household", address: "22 Admiralty Way, Lekki" },
];
P.lead.householdId = "h1"; P.member.householdId = "h2"; P.membership.householdId = "h3";
const kids = [
  person({ firstName: "Tiwa", lastName: "Oyelaran", gender: "F", stage: "member", isChild: true, householdId: "h1", birthday: "2015-03-14", email: "", whatsapp: "" }),
  person({ firstName: "Tobi", lastName: "Oyelaran", gender: "M", stage: "member", isChild: true, householdId: "h1", birthday: "2018-09-02", email: "", whatsapp: "" }),
  person({ firstName: "Fatima", lastName: "Bello", gender: "F", stage: "member", isChild: true, householdId: "h2", birthday: "2016-06-21", email: "", whatsapp: "" }),
];
const spouse = person({ firstName: "Titilayo", lastName: "Oyelaran", gender: "F", stage: "leader", householdId: "h1" });
const spouse2 = person({ firstName: "Hauwa", lastName: "Bello", gender: "F", stage: "worker", householdId: "h2" });
kids.forEach((k) => { k.occupation = undefined; k.location = undefined; });
void spouse; void spouse2;

// Departments and units
const pastors = new Set([P.lead.id, P.resident.id, P.associate.id, P.choir.id, P.technical.id, P.protocol.id, P.family.id]);
const pool = people.filter((p) => !p.isChild && !pastors.has(p.id) && (p.stage === "worker" || p.stage === "leader")).map((p) => p.id);
let cursor = 0;
const take = (n: number) => { const out: string[] = []; for (let i = 0; i < n; i++) out.push(pool[(cursor++ * 7) % pool.length]); return [...new Set(out)]; };

const g = (x: Omit<Group, "memberIds"> & { size: number }): Group => {
  const { size, ...rest } = x;
  return { ...rest, memberIds: [...new Set([...x.leaderIds, ...take(size)])] };
};

const groups: Group[] = [
  g({ id: "g-training", name: "Faculty of Training", kind: "department", purpose: "All training in the church: Foundation School, stewardship training and future courses", leaderIds: [P.training.id], overseerId: P.resident.id, tags: ["training"], size: 8 }),
  g({ id: "g-children", name: "Children", kind: "department", supervisorId: "g-training", purpose: "Children's church", leaderIds: [], overseerId: P.resident.id, tags: ["children"], size: 9 }),
  g({ id: "g-outreach", name: "Mission and Outreach / Follow-up", kind: "department", purpose: "Outreach and first-timer follow-up", leaderIds: [P.outreach.id], overseerId: P.associate.id, tags: ["followup"], size: 11 }),
  g({ id: "g-membership", name: "Membership Ministry", kind: "department", purpose: "Follows up members, links them to the right arms of the church, and runs online prayer", leaderIds: [P.membership.id], overseerId: P.resident.id, tags: ["membership", "followup"], size: 9 }),
  g({ id: "g-media", name: "Media", kind: "department", purpose: "Everything media in the church", leaderIds: [P.media.id], overseerId: P.associate.id, tags: ["media"], size: 4 }),
  g({ id: "g-media-camera", name: "Camera", kind: "unit", parentId: "g-media", purpose: "Videography and photography", leaderIds: [], size: 5 }),
  g({ id: "g-media-projection", name: "Projection", kind: "unit", parentId: "g-media", purpose: "Screens and slides during service", leaderIds: [], size: 3 }),
  g({ id: "g-media-light", name: "Light", kind: "unit", parentId: "g-media", purpose: "Stage and auditorium lighting", leaderIds: [], size: 3 }),
  g({ id: "g-media-online", name: "Online church and live streaming", kind: "unit", parentId: "g-media", purpose: "The online church and every live stream", leaderIds: [], size: 4 }),
  g({ id: "g-media-content", name: "Content and social media", kind: "unit", parentId: "g-media", purpose: "Content, design and social media pages", leaderIds: [], size: 4 }),
  g({ id: "g-choir", name: "Edify Worship", kind: "department", purpose: "The choir", leaderIds: [P.choir.id], overseerId: P.associate.id, size: 16 }),
  g({ id: "g-technical", name: "Technical", kind: "department", purpose: "Sound", leaderIds: [P.technical.id], overseerId: P.associate.id, size: 5 }),
  g({ id: "g-welfare", name: "Welfare", kind: "department", purpose: "The welfare arm of the church", leaderIds: [P.welfare.id], overseerId: P.resident.id, tags: ["welfare"], size: 6 }),
  g({ id: "g-ushering", name: "Ushering", kind: "department", purpose: "Ushers, headcounts and offering counts", leaderIds: [P.usher.id], overseerId: P.associate.id, tags: ["ushering"], size: 12 }),
  g({ id: "g-protocol", name: "Protocol", kind: "department", purpose: "Protocol duties", leaderIds: [P.protocol.id], overseerId: P.associate.id, size: 7 }),
  g({ id: "g-family", name: "Family Life", kind: "department", purpose: "Marriages, families and parenting", leaderIds: [P.family.id], overseerId: P.resident.id, tags: ["family"], size: 5 }),
  g({ id: "g-setup", name: "Setup and Facility Management", kind: "department", purpose: "Setting up and caring for the venue", leaderIds: [], overseerId: P.associate.id, size: 6 }),
];
// Give leaderless departments a leader from their members
groups.forEach((gr) => { if (gr.leaderIds.length === 0 && gr.memberIds.length) gr.leaderIds = [gr.memberIds[0]]; });
const outreach = groups.find((x) => x.id === "g-outreach")!;
if (!outreach.memberIds.includes(P.worker.id)) outreach.memberIds.push(P.worker.id);

// Roles
export const ALL: PermissionKey[] = ["people.view", "people.edit", "people.contacts", "care.view", "followup.assign", "followup.log", "groups.manage", "attendance.record", "checkin.code", "finance.approve", "finance.transfers", "finance.view", "classes.manage", "events.manage", "messages.bulk", "roles.manage", "sheets.connect", "activity.view", "billing.manage"];
export const DEFAULT_ROLES: Role[] = [
  { id: "r-lead", key: "lead", name: "Lead pastor", level: 1, isDefault: true, description: "Sees everything, assigns oversight, approves corrections", permissions: ALL },
  { id: "r-pastor", key: "pastor", name: "Pastorate", level: 2, isDefault: true, description: "Resident and associate pastors; oversee their assigned areas", permissions: ["people.view", "people.edit", "people.contacts", "care.view", "followup.assign", "followup.log", "groups.manage", "attendance.record", "classes.manage", "events.manage", "messages.bulk"] },
  { id: "r-admin", key: "admin", name: "Admin", level: 3, isDefault: true, description: "Setup, records, events, communication and classes", permissions: ["people.view", "people.edit", "people.contacts", "followup.assign", "followup.log", "groups.manage", "attendance.record", "checkin.code", "classes.manage", "events.manage", "messages.bulk", "roles.manage", "sheets.connect", "activity.view", "billing.manage"] },
  { id: "r-dept", key: "dept", name: "Department leader", level: 4, isDefault: true, description: "Leads a department or unit and its people", permissions: ["people.view", "people.edit", "people.contacts", "groups.manage", "attendance.record", "messages.bulk"] },
  { id: "r-follow-lead", key: "followup", name: "Follow-up lead", level: 4, isDefault: true, description: "Receives and assigns first-timers", permissions: ["followup.assign", "followup.log", "people.contacts"] },
  { id: "r-care", key: "care", name: "Care leader", level: 4, isDefault: true, description: "Faculty of Training and Membership Ministry leaders who read care notes", permissions: ["care.view"] },
  { id: "r-usher", key: "usher", name: "Head usher", level: 4, isDefault: true, description: "Submits service cash counts; can delegate", permissions: ["finance.count" as PermissionKey, "attendance.record"] },
  { id: "r-media", key: "media", name: "Media head", level: 4, isDefault: true, description: "Sets the check-in code for each service", permissions: ["checkin.code"] },
  { id: "r-worker", key: "worker", name: "Worker", level: 5, isDefault: true, description: "Serves in a department; handles tasks assigned to them", permissions: ["followup.log"] },
  { id: "r-member", key: "member", name: "Member", level: 6, isDefault: true, description: "Their own profile, household, classes and events", permissions: [] },
];

const church = { type: "church" } as const;
const groupsScope = (...ids: string[]) => ({ type: "groups", groupIds: ids }) as const;
const assignments: RoleAssignment[] = [
  { personId: P.lead.id, roleId: "r-lead", scope: church },
  { personId: P.resident.id, roleId: "r-pastor", scope: groupsScope("g-training", "g-children", "g-membership", "g-welfare", "g-family") },
  { personId: P.associate.id, roleId: "r-pastor", scope: groupsScope("g-outreach", "g-media", "g-choir", "g-technical", "g-ushering", "g-protocol", "g-setup") },
  { personId: P.admin.id, roleId: "r-admin", scope: church },
  { personId: P.outreach.id, roleId: "r-dept", scope: groupsScope("g-outreach") },
  { personId: P.outreach.id, roleId: "r-follow-lead", scope: church },
  { personId: P.membership.id, roleId: "r-dept", scope: groupsScope("g-membership") },
  { personId: P.membership.id, roleId: "r-follow-lead", scope: church },
  { personId: P.membership.id, roleId: "r-care", scope: church },
  { personId: P.training.id, roleId: "r-dept", scope: groupsScope("g-training") },
  { personId: P.training.id, roleId: "r-care", scope: church },
  { personId: P.media.id, roleId: "r-dept", scope: groupsScope("g-media") },
  { personId: P.media.id, roleId: "r-media", scope: church },
  { personId: P.usher.id, roleId: "r-dept", scope: groupsScope("g-ushering") },
  { personId: P.usher.id, roleId: "r-usher", scope: church },
  { personId: P.welfare.id, roleId: "r-dept", scope: groupsScope("g-welfare") },
  { personId: P.choir.id, roleId: "r-dept", scope: groupsScope("g-choir") },
  { personId: P.technical.id, roleId: "r-dept", scope: groupsScope("g-technical") },
  { personId: P.protocol.id, roleId: "r-dept", scope: groupsScope("g-protocol") },
  { personId: P.family.id, roleId: "r-dept", scope: groupsScope("g-family") },
  { personId: P.worker.id, roleId: "r-worker", scope: groupsScope("g-outreach") },
  { personId: P.member.id, roleId: "r-member", scope: { type: "self" } },
];

const careNotes: CareNote[] = [
  { id: "c1", personId: "p40", level: "care", body: "Lost a parent last month. The Membership Ministry team visited on Saturday and will check in weekly.", authorId: P.membership.id, at: stampISO(-72), sharedWith: [] },
  { id: "c2", personId: "p40", level: "confidential", body: "Counselling session held. Follow-up session booked for next Thursday.", authorId: P.lead.id, at: stampISO(-50), sharedWith: [] },
];

const weeks: ServiceWeek[] = Array.from({ length: 8 }, (_, i) => {
  const base = 96 + i * 4 + Math.round(r() * 10);
  return { date: dayISO(-7 * (7 - i) - ((new Date().getDay() + 0) % 7)), first: base, second: base + 52 + Math.round(r() * 14), children: 34 + Math.round(r() * 8), firstTimers: 3 + Math.round(r() * 6) };
});

const activity: Activity[] = [
  { id: "a1", at: stampISO(-1), actorId: P.outreach.id, text: "assigned 3 first-timers to Ifeoma Nwosu" },
  { id: "a2", at: stampISO(-3), actorId: P.worker.id, text: "logged a call with a first-timer: reached, will come again Sunday" },
  { id: "a3", at: stampISO(-20), actorId: P.admin.id, text: "imported 46 people from \"Members list 2025.xlsx\"" },
  { id: "a4", at: stampISO(-26), actorId: P.lead.id, text: "gave Pastor Daniel Musa oversight of Media, Technical and Edify Worship" },
  { id: "a5", at: stampISO(-30), actorId: P.admin.id, text: "created the Membership Ministry department" },
  { id: "a6", at: stampISO(-49), actorId: P.membership.id, text: "added a care note" },
];

people.forEach((p) => { if (p.stage === "worker" || p.stage === "leader") p.tracked = true; if (!p.tracked) { p.missedInARow = 0; } });

const churchInfo: Church = {
  name: "Heirs Church", slug: "heirs", currency: "NGN", country: "Nigeria", timeZone: "Africa/Lagos",
  attendanceGoal: 400, trialEndsAt: stampISO(52 * 24), template: "pentecostal",
};

import { buildMore } from "./seed-more";
const more = buildMore({ people, groups, P, cases: firstTimerCases, dayISO, stampISO });
churchInfo.profile = more.profile;

export const seed = {
  church: churchInfo,
  ...more.collections,
  placements: [{ id: "pl1", personId: "p30", groupId: "g-choir", note: "I sang in my former church's choir for 4 years.", status: "open", at: stampISO(-30) }] as Placement[],
  pendingContact: null as PendingContact | null,
  people, households, groups, roles: DEFAULT_ROLES, assignments, cases: firstTimerCases, careNotes, weeks, activity,
};
export type SeedState = typeof seed;

export const PERSONAS: { id: string; label: string; note: string }[] = [
  { id: P.lead.id, label: "Lead pastor", note: "Sees the whole church" },
  { id: P.resident.id, label: "Resident pastor", note: "Oversees training, children, membership, welfare, family life" },
  { id: P.associate.id, label: "Associate pastor", note: "Oversees outreach, media, choir and more" },
  { id: P.admin.id, label: "Admin", note: "Runs setup and records" },
  { id: P.outreach.id, label: "Follow-up lead", note: "Mission and Outreach head" },
  { id: P.media.id, label: "Department leader", note: "Media head" },
  { id: P.usher.id, label: "Head usher", note: "Ushering head, submits offering counts" },
  { id: P.welfare.id, label: "Welfare head", note: "Minutes welfare requests" },
  { id: P.training.id, label: "Faculty of Training head", note: "Runs classes" },
  { id: P.worker.id, label: "Worker", note: "Follow-up team member" },
  { id: P.member.id, label: "Member", note: "Member portal" },
];
