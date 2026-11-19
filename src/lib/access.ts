import type { Scope, AssistantPerm, Group, PermissionKey, Person, Placement, RoleAssignment } from "./types";
import type { SeedState } from "./seed";

export const PERMISSIONS: { key: PermissionKey; label: string; area: string }[] = [
  { key: "people.view", label: "View people records", area: "People" },
  { key: "people.edit", label: "Edit people records", area: "People" },
  { key: "people.contacts", label: "See phone numbers and addresses", area: "People" },
  { key: "care.view", label: "Read care notes", area: "Care" },
  { key: "followup.assign", label: "Assign first-timers", area: "Follow-up" },
  { key: "followup.log", label: "Log follow-up contacts", area: "Follow-up" },
  { key: "groups.manage", label: "Manage departments and units", area: "Departments" },
  { key: "attendance.record", label: "Record attendance and headcounts", area: "Attendance" },
  { key: "checkin.code", label: "Run check-in: codes and the check-in screen", area: "Attendance" },
  { key: "headcount.record", label: "Take the service headcount", area: "Attendance" },
  { key: "rollcall.leaders", label: "Take roll call of leaders and the pastorate", area: "Attendance" },
  { key: "finance.count", label: "Submit cash counts", area: "Finance" },
  { key: "finance.approve", label: "Approve count corrections", area: "Finance" },
  { key: "finance.transfers", label: "Enter other income", area: "Finance" },
  { key: "finance.review", label: "Review fund requests", area: "Finance" },
  { key: "finance.view", label: "See finance totals", area: "Finance" },
  { key: "classes.manage", label: "Manage classes", area: "Classes" },
  { key: "events.manage", label: "Create and publish events", area: "Events" },
  { key: "messages.bulk", label: "Send messages to groups", area: "Messages" },
  { key: "roles.manage", label: "Manage roles and permissions", area: "Settings" },
  { key: "sheets.connect", label: "Download lists to Excel", area: "Settings" },
  { key: "activity.view", label: "See the activity log", area: "Settings" },
  { key: "billing.manage", label: "Manage subscription", area: "Settings" },
];

/** Each permission in plain words, for "What can this person do?". */
export const PERMISSION_SAYS: Record<PermissionKey, string> = {
  "people.view": "see people's records",
  "people.edit": "update people's details and stages",
  "people.contacts": "see phone numbers and addresses",
  "care.view": "read care notes shared with them",
  "followup.assign": "choose who follows up first-timers",
  "followup.log": "log calls and visits to first-timers",
  "groups.manage": "manage departments, units and their members",
  "attendance.record": "take roll call and record headcounts",
  "checkin.code": "run check-in: codes and the check-in screen",
  "headcount.record": "take the service headcount",
  "rollcall.leaders": "take roll call of leaders and the pastorate",
  "finance.count": "submit offering counts",
  "finance.approve": "approve corrections to counts",
  "finance.transfers": "enter income from transfers, cheques and other sources",
  "finance.review": "review fund requests",
  "finance.view": "see giving totals",
  "classes.manage": "run classes and mark completion",
  "events.manage": "create and publish events",
  "messages.bulk": "send messages to groups",
  "roles.manage": "give and remove roles",
  "sheets.connect": "download lists to Excel",
  "activity.view": "see the activity log",
  "billing.manage": "manage the subscription",
};

/** Only the lead pastor can hand out these, so no one can widen their own access. */
export const SENSITIVE: PermissionKey[] = ["care.view", "finance.count", "finance.approve", "finance.transfers", "finance.view", "finance.review", "roles.manage", "billing.manage"];

/** Roles a church often adds, ready to use. */
export const READY_ROLES: { name: string; description: string; permissions: PermissionKey[]; level: number }[] = [
  { name: "Protocol lead", description: "Looks after guests, ministers and seating at services and programmes.", permissions: ["people.view", "attendance.record", "events.manage"], level: 4 },
  { name: "Choir director", description: "Leads the choir: rehearsals, roll call and messages.", permissions: ["people.view", "attendance.record", "messages.bulk"], level: 4 },
  { name: "Children's church lead", description: "Runs children's church: check-in, roll call and parents' contacts.", permissions: ["people.view", "people.contacts", "attendance.record"], level: 4 },
  { name: "Cell leader", description: "Leads a home cell: their members and messages.", permissions: ["people.view", "people.contacts", "attendance.record", "messages.bulk"], level: 5 },
  { name: "Secretary", description: "Keeps records, the activity log and downloads.", permissions: ["people.view", "people.edit", "activity.view", "sheets.connect"], level: 3 },
  { name: "Events coordinator", description: "Plans and publishes events and their registrations.", permissions: ["events.manage", "messages.bulk", "people.view"], level: 4 },
];

