/**
 * Builds the Graceville Church demo: ~320 people, headquarters plus four branches in two regions,
 * pastors, leaders, workers, members, first-timers, classes, events, offerings, welfare and prayer,
 * with sign-ins for each kind of person. Writes one SQL file to run in Supabase.
 *
 * Run: npx vitest run scripts/demo-church.test.ts
 */
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { accessFor } from "@/lib/access";
import { seed, P } from "@/lib/seed";
import { tables } from "@/lib/live";
import { defaultJourney } from "@/lib/journey";
import type { Attendance, FollowCase, Group, Person, RoleAssignment } from "@/lib/types";

const OUT = process.env.DEMO_OUT ?? "/home/claude/traqi-demo-church.sql";
const PASSWORD = "Graceville@2026";
const DOMAIN = "graceville.example";

// ---------- names: nothing that points at a real person or church ----------
const RENAME: [string, string][] = [
  ["Heirs Church", "Graceville Church"], ["heirschurch", "gracevillechurch"], ["Heirs", "Graceville"],
  ["Edify Worship", "Graceville Voices"], ["BABS with the BABS", "Kingdom Careers"],
  ["Femi Oyelaran", "Daniel Okafor"], ["Titilayo Oyelaran", "Grace Okafor"], ["Pastor Femi", "Pastor Daniel"],
  ["Segun Ademola", "Emmanuel Adebayo"], ["Samuel Kayode", "Joshua Eze"], ["Adebola Ademola", "Funmilayo Martins"],
  ["Adewole Adelabu", "Olumide Ajayi"], ["Adewale Orebanwo", "Kelechi Nwankwo"], ["Abiodun Babatunde", "Victor Ogunleye"],
  ["Kayode Oluwanifemi", "Seyi Lawal"], ["Feyisarami Omotayo", "Bisola Adeniyi"], ["Adesoji Adewanbo", "Tolu Akande"],
  ["Ogunkola Kolawole", "Chidi Okoro"], ["Chinonso Ogwurumba", "Ifeanyi Obi"], ["Omotayo Babatunde", "Ronke Adeyemi"],
  ["Oyelaran", "Okafor"],
];
const PERSONA_NAMES: Record<string, [string, string]> = {
  lead: ["Daniel", "Okafor"], resident: ["Emmanuel", "Adebayo"], associate: ["Joshua", "Eze"], admin: ["Funmilayo", "Martins"],
  outreach: ["Olumide", "Ajayi"], membership: ["Kelechi", "Nwankwo"], training: ["Victor", "Ogunleye"], media: ["Seyi", "Lawal"],
  usher: ["Bisola", "Adeniyi"], choir: ["Tolu", "Akande"], technical: ["Chidi", "Okoro"], protocol: ["Ifeanyi", "Obi"], family: ["Ronke", "Adeyemi"],
};

// ---------- a small seeded random ----------
let rs = 7331;
const r = () => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs / 2147483648; };
const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const stamp = (h: number) => new Date(Date.now() + h * 36e5).toISOString();

const MALE = ["Tunde", "Emeka", "Ibrahim", "Chinedu", "Uche", "Musa", "Dapo", "Obinna", "Kunle", "Tobi", "Ayo", "David", "Victor", "Gbenga", "Nnamdi", "Yemi", "Bolaji", "Seun", "Chuka", "Tayo", "Wale", "Ikenna", "Damilare", "Sola", "Kehinde", "Femi", "Babajide", "Ola"];
const FEMALE = ["Funke", "Adaeze", "Aisha", "Bukola", "Chioma", "Yetunde", "Halima", "Amaka", "Folake", "Blessing", "Ruth", "Damilola", "Ijeoma", "Mercy", "Joy", "Nkechi", "Precious", "Zainab", "Deborah", "Sade", "Kemi", "Ronke", "Ebere", "Lola", "Temi", "Toyin", "Ada", "Hauwa"];
const LAST = ["Adeyemi", "Okonkwo", "Balogun", "Eze", "Nwachukwu", "Abubakar", "Afolabi", "Okeke", "Oladipo", "Ibe", "Olatunji", "Udeh", "Salami", "Onyeka", "Akinola", "Danladi", "Ajayi", "Chukwu", "Bamidele", "Adebisi", "Nwosu", "Oyewole", "Babalola", "Obi", "Lawal", "Adekunle", "Ezeh", "Ogundipe", "Ilori", "Uzor"];
const JOBS = ["Banker", "Software developer", "Nurse", "Teacher", "Student", "Trader", "Civil engineer", "Accountant", "Fashion designer", "Pharmacist", "Lawyer", "Entrepreneur", "Civil servant", "Doctor", "Sales executive", "Farmer", "Lecturer"];

