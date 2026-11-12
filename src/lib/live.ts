/**
 * Live data: loads one church from Supabase into the same shape the app uses,
 * and saves changes back. Screens never talk to the database directly; they
 * change state through the store, and syncState writes the difference.
 */
import { supabase } from "./supabase";
import { DEFAULT_PROFILE, emptyCollections } from "./seed-more";
import type { SeedState } from "./seed";
import type { Activity, CareNote, Church, Contact, FollowCase, Group, Household, Person, Placement, Role, RoleAssignment, WelfareRequest } from "./types";
import { keyOf, type ListKey } from "./store";

/**
 * New collections are stored whole in a `data` column, with a few plain columns
 * beside it that the database's privacy rules check.
 */
const JSON_TABLES: { key: ListKey; table: string; cols: (x: Record<string, unknown>) => Row }[] = [
  { key: "meetings", table: "meetings", cols: (x) => ({ kind: x.kind, date: x.date }) },
  { key: "headcounts", table: "headcounts", cols: (x) => ({ meeting_id: x.meetingId }) },
  { key: "attendance", table: "attendance_records", cols: (x) => ({ meeting_id: x.meetingId, person_id: x.personId }) },
  { key: "away", table: "absences", cols: (x) => ({ person_id: x.personId }) },
  { key: "welfare", table: "welfare_requests", cols: (x) => ({
    person_id: x.personId, raised_by: x.raisedById, assignee_id: x.assigneeId ?? null, dept_group_id: x.deptGroupId ?? null,
    stage: x.stage, private: !!x.private, route: x.route, involve_welfare: !!x.involveWelfare }) },
  { key: "programmes", table: "programmes", cols: () => ({}) },
  { key: "sessions", table: "class_sessions", cols: (x) => ({ programme_id: x.programmeId }) },
  { key: "enrolments", table: "enrolments", cols: (x) => ({ person_id: x.personId, programme_id: x.programmeId }) },
  { key: "events", table: "events", cols: (x) => ({ slug: x.slug, status: x.status, created_by: x.createdById }) },
  { key: "registrations", table: "registrations", cols: (x) => ({ event_id: x.eventId, person_id: x.personId ?? null }) },
  { key: "counts", table: "service_counts", cols: (x) => ({ by_id: x.byId }) },
  { key: "lodgements", table: "lodgements", cols: (x) => ({ by_id: x.byId }) },
  { key: "transfers", table: "transfers", cols: (x) => ({ by_id: x.byId }) },
  { key: "templates", table: "message_templates", cols: (x) => ({ owner_id: x.ownerId ?? null }) },
  { key: "announcements", table: "announcements", cols: (x) => ({ by_id: x.byId }) },
  { key: "wishes", table: "wishes", cols: (x) => ({ person_id: x.personId }) },
  { key: "invites", table: "invites", cols: (x) => ({ person_id: x.personId, used_at: x.usedAt ?? null }) },
  { key: "appFeedback", table: "app_feedback", cols: (x) => ({ by_id: x.byId }) },
  { key: "prayers", table: "prayer_requests", cols: (x) => ({ person_id: x.personId }) },
  { key: "downloads", table: "download_log", cols: (x) => ({ by_id: x.byId }) },
];

type Row = Record<string, unknown>;
const db = () => { if (!supabase) throw new Error("Supabase is not configured"); return supabase; };
const nul = <T,>(v: T | undefined | "") => (v === undefined || v === "" ? null : v);
const isUuid = (s?: string) => !!s && /^[0-9a-f-]{36}$/i.test(s);

let currentChurch: string | null = null;