/** Where a role applies, in words. */
export function scopeLabel(s: SeedState, scope: Scope) {
  switch (scope.type) {
    case "church": return "Whole church";
    case "self": return "Their own record";
    case "groups": return scope.groupIds.map((id) => s.groups.find((g) => g.id === id)?.name).filter(Boolean).join(", ") || "Chosen departments";
    case "branch": return s.church.profile?.branches?.find((b) => b.id === scope.branchId)?.name ?? "A branch";
    case "region": return s.church.profile?.regions?.find((r) => r.id === scope.regionId)?.name ?? "A region";
  }
}

export type Access = ReturnType<typeof accessFor>;

/** Child units and supervised departments count as part of a group's scope. */
function expandGroups(ids: string[], groups: Group[]) {
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of groups) {
      if (out.has(g.id)) continue;
      if ((g.parentId && out.has(g.parentId)) || (g.supervisorId && out.has(g.supervisorId))) { out.add(g.id); grew = true; }
    }
  }
  return out;
}

/** What an assistant's chosen abilities mean in permissions, within their department. */
const ASSISTANT_PERMS: Record<AssistantPerm, PermissionKey[]> = {
  "people.edit": ["people.view", "people.edit", "people.contacts"],
  "people.manage": ["people.view", "groups.manage"],
  rollcall: ["people.view", "attendance.record"],
  message: ["messages.bulk"],
  "followup.assign": ["followup.assign", "followup.log", "people.contacts"],
  "followup.reports": [],
  headcount: ["headcount.record"],
  checkin: ["checkin.code"],
};

/** A role counts once it's approved and until its end date. */
export const roleActive = (a: RoleAssignment, now = Date.now()) => (!a.pending || a.pending.action === "remove") && (!a.until || Date.parse(a.until) > now);