const BRANCHES = [
  { id: "br-lekki", name: "Graceville Lekki", slug: "lekki", city: "Lekki", regionId: "rg-lagos", address: "22 Admiralty Way, Lekki Phase 1, Lagos", directions: "Beside the big filling station; enter from the service lane.", areas: ["Lekki", "Ajah", "Victoria Island", "Chevron", "Sangotedo"], n: 45, pastor: ["Chukwudi", "Obiora", "M"] },
  { id: "br-ikorodu", name: "Graceville Ikorodu", slug: "ikorodu", city: "Ikorodu", regionId: "rg-lagos", address: "7 Lagos Road, Ikorodu, Lagos", directions: "Opposite Ikorodu garage, second gate.", areas: ["Ikorodu", "Ijede", "Igbogbo", "Agric"], n: 35, pastor: ["Adewunmi", "Fadare", "F"] },
  { id: "br-ibadan", name: "Graceville Ibadan", slug: "ibadan", city: "Ibadan", regionId: "rg-sw", address: "15 Bodija Market Road, Bodija, Ibadan", directions: "Two streets after Bodija market, white gate.", areas: ["Bodija", "Ring Road", "Challenge", "UI", "Mokola"], n: 40, pastor: ["Oluwaseun", "Adigun", "M"] },
  { id: "br-abeokuta", name: "Graceville Abeokuta", slug: "abeokuta", city: "Abeokuta", regionId: "rg-sw", address: "3 Oke-Ilewo Road, Abeokuta", directions: "Near the roundabout, behind the bank.", areas: ["Oke-Ilewo", "Panseke", "Kuto", "Asero", "Lafenwa"], n: 30, pastor: ["Bamidele", "Sowande", "M"] },
];