/** Store a file in the church's own folder of the media bucket; returns its public address. */
export async function uploadFileLive(blob: Blob, kind: string, ext = "webp") {
  if (!currentChurch) throw new Error("Sign in to your church first");
  const path = `${currentChurch}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db().storage.from("media").upload(path, blob, { contentType: blob.type || `image/${ext}`, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  return db().storage.from("media").getPublicUrl(path).data.publicUrl;
}

export const EMPTY: SeedState = {
  church: { name: "", slug: "", currency: "NGN", country: "Nigeria", timeZone: "Africa/Lagos", trialEndsAt: new Date().toISOString(), template: "blank", profile: DEFAULT_PROFILE() },
  placements: [], pendingContact: null, people: [], households: [], groups: [], roles: [], assignments: [],
  cases: [], careNotes: [], weeks: [], activity: [], ...emptyCollections(),
};

// ---------- database rows -> app ----------
const person = (r: Row): Person => ({
  id: r.id as string, firstName: r.first_name as string, lastName: r.last_name as string, gender: r.gender as "M" | "F",
  phone: r.phone as string, whatsapp: (r.whatsapp as string) ?? undefined, email: (r.email as string) ?? undefined,
  birthday: (r.birthday as string) ?? undefined, location: (r.location as string) ?? undefined, occupation: (r.occupation as string) ?? undefined,
  stage: r.stage as Person["stage"], householdId: (r.household_id as string) ?? undefined, isChild: !!r.is_child,
  firstVisit: (r.first_visit as string) ?? String(r.created_at).slice(0, 10), lastSeen: (r.last_seen as string) ?? undefined,
  missedInARow: (r.missed_in_a_row as number) ?? 0, tracked: !!r.tracked, heardFrom: (r.heard_from as string) ?? undefined,
  consent: r.consent_at ? { at: r.consent_at as string, via: r.consent_via as NonNullable<Person["consent"]>["via"] } : undefined,
  photo: (r.photo_url as string) ?? undefined, inactive: (r.inactive as Person["inactive"]) ?? undefined, isLeader: !!r.is_leader,
  anniversary: (r.anniversary as string) ?? undefined, feedback: (r.feedback as Person["feedback"]) ?? undefined, prefs: (r.prefs as Person["prefs"]) ?? undefined, custom: (r.custom as Person["custom"]) ?? undefined,
  confirmedAt: (r.confirmed_at as string) ?? undefined, joinedVia: (r.joined_via as Person["joinedVia"]) ?? undefined,
  branchId: (r.branch_id as string) ?? undefined,
  ...((r.extra as Pick<Person, "possibleMatchId" | "unavailable" | "probation" | "awaitingStage">) ?? {}),
});

// ---------- app -> database rows ----------
const personRow = (p: Person, c: string): Row => ({
  id: p.id, church_id: c, first_name: p.firstName, last_name: p.lastName, gender: p.gender, phone: p.phone,
  whatsapp: nul(p.whatsapp), email: nul(p.email), birthday: nul(p.birthday), location: nul(p.location), occupation: nul(p.occupation),
  stage: p.stage, household_id: nul(p.householdId), is_child: !!p.isChild, first_visit: nul(p.firstVisit), last_seen: nul(p.lastSeen),
  missed_in_a_row: p.missedInARow ?? 0, tracked: !!p.tracked, heard_from: nul(p.heardFrom),
  consent_at: p.consent?.at ?? null, consent_via: p.consent?.via ?? null,
  photo_url: nul(p.photo), inactive: p.inactive ?? null, is_leader: !!p.isLeader, anniversary: nul(p.anniversary), feedback: p.feedback ?? [], prefs: p.prefs ?? {}, custom: p.custom ?? {},
  confirmed_at: p.confirmedAt ?? null, joined_via: p.joinedVia ?? null, branch_id: nul(p.branchId),
  extra: { possibleMatchId: p.possibleMatchId, unavailable: p.unavailable, probation: p.probation, awaitingStage: p.awaitingStage },
});
const groupRow = (g: Group, c: string): Row => ({
  id: g.id, church_id: c, name: g.name, kind: g.kind, purpose: nul(g.purpose), parent_id: nul(g.parentId),
  supervisor_id: nul(g.supervisorId), overseer_id: nul(g.overseerId), tags: g.tags ?? [], branch_id: nul(g.branchId),
  extra: { whatsapp: g.whatsapp, assistants: g.assistants ?? [], requiresStage: g.requiresStage, requiresClassId: g.requiresClassId, followup: g.followup },
});
const roleRow = (r: Role, c: string): Row => ({ id: r.id, church_id: c, key: r.key, name: r.name, description: nul(r.description), level: r.level, is_default: r.isDefault, permissions: r.permissions });
const assignmentRow = (a: RoleAssignment, c: string): Row => ({
  church_id: c, person_id: a.personId, role_id: a.roleId, scope_type: a.scope.type, scope_group_ids: a.scope.type === "groups" ? a.scope.groupIds : [],
  scope_ref: a.scope.type === "branch" ? a.scope.branchId : a.scope.type === "region" ? a.scope.regionId : null,
  until: a.until ?? null, pending: a.pending ?? null,
});
const caseRow = (f: FollowCase, c: string): Row => ({ id: f.id, church_id: c, person_id: f.personId, assignee_id: nul(f.assigneeId), stage: f.stage, created_at: f.createdAt });
const noteRow = (n: CareNote, c: string): Row => ({ id: n.id, church_id: c, person_id: n.personId, level: n.level, body: n.body, author_id: n.authorId, shared_with: n.sharedWith, created_at: n.at });
const placementRow = (p: Placement, c: string): Row => ({ id: p.id, church_id: c, person_id: p.personId, group_id: p.groupId, note: nul(p.note), status: p.status, created_at: p.at });

/** Every table we sync, keyed so we can tell new rows from changed ones. */
export function tables(s: SeedState, c: string) {
  const members: Row[] = [];
  s.groups.forEach((g) => {
    new Set([...g.leaderIds, ...g.memberIds]).forEach((pid) => members.push({ group_id: g.id, person_id: pid, church_id: c, is_leader: g.leaderIds.includes(pid) }));
  });
  const contacts: Row[] = s.cases.flatMap((f) => f.contacts.map((x: Contact) => ({ case_id: f.id, church_id: c, by_id: x.byId, method: x.method, outcome: x.outcome, reached: x.reached ?? null, at: x.at })));
  return {
    people: new Map(s.people.map((p) => [p.id, personRow(p, c)])),
    groups: new Map(s.groups.map((g) => [g.id, groupRow(g, c)])),
    group_members: new Map(members.map((m) => [`${m.group_id}|${m.person_id}`, m])),
    roles: new Map(s.roles.map((r) => [r.id, roleRow(r, c)])),
    role_assignments: new Map(s.assignments.map((a) => [`${a.personId}|${a.roleId}`, assignmentRow(a, c)])),
    followup_cases: new Map(s.cases.map((f) => [f.id, caseRow(f, c)])),
    followup_contacts: new Map(contacts.map((x) => [`${x.case_id}|${x.at}`, x])),
    care_notes: new Map(s.careNotes.map((n) => [n.id, noteRow(n, c)])),
    placements: new Map(s.placements.map((p) => [p.id, placementRow(p, c)])),
    activity_log: new Map(s.activity.map((a) => [a.id, { church_id: c, actor_id: isUuid(a.actorId) ? a.actorId : null, action: a.text, at: a.at } as Row])),
    churches: new Map([[c, { id: c, name: s.church.name, attendance_goal: s.church.attendanceGoal ?? null, profile: s.church.profile ?? null } as Row]]),
    ...Object.fromEntries(JSON_TABLES.map(({ key, table, cols }) => [table, new Map((s[key] as Record<string, unknown>[]).map((x) => {
      const id = keyOf(key, x);
      // Welfare minutes live in their own table so the person who asked can't read them.
      const data = key === "welfare" ? { ...x, minutes: [] } : x;
      return [id, { id, church_id: c, ...cols(x), data } as Row];
    }))])) as Record<string, Map<string, Row>>,
    welfare_minutes: new Map(s.welfare.flatMap((w: WelfareRequest) => w.minutes.map((m, i) => [`${w.id}|${i}`, { id: `${w.id}|${i}`, church_id: c, request_id: w.id, data: m } as Row]))),
  };
}
export type Snapshot = Record<string, Map<string, string>>;

export const snapshotOf = (s: SeedState, c: string): Snapshot =>
  Object.fromEntries(Object.entries(tables(s, c)).map(([k, m]) => [k, new Map([...m].map(([id, row]) => [id, JSON.stringify(row)]))])) as Snapshot;

// Insert order respects foreign keys.
const ORDER: string[] = ["churches", "people", "groups", "group_members", "roles", "role_assignments", "followup_cases", "followup_contacts", "care_notes", "placements",
  ...JSON_TABLES.map((t) => t.table), "welfare_minutes", "activity_log"];
const APPEND_ONLY = new Set<string>(["followup_contacts", "activity_log", "welfare_minutes", "app_feedback"]);
/** Collections whose removed items are deleted in the database too. */
const DELETABLE = new Set<string>(["group_members", "role_assignments", "absences", "registrations", "message_templates", "class_sessions", "headcounts"]);

/** Write what changed since the last snapshot. Returns the new snapshot, or the first error. */
export async function syncState(prev: Snapshot, next: SeedState, churchId: string): Promise<{ snapshot: Snapshot; error?: string }> {
  const now = tables(next, churchId) as Record<string, Map<string, Row>>;
  for (const t of ORDER) {
    const before = prev[t] ?? new Map<string, string>(), after = now[t] ?? new Map<string, Row>();
    const inserts: Row[] = [];
    for (const [k, row] of after) {
      const json = JSON.stringify(row);
      if (!before.has(k)) { inserts.push(row); continue; }
      if (before.get(k) === json || APPEND_ONLY.has(t)) continue;
      const q = db().from(t).update(row);
      const { error } =
        t === "group_members" ? await q.eq("group_id", row.group_id as string).eq("person_id", row.person_id as string)
        : t === "role_assignments" ? await q.eq("person_id", row.person_id as string).eq("role_id", row.role_id as string)
        : await q.eq("id", row.id as string).eq(t === "churches" ? "id" : "church_id", churchId);
      if (error) return { snapshot: prev, error: `${t}: ${error.message}` };
    }
    if (inserts.length && t !== "churches") {
      const { error } = await db().from(t).insert(inserts);
      if (error) return { snapshot: prev, error: `${t}: ${error.message}` };
    }
    if (DELETABLE.has(t)) {
      for (const k of before.keys()) {
        if (after.has(k)) continue;
        const [a, b] = k.split("|");
        const { error } = t === "group_members"
          ? await db().from(t).delete().eq("group_id", a).eq("person_id", b)
          : t === "role_assignments" ? await db().from(t).delete().eq("person_id", a).eq("role_id", b)
          : await db().from(t).delete().eq("id", k).eq("church_id", churchId);
        if (error) return { snapshot: prev, error: `${t}: ${error.message}` };
      }
    }
  }
  return { snapshot: snapshotOf(next, churchId) };
}

export type LoadResult =
  | { kind: "ready"; state: SeedState; meId: string; churchId: string; needsTemplates?: boolean }
  | { kind: "no-church"; email?: string };

/** Load the signed-in user's church. Links their account to their record by email first. */
export async function loadChurch(): Promise<LoadResult> {
  const sb = db();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { kind: "no-church" };
  await sb.rpc("claim_person");
  const { data: mine } = await sb.from("people").select("id, church_id").eq("user_id", auth.user.id);
  if (!mine?.length) return { kind: "no-church", email: auth.user.email ?? undefined };
  let pick = mine[0];
  try { const saved = localStorage.getItem("traqi-church"); pick = mine.find((m) => m.church_id === saved) ?? pick; } catch {}
  const c = pick.church_id as string;

  const all = (t: string) => sb.from(t).select("*").eq("church_id", c);
  const [ch, people, households, groups, members, roles, assigns, cases, contacts, notes, placements, activity] = await Promise.all([
    sb.from("churches").select("*").eq("id", c).single(),
    all("people"), all("households"), all("groups"), all("group_members"), all("roles"), all("role_assignments"),
    all("followup_cases"), all("followup_contacts"), all("care_notes"), all("placements"),
    sb.from("activity_log").select("*").eq("church_id", c).order("at", { ascending: false }).limit(300),
  ]);
  const extra = await Promise.all([...JSON_TABLES.map((t) => all(t.table)), all("welfare_minutes")]);
  const json = Object.fromEntries(JSON_TABLES.map((t, i) => [t.key, ((extra[i].data ?? []) as Row[]).map((x) => x.data)]));
  // A church that has never saved templates starts with the ready-written set (saved on first sync).
  const needsTemplates = !(json.templates as unknown[]).length;
  if (needsTemplates) delete json.templates;
  const minutes = ((extra[JSON_TABLES.length].data ?? []) as Row[]);
  (json.welfare as WelfareRequest[] | undefined)?.forEach((w) => {
    w.minutes = minutes.filter((x) => x.request_id === w.id).sort((a, b) => String(a.id).localeCompare(String(b.id))).map((x) => x.data as WelfareRequest["minutes"][number]);
  });
  if (ch.error || !ch.data) throw new Error(ch.error?.message ?? "Church not found");
  const r = ch.data as Row;

  const church: Church & { id: string } = {
    id: c, name: r.name as string, slug: r.slug as string, currency: r.currency as string, country: r.country as string,
    timeZone: r.time_zone as string, attendanceGoal: (r.attendance_goal as number) ?? undefined,
    trialEndsAt: r.trial_ends_at as string, template: (r.template as Church["template"]) ?? "pentecostal",
    profile: { ...DEFAULT_PROFILE(), ...((r.profile as Church["profile"]) ?? {}) }, verified: !!r.verified,
  };
  const m = (members.data ?? []) as Row[];
  const state: SeedState = {
    church,
    pendingContact: null,
    people: ((people.data ?? []) as Row[]).map(person),
    households: ((households.data ?? []) as Row[]).map((h): Household => ({ id: h.id as string, name: h.name as string, address: (h.address as string) ?? undefined })),
    groups: ((groups.data ?? []) as Row[]).map((g): Group => ({
      id: g.id as string, name: g.name as string, kind: g.kind as Group["kind"], purpose: (g.purpose as string) ?? "",
      parentId: (g.parent_id as string) ?? undefined, supervisorId: (g.supervisor_id as string) ?? undefined, overseerId: (g.overseer_id as string) ?? undefined,
      tags: (g.tags as Group["tags"]) ?? [], branchId: (g.branch_id as string) ?? undefined,
      ...((g.extra as Partial<Group>) ?? {}),
      leaderIds: m.filter((x) => x.group_id === g.id && x.is_leader).map((x) => x.person_id as string),
      memberIds: m.filter((x) => x.group_id === g.id).map((x) => x.person_id as string),
    })),
    roles: ((roles.data ?? []) as Row[]).map((x): Role => ({ id: x.id as string, key: x.key as Role["key"], name: x.name as string, description: (x.description as string) ?? "", level: x.level as number, isDefault: !!x.is_default, permissions: (x.permissions as Role["permissions"]) ?? [] })),
    assignments: ((assigns.data ?? []) as Row[]).map((a): RoleAssignment => ({
      personId: a.person_id as string, roleId: a.role_id as string,
      scope: a.scope_type === "groups" ? { type: "groups", groupIds: (a.scope_group_ids as string[]) ?? [] } : a.scope_type === "self" ? { type: "self" }
        : a.scope_type === "branch" ? { type: "branch", branchId: a.scope_ref as string } : a.scope_type === "region" ? { type: "region", regionId: a.scope_ref as string } : { type: "church" },
      until: (a.until as string) ?? undefined, pending: (a.pending as RoleAssignment["pending"]) ?? undefined,
    })),
    cases: ((cases.data ?? []) as Row[]).map((f): FollowCase => ({
      id: f.id as string, personId: f.person_id as string, assigneeId: (f.assignee_id as string) ?? undefined, stage: f.stage as FollowCase["stage"], createdAt: f.created_at as string,
      contacts: ((contacts.data ?? []) as Row[]).filter((x) => x.case_id === f.id).sort((a, b) => String(a.at).localeCompare(String(b.at)))
        .map((x): Contact => ({ at: x.at as string, byId: x.by_id as string, method: x.method as Contact["method"], outcome: x.outcome as string, reached: (x.reached as boolean) ?? undefined })),
    })),
    careNotes: ((notes.data ?? []) as Row[]).map((n): CareNote => ({ id: n.id as string, personId: n.person_id as string, level: n.level as CareNote["level"], body: n.body as string, authorId: n.author_id as string, at: n.created_at as string, sharedWith: (n.shared_with as string[]) ?? [] })),
    placements: ((placements.data ?? []) as Row[]).map((p): Placement => ({ id: p.id as string, personId: p.person_id as string, groupId: p.group_id as string, note: (p.note as string) ?? undefined, status: p.status as Placement["status"], at: p.created_at as string })),
    weeks: [],
    ...emptyCollections(),
    ...(json as Partial<SeedState>),
    activity: ((activity.data ?? []) as Row[]).map((a): Activity => ({ id: `db${a.id}`, at: a.at as string, actorId: (a.actor_id as string) ?? "", text: a.action as string })),
  };
  if (needsTemplates) state.templates = [];
  currentChurch = c;
  return { kind: "ready", state, meId: pick.id as string, churchId: c, needsTemplates };
}

export async function createChurchLive(args: {
  name: string; slug: string; country: string; currency: string; timeZone: string; template: string; goal?: number;
  firstName: string; lastName: string; gender: string; phone: string; email?: string;
}) {
  const { data, error } = await db().rpc("create_church", {
    p_name: args.name, p_slug: args.slug, p_country: args.country, p_currency: args.currency, p_time_zone: args.timeZone,
    p_template: args.template, p_goal: args.goal ?? null, p_first: args.firstName, p_last: args.lastName, p_gender: args.gender,
    p_phone: args.phone, p_email: args.email ?? null,
  });
  if (error) throw new Error(error.message);
  try { localStorage.setItem("traqi-church", data as string); } catch {}
  return data as string;
}

export async function welcomeLive(slug: string, f: { firstName: string; lastName: string; gender: string; phone: string; location?: string; heardFrom?: string }) {
  const { data, error } = await db().rpc("welcome_first_timer", {
    p_slug: slug, p_first: f.firstName, p_last: f.lastName, p_gender: f.gender, p_phone: f.phone,
    p_location: f.location ?? null, p_heard: f.heardFrom ?? null, p_consent: true,
  });
  if (error) throw new Error(error.message);
  return data as "new" | "back";
}

export async function churchPublic(slug: string) {
  const { data } = await db().rpc("church_public", { p_slug: slug });
  return (data as { name: string; slug: string }[] | null)?.[0] ?? null;
}

// ---------- Public pages (no sign-in) ----------
export type PublicChurch = { name: string; slug: string; profile: Partial<NonNullable<SeedState["church"]["profile"]>>; events: SeedState["events"] };
export async function churchPage(slug: string) {
  const { data } = await db().rpc("church_page", { p_slug: slug });
  return (data as PublicChurch | null) ?? null;
}
export async function checkinLive(slug: string, code: string, phone: string) {
  const { data, error } = await db().rpc("checkin_public", { p_slug: slug, p_code: code, p_phone: phone });
  if (error) throw new Error(error.message);
  return data as { status: "ok" | "already" | "not-found" | "bad-code" | "no-meeting" | "no-church"; meeting?: string };
}
export async function welcomeV2(slug: string, f: { firstName?: string; lastName?: string; gender?: string; phone: string; location?: string; heardFrom?: string; consent?: boolean; feedback?: unknown }) {
  const { data, error } = await db().rpc("welcome_v2", {
    p_slug: slug, p_first: f.firstName ?? "", p_last: f.lastName ?? "", p_gender: f.gender ?? "", p_phone: f.phone,
    p_location: f.location ?? "", p_heard: f.heardFrom ?? "", p_consent: !!f.consent, p_feedback: f.feedback ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { status: "new" | "back" | "updated" };
}
export async function eventPage(slug: string, event: string) {
  const { data } = await db().rpc("event_page", { p_slug: slug, p_event: event });
  return (data as { church: Omit<PublicChurch, "events">; event: SeedState["events"][number]; registered: number } | null) ?? null;
}
export async function registerEvent(slug: string, event: string, reg: Record<string, unknown>) {
  const { data, error } = await db().rpc("register_event", { p_slug: slug, p_event: event, p_reg: reg });
  if (error) throw new Error(error.message);
  return data as { status: "confirmed" | "waitlist" | "pending" | "already"; ticket: string; tickets?: { name: string; ticket: string; status: "confirmed" | "waitlist" | "pending" | "already" }[] };
}
export async function eventFeedback(slug: string, event: string, ticket: string, answers: Record<string, string>) {
  const { error } = await db().rpc("event_feedback", { p_slug: slug, p_event: event, p_ticket: ticket, p_answers: answers });
  if (error) throw new Error(error.message);
}
export async function redeemInvite(token: string) {
  const { error } = await db().rpc("redeem_invite", { p_token: token });
  return error?.message ?? null;
}
export async function ownerStats() {
  const { data, error } = await db().rpc("owner_stats");
  if (error) throw new Error(error.message);
  return data as { churches: Record<string, string | number>[]; feedback: { church: string; text: string; screen: string; at: string }[] };
}
export async function isOwnerLive() {
  const { data } = await db().rpc("is_owner");
  return data === true;
}
export async function welcomeCustom(slug: string, phone: string, answers: Record<string, string>) {
  const { error } = await db().rpc("welcome_custom", { p_slug: slug, p_phone: phone, p_answers: answers });
  if (error) throw new Error(error.message);
}

// ---------- Joining and starting churches ----------
export type FoundChurch = { id: string; name: string; slug: string; city?: string; state?: string; address?: string; logo?: string; color?: string; verified: boolean; branches: { id: string; name: string; city?: string; address?: string }[] };
export async function findChurches(q: string): Promise<FoundChurch[]> {
  const { data, error } = await db().rpc("find_churches", { q });
  if (error) throw new Error(error.message);
  return (data as FoundChurch[]) ?? [];
}
export async function slugAvailable(s: string): Promise<{ ok: boolean; slug?: string; reason?: string; suggest?: string[] }> {
  const { data, error } = await db().rpc("slug_available", { s });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; slug?: string; reason?: string; suggest?: string[] };
}
export async function createChurchV2(payload: Record<string, unknown>) {
  const { data, error } = await db().rpc("create_church_v2", { p: payload });
  if (error) throw new Error(error.message);
  try { localStorage.setItem("traqi-church", data as string); } catch {}
  return data as string;
}
export async function joinChurchLive(payload: { church: string; branch?: string; firstName: string; lastName: string; gender: string; phone: string; birthday?: string }) {
  const { data, error } = await db().rpc("join_church", { p: payload });
  if (error) throw new Error(error.message);
  try { localStorage.setItem("traqi-church", payload.church); } catch {}
  return data as string;
}
export async function mergeJoiner(church: string, newId: string, keepId: string) {
  const { error } = await db().rpc("merge_joiner", { p_church: church, p_new: newId, p_keep: keepId });
  if (error) throw new Error(error.message);
}
export async function myChurches(): Promise<{ id: string; name: string; slug: string; logo?: string; color?: string }[]> {
  const { data } = await db().rpc("my_churches");
  return (data as { id: string; name: string; slug: string; logo?: string; color?: string }[]) ?? [];
}
export async function setChurchVerified(church: string, verified: boolean) {
  const { error } = await db().rpc("set_church_verified", { p_church: church, p_verified: verified });
  if (error) throw new Error(error.message);
}
export const currentChurchId = () => currentChurch;