export function accessFor(state: SeedState, personId: string) {
  const mine = state.assignments.filter((a) => a.personId === personId && roleActive(a));
  const perms = new Map<PermissionKey, "church" | Set<string>>();
  /** Permissions limited to whole branches (branch pastors, regional overseers). */
  const branchPerms = new Map<PermissionKey, Set<string>>();
  const roleNames: string[] = [];
  const branchesIn = (regionId: string) => (state.church.profile?.branches ?? []).filter((b) => b.regionId === regionId).map((b) => b.id);
  const grantGroups = (p: PermissionKey, ids: Iterable<string>) => {
    const cur = perms.get(p);
    if (cur === "church") return;
    const set = cur instanceof Set ? cur : new Set<string>();
    for (const id of ids) set.add(id);
    perms.set(p, set);
  };
  for (const a of mine) {
    const role = state.roles.find((r) => r.id === a.roleId);
    if (!role) continue;
    roleNames.push(role.name);
    for (const p of role.permissions) {
      if (a.scope.type === "church" || perms.get(p) === "church") { perms.set(p, "church"); continue; }
      if (a.scope.type === "groups") grantGroups(p, expandGroups(a.scope.groupIds, state.groups));
      if (a.scope.type === "branch" || a.scope.type === "region") {
        const ids = a.scope.type === "branch" ? [a.scope.branchId] : branchesIn(a.scope.regionId);
        const set = branchPerms.get(p) ?? new Set<string>(); ids.forEach((id) => set.add(id)); branchPerms.set(p, set);
        grantGroups(p, state.groups.filter((g) => g.branchId && ids.includes(g.branchId)).map((g) => g.id));
      }
    }
  }
  // Assistants act within their department, with the abilities their head chose
  const assisting = state.groups.filter((g) => g.assistants?.some((x) => x.personId === personId));
  for (const g of assisting) {
    const me = g.assistants!.find((x) => x.personId === personId)!;
    roleNames.push(me.title || `Assistant, ${g.name}`);
    for (const ap of me.perms) for (const p of ASSISTANT_PERMS[ap]) {
      if (p === "followup.assign" || p === "followup.log") { if (perms.get(p) !== "church") perms.set(p, "church"); continue; }
      grantGroups(p, expandGroups([g.id], state.groups));
    }
  }
  const scopedGroups = new Set<string>();
  perms.forEach((v) => { if (v instanceof Set) v.forEach((id) => scopedGroups.add(id)); });

  const keyOf = (roleId: string) => state.roles.find((r) => r.id === roleId)?.key;
  const isPastoral = mine.some((a) => keyOf(a.roleId) === "lead" || keyOf(a.roleId) === "pastor");
  const isLead = mine.some((a) => keyOf(a.roleId) === "lead");
  const isAdmin = mine.some((a) => keyOf(a.roleId) === "admin");
  /** Heads (and for some, their assistants) of departments with a church-wide job. */
  const headsTag = (tags: string[], withAssistants = false) => state.groups.some((g) => g.tags?.some((t) => tags.includes(t))
    && (g.leaderIds.includes(personId) || (withAssistants && !!g.assistants?.some((x) => x.personId === personId))));
  /**
   * Who sees everyone in the church: pastors, the admin, the follow-up and Membership leads and their assistants,
   * and the faculty of training, media, welfare and family life leads. Everyone else sees their own department.
   */
  /** Branch and regional pastors see their own branches, not the whole church. */
  const wholeChurchPastor = mine.some((a) => (keyOf(a.roleId) === "lead" || keyOf(a.roleId) === "pastor") && a.scope.type !== "branch" && a.scope.type !== "region");
  const seesEveryone = wholeChurchPastor || isAdmin || headsTag(["followup", "membership"], true) || headsTag(["training", "media", "welfare", "family"]);
  /** The follow-up team, as picked by the follow-up head (or the follow-up department until they pick). */
  const fuGroup = state.groups.find((g) => g.tags?.includes("followup"));
  const onFollowTeam = !!fuGroup && (fuGroup.followup?.team ?? [...fuGroup.leaderIds, ...fuGroup.memberIds]).includes(personId);
  /** First-timer details: follow-up, Membership and outreach leads and assistants, the follow-up team, and pastors. */
  const seesAllCases = wholeChurchPastor || headsTag(["followup", "membership", "outreach"], true) || onFollowTeam;
  /** Assigning by hand: the follow-up lead and their assistants. */
  const assignsCases = headsTag(["followup"], true) || mine.some((a) => keyOf(a.roleId) === "followup");

  function can(p: PermissionKey, ctx?: { personId?: string; groupId?: string }) {
    const b = branchPerms.get(p);
    if (b?.size) {
      if (!ctx) return true;
      if (ctx.personId) { const t = state.people.find((x) => x.id === ctx.personId); if (t?.branchId && b.has(t.branchId)) return true; }
      if (ctx.groupId) { const g = state.groups.find((x) => x.id === ctx.groupId); if (g?.branchId && b.has(g.branchId)) return true; }
    }
    const v = perms.get(p);
    if (!v) return false;
    if (v === "church") return true;
    if (!ctx) return v.size > 0;
    if (ctx.groupId) return v.has(ctx.groupId);
    if (ctx.personId) return state.groups.some((g) => v.has(g.id) && g.memberIds.includes(ctx.personId!));
    return false;
  }

  /** Who this person may see in People. */
  function visiblePeople(): Person[] {
    if (seesEveryone || perms.get("people.view") === "church") return state.people;
    const ids = new Set<string>([personId]);
    const bv = branchPerms.get("people.view");
    if (bv?.size) state.people.filter((x) => x.branchId && bv.has(x.branchId)).forEach((x) => ids.add(x.id));
    const v = perms.get("people.view");
    if (v instanceof Set) state.groups.filter((g) => v.has(g.id)).forEach((g) => g.memberIds.forEach((m) => ids.add(m)));
    // First-timers: everyone's for the follow-up team and leads; a branch's own for branch staff
    if (seesAllCases) state.cases.forEach((c) => ids.add(c.personId));
    else if (branchPerms.get("followup.assign")?.size) {
      const bs = branchPerms.get("followup.assign")!;
      state.cases.forEach((c) => { const p = state.people.find((x) => x.id === c.personId); if (p?.branchId && bs.has(p.branchId)) ids.add(c.personId); });
    }
    state.cases.filter((c) => c.assigneeId === personId || c.helperIds?.includes(personId)).forEach((c) => ids.add(c.personId));
    // Team-mates in their own departments
    state.groups.filter((g) => g.memberIds.includes(personId) || g.leaderIds.includes(personId)).forEach((g) => [...g.memberIds, ...g.leaderIds].forEach((m) => ids.add(m)));
    return state.people.filter((p) => ids.has(p.id));
  }

  /** A first-timer this person handles: church-wide follow-up sees all; branch staff see their branch's; anyone sees their own. */
  function seesCase(c: { personId: string; assigneeId?: string; helperIds?: string[] }) {
    if (c.assigneeId === personId || c.helperIds?.includes(personId) || seesAllCases) return true;
    const bs = branchPerms.get("followup.assign");
    if (!bs?.size) return false;
    const p = state.people.find((x) => x.id === c.personId);
    return !!p?.branchId && bs.has(p.branchId);
  }
  function canSeeContacts(target: Person) {
    if (target.id === personId) return true;
    if (perms.get("people.contacts") === "church") return true;
    if (state.cases.some((c) => c.personId === target.id && seesCase(c))) return true;
    return can("people.contacts", { personId: target.id });
  }

  function canReadNote(n: { level: "care" | "confidential"; sharedWith: string[] }) {
    if (n.level === "confidential") return isLead || n.sharedWith.includes(personId);
    return perms.has("care.view") && (isPastoral || perms.get("care.view") === "church");
  }

  const isMemberOnly = assisting.length === 0 && (mine.length === 0 || mine.every((a) => ["member", "worker"].includes(keyOf(a.roleId) ?? "")))
    && !state.groups.some((g) => g.leaderIds.includes(personId));
  /** Branches this person looks after (branch pastors, regional overseers); empty for church-wide staff. */
  const myBranches = branchPerms.get("people.view") ?? new Set<string>();
  /** Follow-up assistants allowed to see the team's reports. */
  const seesFollowupReports = isPastoral || state.groups.some((g) => g.tags?.includes("followup") && (g.leaderIds.includes(personId) || g.assistants?.some((x) => x.personId === personId && x.perms.includes("followup.reports"))));
  /** Welfare requests: the welfare department's head, the pastorate and the lead pastor. */
  const seesWelfare = isPastoral || state.groups.some((g) => g.tags?.includes("welfare") && g.leaderIds.includes(personId));
  const leads = new Set(state.groups.filter((g) => g.leaderIds.includes(personId)).map((g) => g.id));
  /**
   * Requests to join a department go to that department's head, who decides alone (a unit's request also reaches
   * its department's head). The overseeing pastors see it once it has waited 7 days, or when the department has no head.
   */
  const decidesPlacement = (pl: Placement) => {
    const g = state.groups.find((x) => x.id === pl.groupId);
    if (!g) return false;
    if (leads.has(g.id) || (g.parentId && leads.has(g.parentId))) return true;
    const headless = !g.leaderIds.length && !(g.parentId && state.groups.find((x) => x.id === g.parentId)?.leaderIds.length);
    return isPastoral && (headless || Date.now() - Date.parse(pl.at) > 7 * 864e5);
  };
  const handlesPlacement = isPastoral || leads.size > 0;
  const isWelfareHead = state.groups.some((g) => g.tags?.includes("welfare") && g.leaderIds.includes(personId));
  const inWelfareTeam = state.groups.some((g) => g.tags?.includes("welfare") && g.memberIds.includes(personId));
  const leadsTraining = isPastoral && state.groups.some((g) => g.tags?.includes("training") && g.overseerId === personId)
    || state.groups.some((g) => g.tags?.includes("training") && g.leaderIds.includes(personId));
  const isMediaHead = state.groups.some((g) => g.tags?.includes("media") && g.leaderIds.includes(personId));

  return {
    personId, can, perms, roleNames, seesCase, scopedGroups, visiblePeople, canSeeContacts, canReadNote, isPastoral, isLead, isMemberOnly,
    seesWelfare: seesWelfare || inWelfareTeam || leads.size > 0, handlesPlacement, decidesPlacement, leads, isWelfareHead, inWelfareTeam, leadsTraining, isMediaHead,
    canFinance: perms.has("finance.view") || perms.has("finance.count") || perms.has("finance.transfers") || branchPerms.has("finance.view"),
    myBranches, seesFollowupReports, branchPerms, isAdmin, seesEveryone, seesAllCases, assignsCases, onFollowTeam,
    /** Special leads open on their own department, with a "See other departments" button. */
    seesAllDepartments: isPastoral || isAdmin || headsTag(["training", "welfare", "media", "followup", "membership"]),
    leadsFamilyLife: headsTag(["family"], true),
    /** Prayer requests: the lead pastor, pastors, Membership Ministry leaders, and anyone the lead pastor added. */
    seesPrayers: isPastoral || state.groups.some((g) => g.tags?.includes("membership") && g.leaderIds.includes(personId))
      || (state.church.profile?.prayerViewers ?? []).includes(personId),
  };
}