it("builds the Graceville demo", () => {
  // Start from the full demo church, renamed
  let json = JSON.stringify(seed);
  for (const [a, b] of RENAME) json = json.split(a).join(b);
  const s = JSON.parse(json) as typeof seed;
  for (const [k, [f, l]] of Object.entries(PERSONA_NAMES)) {
    const p = s.people.find((x) => x.id === (P as Record<string, Person>)[k].id)!;
    p.firstName = f; p.lastName = l;
  }
  s.church.name = "Graceville Church";
  s.church.slug = "graceville";
  const prof = s.church.profile!;
  prof.welcome = "Welcome home. Whether it's your first Sunday or your five hundredth, there's a place for you at Graceville Church.";
  prof.directions = "Off Ogba Road, opposite the filling station. Look for the white gate with the blue Graceville sign.";
  prof.color = "#6d28d9"; prof.accent = "#f59e0b"; prof.heading = "modern";
  prof.level = "network"; prof.offeringsAt = "branch";
  prof.whatsapp = "https://chat.whatsapp.com/graceville-demo"; prof.whatsappForUnconfirmed = false;
  prof.pinnedMessage = { title: "Sunday service: Built to last", url: "https://www.youtube.com/" };
  const lead = s.people.find((p) => p.id === P.lead.id)!;

  // ---------- regions and branches ----------
  const overseer: Person = { ...lead, id: "p-sw-overseer", firstName: "Gbenga", lastName: "Afolabi", gender: "M", stage: "leader", isLeader: true, tracked: true, missedInARow: 0, location: "Ibadan", occupation: "Regional overseer", householdId: undefined, phone: "+234 805 410 0001", whatsapp: "+234 805 410 0001", email: undefined, birthday: "1971-03-14", firstVisit: day(-2500) };
  s.people.push(overseer);
  prof.regions = [{ id: "rg-lagos", name: "Lagos Region", overseerId: P.associate.id }, { id: "rg-sw", name: "South-West Region", overseerId: overseer.id }];
  prof.branches = [];
  const role = (key: string) => s.roles.find((x) => x.key === key)!.id;
  const sundays = s.meetings.filter((m) => m.kind === "sunday" && Date.parse(m.end) < Date.now()).map((m) => m.id);
  let phoneN = 1000;
  const mk = (b: (typeof BRANCHES)[number], over: Partial<Person> & { firstName: string; lastName: string; gender: "M" | "F"; stage: string }): Person => {
    phoneN++;
    const ph = `+234 ${pick(["803", "806", "813", "816", "703", "706", "810", "905", "807", "802"])} ${String(300 + (phoneN % 600)).padStart(3, "0")} ${String((phoneN * 7919) % 10000).padStart(4, "0")}`;
    return {
      id: `pb${phoneN}`, phone: ph, whatsapp: r() < 0.85 ? ph : undefined, email: r() < 0.5 ? `${over.firstName}.${over.lastName}${phoneN}`.toLowerCase() + "@gmail.com" : undefined,
      birthday: r() < 0.85 ? `${1965 + Math.floor(r() * 40)}-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-${String(1 + Math.floor(r() * 28)).padStart(2, "0")}` : undefined,
      location: pick(b.areas), occupation: r() < 0.8 ? pick(JOBS) : undefined, firstVisit: day(-(200 + Math.floor(r() * 1500))), lastSeen: day(-Math.floor(r() * 7)),
      missedInARow: 0, tracked: false, branchId: b.id, consent: { at: stamp(-24 * 100), via: "import" }, confirmedAt: stamp(-24 * 100),
      ...over,
    } as Person;
  };
  const extraAttendance: Attendance[] = [];
  const extraCases: FollowCase[] = [];
  const extraGroups: Group[] = [];
  const extraAssign: RoleAssignment[] = [];
  let aN = 0;
  for (const b of BRANCHES) {
    const pastor = mk(b, { firstName: b.pastor[0], lastName: b.pastor[1], gender: b.pastor[2] as "M" | "F", stage: "leader", isLeader: true, tracked: true, occupation: "Branch pastor", firstVisit: day(-2200) });
    s.people.push(pastor);
    prof.branches.push({ id: b.id, name: b.name, slug: b.slug, city: b.city, regionId: b.regionId, pastorId: pastor.id, address: b.address, directions: b.directions });
    extraAssign.push({ personId: pastor.id, roleId: role("pastor"), scope: { type: "branch", branchId: b.id } });
    // Branch departments: started from headquarters' and kept small
    const dep = (name: string, purpose: string, tags: Group["tags"]): Group => ({ id: `g-${b.slug}-${name.toLowerCase().replace(/\W+/g, "")}`, name, kind: "department", purpose, tags, branchId: b.id, leaderIds: [], memberIds: [], overseerId: pastor.id });
    const gs = [dep("Ushering and Protocol", "Welcoming people and headcounts", ["ushering"]), dep("Choir", "Leading worship", []), dep("Follow-up", "Reaching first-timers", []), dep("Children", "Children's church", ["children"]), dep("Media", "Sound, projection and live stream", ["media"])];
    // People
    const folks: Person[] = [];
    for (let i = 0; i < b.n; i++) {
      const g = r() < 0.53 ? "F" : "M";
      const stage = pick(["member", "member", "member", "member", "worker", "worker", "worker", "discipleship", "returning", "member"]);
      const p = mk(b, { firstName: pick(g === "F" ? FEMALE : MALE), lastName: pick(LAST), gender: g, stage });
      p.tracked = stage === "worker" || r() < 0.4;
      if (p.tracked && r() < 0.1) { p.missedInARow = 3 + Math.floor(r() * 3); p.lastSeen = day(-7 * p.missedInARow); }
      folks.push(p);
    }
    // Heads and workers
    const workers = folks.filter((p) => p.stage === "worker");
    gs.forEach((g, i) => {
      const head = workers[i] ?? folks[i];
      head.stage = "leader"; head.isLeader = true; head.tracked = true;
      g.leaderIds = [head.id];
      extraAssign.push({ personId: head.id, roleId: role("dept"), scope: { type: "groups", groupIds: [g.id] } });
    });
    workers.forEach((w, i) => { const g = gs[i % gs.length]; if (!g.leaderIds.includes(w.id)) g.memberIds.push(w.id); });
    gs.forEach((g) => { g.memberIds = [...new Set([...g.leaderIds, ...g.memberIds])]; });
    extraGroups.push(...gs);
    s.people.push(...folks);
    // Sunday attendance for people who check in
    for (const p of [pastor, ...folks].filter((x) => x.tracked)) {
      sundays.forEach((mid, k) => {
        const missed = p.missedInARow && k >= sundays.length - p.missedInARow;
        if (!missed && r() < 0.86) extraAttendance.push({ id: `atb${++aN}`, meetingId: mid, personId: p.id, method: pick(["qr", "qr", "link", "usher"]), at: s.meetings.find((m) => m.id === mid)!.start });
      });
    }
    // First-timers at each branch
    const fu = gs[2];
    for (let i = 0; i < 4; i++) {
      const d = [1, 4, 9, 20][i];
      const g = i % 2 ? "F" : "M";
      const ft = mk(b, { firstName: pick(g === "F" ? FEMALE : MALE), lastName: pick(LAST), gender: g, stage: i === 3 ? "returning" : "first_timer", tracked: true, firstVisit: day(-d), lastSeen: day(-d), heardFrom: pick(["A friend or family member", "Social media", "I walked in", "Outreach"]), consent: { at: stamp(-24 * d), via: "welcome-form" } });
      s.people.push(ft);
      extraCases.push({ id: `cb${b.slug}${i}`, personId: ft.id, assigneeId: i === 0 ? undefined : fu.leaderIds[0], stage: (["new", "contacted", "visited", "returned"] as const)[i], createdAt: stamp(-24 * d - 3),
        contacts: i === 0 ? [] : [{ at: stamp(-24 * d + 20), byId: fu.leaderIds[0], method: i % 2 ? "call" : "whatsapp", outcome: "Spoke with them, will come again Sunday", reached: true }] });
    }
  }
  s.groups.push(...extraGroups);
  s.attendance.push(...extraAttendance);
  s.cases.push(...extraCases);
  s.assignments.push(...extraAssign, { personId: overseer.id, roleId: role("pastor"), scope: { type: "region", regionId: "rg-sw" } });

  // ---------- Round 2 touches ----------
  const j = defaultJourney("class_first"); j.probation = { ...j.probation, holdBack: j.probation?.holdBack ?? [], enabled: true, months: 3, everyNewWorker: true };
  prof.journey = j;
  const ws = s.people.filter((p) => p.stage === "worker" && !p.branchId);
  ws[0].probation = { startedAt: stamp(-24 * 100), until: day(-3), groupId: s.groups.find((g) => g.memberIds.includes(ws[0].id))?.id, reason: "new_worker", notes: [{ byId: P.media.id, text: "Faithful at rehearsals and always early.", at: stamp(-24 * 30) }] };
  ws[1].probation = { startedAt: stamp(-24 * 20), until: day(70), groupId: s.groups.find((g) => g.memberIds.includes(ws[1].id))?.id, reason: "no_class" };
  const mem = s.people.filter((p) => p.stage === "member" && !p.branchId);
  mem[0].awaitingStage = "worker";
  // A media assistant, follow-up settings, department WhatsApp
  const media = s.groups.find((g) => g.tags?.includes("media"));
  if (media) { const a = media.memberIds.find((id) => !media.leaderIds.includes(id)); if (a) media.assistants = [{ personId: a, title: "Media assistant: Live stream", perms: ["rollcall", "message"] }]; media.whatsapp = "https://chat.whatsapp.com/graceville-media-demo"; }
  const fu = s.groups.find((g) => g.tags?.includes("followup"));
  // Round 3: the follow-up head picked the team; nobody is assigned automatically
  if (fu) fu.followup = { auto: false, limit: 5, sameGender: false, team: [...new Set([...fu.leaderIds, ...fu.memberIds, P.membership.id])] };
  // Offering types the pastor defined, with a building project and its target
  prof.offeringTypes = [{ name: "Offering", ushers: true }, { name: "Tithe", ushers: true }, { name: "Thanksgiving", ushers: true }, { name: "Seed", ushers: true }, { name: "Building project", ushers: false, target: 20000000 }];
  prof.categories = prof.offeringTypes.map((t) => t.name);
  s.transfers.push({ id: "tr-bp1", date: day(-12), category: "Building project", amount: 2750000, reference: "NIP/BUILD/1", byId: P.lead.id, method: "transfer" }, { id: "tr-bp2", date: day(-5), category: "Building project", amount: 1450000, reference: "CHQ 004512", byId: P.lead.id, method: "cheque" });
  // The head usher's role took effect two days ago, so the "You have a new role" card shows
  s.assignments = s.assignments.map((a) => (a.personId === P.usher.id && a.roleId === role("usher") ? { ...a, givenAt: stamp(-48) } : a));
  // A member asked to join Media; the Media head decides
  if (media && !s.placements.some((x) => x.status === "open" && x.groupId === media.id)) s.placements.push({ id: "pl-media", personId: P.member.id, groupId: media.id, note: "I can edit videos and run the projector.", status: "open", at: stamp(-30) });
  // A role change waiting for the pastor: the admin asked to make someone an usher
  const usherTo = mem[1];
  s.assignments.push({ personId: usherTo.id, roleId: role("usher"), scope: { type: "church" }, pending: { byId: P.admin.id, at: stamp(-20), action: "give" } });

  // ---------- sign-ins ----------
  const lekki = prof.branches[0];
  const joiner: Person = { id: "p-joiner", firstName: "Tobi", lastName: "Alade", gender: "M", stage: "first_timer", phone: "+234 809 777 0101", missedInARow: 0, tracked: false, firstVisit: day(-4), joinedVia: "search", consent: { at: stamp(-96), via: "joined" } } as unknown as Person;
  s.people.push(joiner);
  s.assignments.push({ personId: joiner.id, roleId: role("member"), scope: { type: "self" } });
  const LOGINS: { who: string; personId: string; email: string; sees: string }[] = [
    { who: "Lead pastor", personId: P.lead.id, email: "lead.pastor", sees: "Everything: the pastor's home, Ask Traqi, church health, giving, branches, roles, approvals" },
    { who: "Resident pastor", personId: P.resident.id, email: "resident.pastor", sees: "The departments he oversees and their people; care notes shared with him" },
    { who: "Associate pastor (Lagos Region)", personId: P.associate.id, email: "associate.pastor", sees: "His departments; Lagos Region overseer" },
    { who: "Church admin", personId: P.admin.id, email: "admin", sees: "Runs the church; role changes she makes wait for the pastor" },
    { who: "Follow-up head", personId: P.outreach.id, email: "followup", sees: "First-timers board, picks the follow-up team and assigns, outreach contacts" },
    { who: "Membership Ministry head", personId: P.membership.id, email: "membership", sees: "New joiners to confirm, placements, prayer requests" },
    { who: "Media head", personId: P.media.id, email: "media", sees: "Media department, a request to join Media, roll call, events, a media assistant" },
    { who: "Head usher", personId: P.usher.id, email: "usher", sees: "Today's service card, headcount, check-in screen, offering counts, a new-role card" },
    { who: "Welfare head", personId: P.welfare.id, email: "welfare", sees: "Welfare requests and decisions" },
    { who: "Worker", personId: P.worker.id, email: "worker", sees: "Worker home: check-in, next step, her team" },
    { who: "Member", personId: P.member.id, email: "member", sees: "Member home: check-in, classes, prayer, events" },
    { who: "Branch pastor, Lekki", personId: lekki.pastorId!, email: "lekki.pastor", sees: "Only the Lekki branch: its people, departments and first-timers" },
    { who: "Regional overseer, South-West", personId: overseer.id, email: "southwest.overseer", sees: "The Ibadan and Abeokuta branches" },
    { who: "New joiner (not yet confirmed)", personId: joiner.id, email: "new.joiner", sees: "Joined from Traqi search; waiting to be confirmed" },
  ];
  for (const l of LOGINS) { l.email = `${l.email}@${DOMAIN}`; s.people.find((p) => p.id === l.personId)!.email = l.email; }

  // ---------- give every person, group, role, case, note and household a real id ----------
  const map = new Map<string, string>();
  const uuid = () => crypto.randomUUID();
  [...s.people, ...s.groups, ...s.roles, ...s.cases, ...s.careNotes, ...s.placements, ...s.households].forEach((x) => map.set(x.id, uuid()));
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return map.get(v) ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [map.get(k) ?? k, walk(x)]));
    return v;
  };
  const S = walk(s) as typeof seed;
  // What each sign-in can see, checked with the app's own rules
  const seen = LOGINS.map((l) => { const a = accessFor(S, map.get(l.personId)!); return `${l.who}: sees ${a.visiblePeople().length} people${a.isPastoral ? ", pastor" : ""}${a.isMemberOnly ? ", member view" : ""}`; });
  console.log(seen.join("\n"));
  const lekkiSees = accessFor(S, map.get(lekki.pastorId!)!).visiblePeople();
  expect(lekkiSees.every((p) => p.branchId === "br-lekki" || p.id === map.get(lekki.pastorId!))).toBe(true);
  expect(accessFor(S, map.get(P.lead.id)!).visiblePeople().length).toBe(S.people.length);
  const churchId = uuid();
  const T = tables(S, churchId) as Record<string, Map<string, Record<string, unknown>>>;
  // activity_log ids come from the database
  const rows = (t: string) => [...(T[t]?.values() ?? [])].map((row) => (t === "activity_log" ? { ...row } : row));

  // ---------- write the SQL ----------
  // Data is written between $demo$ marks, so apostrophes ("God's") need no escaping, with one record per line
  const q = (x: unknown) => {
    const body = Array.isArray(x) ? `[\n${x.map((v) => JSON.stringify(v)).join(",\n")}\n]` : JSON.stringify(x);
    if (body.includes("$demo$")) throw new Error("data contains the quote mark");
    return `$demo$${body}$demo$`;
  };
  const genDate = new Date().toISOString().slice(0, 10);
  const userIds = LOGINS.map((l) => ({ ...l, uid: uuid(), pid: map.get(l.personId)! }));
  const ORDER = ["people", "groups", "group_members", "roles", "role_assignments", "followup_cases", "followup_contacts", "care_notes", "placements",
    "meetings", "headcounts", "attendance_records", "absences", "welfare_requests", "programmes", "class_sessions", "enrolments", "registrations", "service_counts", "lodgements",
    "transfers", "message_templates", "announcements", "wishes", "invites", "app_feedback", "prayer_requests", "download_log", "outreaches", "outreach_contacts", "welfare_minutes", "activity_log"];
  const ins = (t: string, list: Record<string, unknown>[]) => {
    if (!list.length) return "";
    const cols = [...new Set(list.flatMap((x) => Object.keys(x)))];
    const out: string[] = [];
    for (let i = 0; i < list.length; i += 400) {
      out.push(`insert into ${t} (${cols.join(", ")}) select ${cols.join(", ")} from jsonb_populate_recordset(null::${t}, pg_temp.shift(${q(list.slice(i, i + 400))}::jsonb));`);
    }
    return out.join("\n");
  };
  const churchRow = { id: churchId, name: S.church.name, slug: "graceville", country: "Nigeria", currency: "NGN", time_zone: "Africa/Lagos", attendance_goal: S.church.attendanceGoal ?? 400, template: "pentecostal", profile: S.church.profile, verified: true, city: "Ikeja", plan: "trial" };
  const households = S.households.map((h) => ({ id: h.id, church_id: churchId, name: h.name, address: h.address ?? null }));

  const sql = `-- =====================================================================
-- Traqi for Churches: the Graceville Church demo
-- A complete, made-up church to show anyone how Traqi works:
-- ${S.people.length} people, headquarters in Ikeja plus 4 branches in 2 regions, pastors, leaders,
-- workers, members, first-timers, classes, events, offerings, welfare, prayer and 14 sign-ins.
--
-- Run once in Supabase: SQL Editor > New query > paste all > Run.
-- To remove it later, run traqi-remove-demo-church.sql.
-- Every sign-in uses the password: ${PASSWORD}
-- Dates move forward to today automatically, so it always looks current.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- All or nothing: if anything fails, nothing is added
begin;
set local search_path = public, extensions;

-- How far to move every date: whole weeks since this file was made, so Sundays stay Sundays
drop table if exists pg_temp._demo_shift;
create temp table _demo_shift as select (((current_date - date '${genDate}') / 7) * 7)::int as d;

create or replace function pg_temp.shift(j jsonb) returns jsonb language plpgsql as $f$
declare d int := (select d from _demo_shift); k text; v jsonb; out jsonb; s text;
begin
  if d = 0 then return j; end if;
  case jsonb_typeof(j)
    when 'object' then out := '{}'; for k, v in select * from jsonb_each(j) loop out := out || jsonb_build_object(k, pg_temp.shift(v)); end loop; return out;
    when 'array' then select coalesce(jsonb_agg(pg_temp.shift(x) order by n), '[]') into out from jsonb_array_elements(j) with ordinality t(x, n); return out;
    when 'string' then
      s := j #>> '{}';
      if s ~ '^\\d{4}-\\d{2}-\\d{2}T' then return to_jsonb(to_char((s::timestamptz + make_interval(days => d)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')); end if;
      if s ~ '^\\d{4}-\\d{2}-\\d{2}$' then return to_jsonb(to_char(s::date + d, 'YYYY-MM-DD')); end if;
      return j;
    else return j;
  end case;
end $f$;

do $$ begin
  if exists (select 1 from churches where slug = 'graceville') then
    raise exception 'The Graceville demo is already here. Run traqi-remove-demo-church.sql first to start again.';
  end if;
end $$;

-- The church
insert into churches (id, name, slug, country, currency, time_zone, attendance_goal, template, profile, verified, city, plan)
select id, name, slug, country, currency, time_zone, attendance_goal, template, profile, verified, city, plan from jsonb_populate_record(null::churches, pg_temp.shift(${q(churchRow)}::jsonb));
${ins("households", households)}

${ORDER.filter((t) => t !== "events" && t !== "attendance_records").map((t) => ins(t, rows(t))).filter(Boolean).join("\n")}

-- Sunday attendance, written compactly: [id, service, person, how, when]
insert into attendance_records (id, church_id, meeting_id, person_id, data)
select x->>0, '${churchId}', x->>1, (x->>2)::uuid, pg_temp.shift(jsonb_build_object('id', x->>0, 'meetingId', x->>1, 'personId', x->>2, 'method', x->>3, 'at', x->>4))
from jsonb_array_elements(${q(S.attendance.map((a) => [a.id, a.meetingId, a.personId, a.method, a.at]))}::jsonb) x;

-- Sign-ins (password: ${PASSWORD})
${userIds.map((u) => `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '${u.uid}', 'authenticated', 'authenticated', '${u.email}', crypt('${PASSWORD}', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', ${q({ demo: "graceville", role: u.who })}, now(), now());
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '${u.uid}', '${u.uid}', jsonb_build_object('sub', '${u.uid}', 'email', '${u.email}', 'email_verified', true), 'email', now(), now(), now());
update people set user_id = '${u.uid}' where id = '${u.pid}';`).join("\n")}

-- Supabase needs these blank, not empty, for password sign-in to work
do $$ declare c text; begin
  for c in select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users'
    and column_name in ('confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change', 'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token') loop
    execute format('update auth.users set %I = coalesce(%I, '''') where email like ''%%@${DOMAIN}''', c, c);
  end loop;
end $$;

-- Events go in as the lead pastor, who is allowed to publish them
select set_config('request.jwt.claim.sub', '${userIds[0].uid}', true);
${ins("events", rows("events"))}
select set_config('request.jwt.claim.sub', '', true);

commit;

do $$ begin raise notice 'Graceville Church is ready: % people, % branches.', (select count(*) from people p join churches c on c.id = p.church_id where c.slug = 'graceville'), 4; end $$;
`;
  writeFileSync(OUT, sql);
  writeFileSync(OUT.replace("traqi-demo-church.sql", "traqi-remove-demo-church.sql"), `-- Removes the Graceville Church demo and its sign-ins. Your own churches are not touched.
delete from churches where slug = 'graceville';
delete from auth.identities where user_id in (select id from auth.users where email like '%@${DOMAIN}');
delete from auth.users where email like '%@${DOMAIN}';
`);
  writeFileSync(OUT.replace(".sql", "-logins.json"), JSON.stringify({ password: PASSWORD, logins: userIds.map(({ who, email, sees }) => ({ who, email, sees })), people: S.people.length, adults: S.people.filter((p) => !p.isChild).length }, null, 1));
});
