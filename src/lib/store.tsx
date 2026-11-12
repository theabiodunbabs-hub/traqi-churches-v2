"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LIVE, newId, supabase } from "./supabase";
import { EMPTY, createChurchV2, joinChurchLive, loadChurch, mergeJoiner as mergeJoinerLive, snapshotOf, syncState, type Snapshot } from "./live";
import { atLeast, firstOfKind, firstStageKey, journeyStages, kindOf, stageView, type Journey } from "./journey";
import { confirmStage, onClassDone, onEnrolled, onPlaced, onReturned } from "./journey-engine";
import type { DeptDraft } from "./setup";
import { fullName } from "./format";
import { seed, DEFAULT_ROLES, type SeedState } from "./seed";
import { accessFor, type Access } from "./access";
import { autoPick } from "./metrics";
import { DEFAULT_PROFILE, emptyCollections } from "./seed-more";
import { DEFAULT_TEMPLATES } from "./templates";
import type { Branch, CareNote, Church, ChurchProfile, Contact, Enrolment, FollowStage, Group, PendingContact, PermissionKey, Person, RoleAssignment } from "./types";

/**
 * Demo data layer. Every action here maps to a Supabase call once the
 * database is connected; the shapes match supabase/migrations.
 */
const DATA_KEY = "traqi-demo-v5";
const USER_KEY = "traqi-demo-user";

export type NewPerson = Pick<Person, "firstName" | "lastName" | "gender" | "phone"> & Partial<Person>;
export type ImportRow = NewPerson & { groupName?: string };

export type AuthStatus = "loading" | "signed-out" | "no-church" | "ready";

type Store = {
  ready: boolean;
  mode: "demo" | "live";
  authStatus: AuthStatus;
  authEmail?: string;
  saving: boolean;
  syncError: string | null;
  signInEmail: (email: string, password: string) => Promise<string | null>;
  signUpEmail: (email: string, password: string) => Promise<string | null>;
  signInGoogle: (returnTo: string) => Promise<string | null>;
  reload: () => void;
  state: SeedState;
  me: Person | null;
  access: Access | null;
  signIn: (id: string) => void;
  signOut: () => void;
  resetDemo: () => void;
  person: (id?: string) => Person | undefined;
  findByPhone: (phone: string) => Person | undefined;
  addFirstTimer: (p: NewPerson) => string;
  assignCase: (caseId: string, assigneeId: string) => void;
  moveCase: (caseId: string, stage: FollowStage) => void;
  logContact: (caseId: string, c: Omit<Contact, "at" | "byId">) => void;
  startContact: (personId: string, method: PendingContact["method"]) => void;
  finishContact: (outcome: string | null, reached?: boolean) => void;
  updatePerson: (id: string, patch: Partial<Person>, by?: "self") => void;
  addNote: (n: Omit<CareNote, "id" | "at" | "authorId" | "sharedWith">) => void;
  shareNote: (noteId: string, withId: string) => void;
  togglePermission: (roleId: string, key: PermissionKey) => void;
  addRole: (name: string, description: string, permissions?: PermissionKey[], level?: number) => string;
  updateRole: (roleId: string, patch: { name?: string; description?: string }) => void;
  deleteRole: (roleId: string, moveTo?: string) => void;
  approveRoleChange: (personId: string, roleId: string, ok: boolean) => void;
  /** Move someone's open follow-ups to others on the team (or to one chosen person). */
  handOver: (fromId: string, toId?: string) => number;
  /** Confirm a stage someone finished the class for. */
  confirmStage: (personId: string) => void;
  /** Add or change a branch. New branches start with HQ's departments (copied, editable). */
  saveBranch: (b: Branch, copyDepartments?: boolean) => void;
  removeBranch: (branchId: string) => void;
  /** Move someone to another branch, with a note in the activity log. */
  transferBranch: (personId: string, branchId: string | undefined) => void;
  /** Save the church's journey; anyone in a removed stage moves to the nearest stage of the same kind. */
  saveJourney: (j: Journey) => void;
  /** End-of-probation decision. */
  decideProbation: (personId: string, decision: "confirm" | "extend" | "remove") => void;
  startProbation: (personId: string, groupId?: string) => void;
  addProbationNote: (personId: string, text: string) => void;
  addToGroup: (groupId: string, personId: string) => void;
  updateGroup: (groupId: string, patch: Partial<Group>) => void;
  addUnit: (parentId: string, name: string, purpose: string) => void;
  assignRole: (personId: string, roleId: string, scope: RoleAssignment["scope"], until?: string) => void;
  removeAssignment: (personId: string, roleId: string) => void;
  requestPlacement: (groupId: string, note?: string) => void;
  resolvePlacement: (id: string, accept: boolean) => void;
  importPeople: (rows: ImportRow[], fileName: string) => { added: number; updated: number };
  createChurch: (c: { church: Omit<Church, "trialEndsAt" | "template"> & { profile: ChurchProfile }; me: NewPerson; role: "lead" | "pastor" | "admin"; departments: DeptDraft[] }) => Promise<void>;
  /** Join a church found in search: instant member access, "not yet confirmed" until the admin confirms. */
  joinChurch: (j: { church: string; branch?: string; firstName: string; lastName: string; gender: "M" | "F"; phone: string; birthday?: string }) => Promise<void>;
  /** The admin confirms people who joined from search. */
  confirmPeople: (ids: string[]) => void;
  /** The admin merges a new joiner into the record the church already had. */
  mergeJoiner: (newId: string, keepId: string) => Promise<void>;
  /** Save (add or replace) one item in a collection, with an optional activity-log line. */
  put: <K extends ListKey>(key: K, item: SeedState[K][number], log?: string) => void;
  /** Save several items at once. */
  putMany: <K extends ListKey>(key: K, items: SeedState[K][number][], log?: string) => void;
  drop: <K extends ListKey>(key: K, id: string, log?: string) => void;
  updateChurch: (patch: Partial<Church>, profile?: Partial<NonNullable<Church["profile"]>>, log?: string) => void;
  newId: (prefix: string) => string;
};

export type ListKey = "meetings" | "headcounts" | "attendance" | "away" | "welfare" | "programmes" | "sessions" | "enrolments" | "events" | "registrations"
  | "counts" | "lodgements" | "transfers" | "templates" | "announcements" | "wishes" | "invites" | "appFeedback" | "prayers" | "downloads";

/** How items in each collection are identified. */
export const keyOf = (key: ListKey, item: Record<string, unknown>): string =>
  key === "headcounts" ? String(item.meetingId) : key === "wishes" ? `${item.personId}|${item.kind}|${item.year}|${item.byId}` : key === "invites" ? String(item.token) : String(item.id);

const Ctx = createContext<Store | null>(null);

const fresh = () => JSON.parse(JSON.stringify(seed)) as SeedState;
let uid = 1000;
const nid = (p: string) => (LIVE ? newId() : `${p}${++uid}${Math.floor(Math.random() * 1e4)}`);
const digits = (s: string) => s.replace(/\D/g, "").slice(-10);
const today = () => new Date().toISOString().slice(0, 10);
const nameOf = (s: SeedState, id?: string) => {
  const p = s.people.find((x) => x.id === id);
  return p ? `${p.firstName} ${p.lastName}` : "someone";
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SeedState>(() => (LIVE ? EMPTY : fresh()));
  const [meId, setMeId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(LIVE ? "loading" : "ready");
  const [authEmail, setAuthEmail] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Live mode bookkeeping: what the database last confirmed, and a queue so saves never overlap.
  const snap = useRef<Snapshot | null>(null);
  const churchId = useRef<string | null>(null);
  const loaded = useRef<SeedState | null>(null);
  const latest = useRef(state);
  const queue = useRef<Promise<void>>(Promise.resolve());
  latest.current = state;

  const refresh = useCallback(async () => {
    if (!LIVE) return;
    try {
      const r = await loadChurch();
      if (r.kind === "ready") {
        snap.current = snapshotOf(r.state, r.churchId);
        churchId.current = r.churchId;
        loaded.current = r.state;
        let pending = null;
        try { pending = JSON.parse(localStorage.getItem("traqi-pending-contact") ?? "null"); } catch {}
        setState({ ...r.state, pendingContact: pending, templates: r.needsTemplates ? DEFAULT_TEMPLATES.map((t) => ({ ...t })) : r.state.templates });
        setMeId(r.meId);
        setAuthStatus("ready");
      } else {
        const { data } = await supabase!.auth.getSession();
        setAuthEmail(r.email);
        setAuthStatus(data.session ? "no-church" : "signed-out");
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Couldn't load your church.");
      setAuthStatus("signed-out");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (LIVE) {
      const { data: sub } = supabase!.auth.onAuthStateChange((event, session) => {
        // Supabase asks that no other Supabase call runs inside this callback, so defer.
        if (event === "INITIAL_SESSION") setTimeout(() => (session ? refresh() : (setAuthStatus("signed-out"), setReady(true))), 0);
        if (event === "SIGNED_IN" && !churchId.current) setTimeout(refresh, 0);
        if (event === "SIGNED_OUT") {
          snap.current = null; churchId.current = null; loaded.current = null;
          setState(EMPTY); setMeId(null); setAuthStatus("signed-out");
        }
      });
      return () => sub.subscription.unsubscribe();
    }
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) setState(JSON.parse(raw));
      setMeId(localStorage.getItem(USER_KEY));
    } catch {}
    setReady(true);
  }, [refresh]);

  // Demo: keep data in this browser. Live: save what changed to Supabase.
  useEffect(() => {
    if (!ready) return;
    if (!LIVE) { try { localStorage.setItem(DATA_KEY, JSON.stringify(state)); } catch {} return; }
    try { localStorage.setItem("traqi-pending-contact", JSON.stringify(state.pendingContact)); } catch {}
    if (authStatus !== "ready" || state === loaded.current || !snap.current || !churchId.current) return;
    const t = setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (!snap.current || !churchId.current) return;
        setSaving(true);
        const r = await syncState(snap.current, latest.current, churchId.current);
        snap.current = r.snapshot;
        setSaving(false);
        setSyncError(r.error ? `Couldn't save a change (${r.error}). Check your connection and try again.` : null);
      });
    }, 400);
    return () => clearTimeout(t);
  }, [state, ready, authStatus]);

  const log = useCallback((s: SeedState, actorId: string, text: string): SeedState => ({
    ...s, activity: [{ id: nid("a"), at: new Date().toISOString(), actorId, text }, ...s.activity],
  }), []);

  const api = useMemo<Store>(() => {
    const me = state.people.find((p) => p.id === meId) ?? null;
    const actor = meId ?? "system";

    /** Shared by staff entry, the public welcome form and import. */
    const withFirstTimer = (s: SeedState, p: NewPerson, id: string, by: string): SeedState => {
      const person: Person = { stage: firstStageKey(), firstVisit: today(), lastSeen: today(), missedInARow: 0, whatsapp: p.phone, tracked: true, ...p, id };
      const pick = autoPick({ ...s, people: [...s.people, person] }, person);
      const next = {
        ...s,
        people: [...s.people, person],
        cases: [...s.cases, { id: nid("f"), personId: id, assigneeId: pick?.id, stage: "new" as const, createdAt: new Date().toISOString(), contacts: [] }],
      };
      return log(next, by, pick ? `added first-timer ${p.firstName} ${p.lastName} and assigned them to ${nameOf(s, pick.id)}`
        : `added first-timer ${p.firstName} ${p.lastName}, waiting for someone to follow them up`);
    };

    const contactCase = (s: SeedState, personId: string) => s.cases.find((c) => c.personId === personId && !["member", "unreachable"].includes(c.stage));

    return {
      ready, state, me,
      mode: LIVE ? "live" : "demo", authStatus, authEmail, saving, syncError,
      reload: () => { setSyncError(null); void refresh(); },
      signInEmail: async (email, password) => {
        const { error } = await supabase!.auth.signInWithPassword({ email, password });
        if (error) return error.message === "Invalid login credentials" ? "That email and password don't match." : error.message;
        await refresh();
        return null;
      },
      signUpEmail: async (email, password) => {
        const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/signup` } });
        if (error) return error.message;
        if (!data.session) return "CHECK_EMAIL";
        await refresh();
        return null;
      },
      signInGoogle: async (returnTo) => {
        const { error } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}${returnTo}` } });
        return error ? error.message : null;
      },
      access: me ? accessFor(state, me.id) : null,
      signIn: (id) => { setMeId(id); try { localStorage.setItem(USER_KEY, id); } catch {} },
      signOut: () => {
        if (LIVE) { void supabase!.auth.signOut(); return; }
        setMeId(null); try { localStorage.removeItem(USER_KEY); } catch {}
      },
      resetDemo: () => { setState(fresh()); },
      person: (id) => state.people.find((p) => p.id === id),
      findByPhone: (phone) => state.people.find((p) => digits(p.phone) === digits(phone) && digits(phone).length >= 10),

      addFirstTimer: (p) => {
        const id = nid("p");
        setState((s) => withFirstTimer(s, p, id, meId ?? id));
        return id;
      },
      assignCase: (caseId, assigneeId) => setState((s) => {
        const c = s.cases.find((x) => x.id === caseId);
        return log({ ...s, cases: s.cases.map((x) => (x.id === caseId ? { ...x, assigneeId } : x)) }, actor,
          `assigned ${nameOf(s, c?.personId)} to ${nameOf(s, assigneeId)} for follow-up`);
      }),
      moveCase: (caseId, stage) => setState((s) => {
        const c = s.cases.find((x) => x.id === caseId);
        let next: SeedState = { ...s, cases: s.cases.map((x) => (x.id === caseId ? { ...x, stage } : x)) };
        if (c && stage === "returned") next = onReturned(next, c.personId).state;
        if (c && stage === "member") { const m = firstOfKind("member"); if (m) next = { ...next, people: next.people.map((p) => (p.id === c.personId && !atLeast(p.stage, "member") ? { ...p, stage: m } : p)) }; }
        return log(next, actor, `moved ${nameOf(s, c?.personId)} to "${stage.replace("_", " ")}"`);
      }),
      logContact: (caseId, contact) => setState((s) => {
        const c = s.cases.find((x) => x.id === caseId);
        const cases = s.cases.map((x) => x.id === caseId
          ? { ...x, stage: x.stage === "new" && contact.reached !== false ? ("contacted" as const) : x.stage, contacts: [...x.contacts, { ...contact, at: new Date().toISOString(), byId: actor }] }
          : x);
        return log({ ...s, cases }, actor, `logged a ${contact.method === "whatsapp" ? "WhatsApp message" : contact.method} with ${nameOf(s, c?.personId)}: ${contact.outcome}`);
      }),

      // Call and WhatsApp open outside the app; when the person comes back we ask how it went.
      startContact: (personId, method) => setState((s) => ({ ...s, pendingContact: { personId, method, at: new Date().toISOString() } })),
      finishContact: (outcome, reached) => setState((s) => {
        const pc = s.pendingContact;
        if (!pc || outcome === null) return { ...s, pendingContact: null };
        const c = contactCase(s, pc.personId);
        const entry: Contact = { at: new Date().toISOString(), byId: actor, method: pc.method, outcome, reached };
        const cases = c ? s.cases.map((x) => x.id === c.id ? { ...x, stage: x.stage === "new" && reached ? ("contacted" as const) : x.stage, contacts: [...x.contacts, entry] } : x) : s.cases;
        return log({ ...s, cases, pendingContact: null }, actor, `${pc.method === "call" ? "called" : "sent a WhatsApp message to"} ${nameOf(s, pc.personId)}: ${outcome}`);
      }),

      updatePerson: (id, patch, by) => setState((s) => log({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }, by === "self" ? id : actor,
        by === "self" ? "updated their own details through the update link" : `updated ${nameOf(s, id)}'s profile`)),
      addNote: (n) => setState((s) => log({ ...s, careNotes: [{ ...n, id: nid("c"), at: new Date().toISOString(), authorId: actor, sharedWith: [] }, ...s.careNotes] }, actor,
        n.level === "confidential" ? "added a confidential note" : `added a care note for ${nameOf(s, n.personId)}`)),
      shareNote: (noteId, withId) => setState((s) => log({ ...s, careNotes: s.careNotes.map((n) => (n.id === noteId ? { ...n, sharedWith: [...new Set([...n.sharedWith, withId])] } : n)) }, actor,
        `shared a confidential note with ${nameOf(s, withId)}`)),
      togglePermission: (roleId, key) => setState((s) => {
        const role = s.roles.find((r) => r.id === roleId);
        const has = role?.permissions.includes(key);
        return log({ ...s, roles: s.roles.map((r) => (r.id === roleId ? { ...r, permissions: has ? r.permissions.filter((k) => k !== key) : [...r.permissions, key] } : r)) }, actor,
          `${has ? "removed" : "gave"} "${key}" ${has ? "from" : "to"} the ${role?.name} role`);
      }),
      addRole: (name, description, permissions = [], level = 4) => {
        const id = nid("r-");
        setState((s) => log({ ...s, roles: [...s.roles, { id, key: "custom", name, description, level, isDefault: false, permissions }] }, actor, `created the ${name} role`));
        return id;
      },
      updateRole: (roleId, patch) => setState((s) => {
        const r = s.roles.find((x) => x.id === roleId);
        return log({ ...s, roles: s.roles.map((x) => (x.id === roleId ? { ...x, ...patch } : x)) }, actor,
          patch.name && patch.name !== r?.name ? `renamed the ${r?.name} role to ${patch.name}` : `updated the ${r?.name} role`);
      }),
      deleteRole: (roleId, moveTo) => setState((s) => {
        const r = s.roles.find((x) => x.id === roleId);
        if (!r || r.isDefault) return s;
        const to = s.roles.find((x) => x.id === moveTo);
        const moved = s.assignments.filter((a) => a.roleId === roleId).map((a) => ({ ...a, roleId: to?.id ?? a.roleId }));
        const assignments = [...s.assignments.filter((a) => a.roleId !== roleId), ...(to ? moved.filter((m) => !s.assignments.some((a) => a.personId === m.personId && a.roleId === to.id)) : [])];
        return log({ ...s, roles: s.roles.filter((x) => x.id !== roleId), assignments }, actor,
          `deleted the ${r.name} role${to && moved.length ? ` and moved ${moved.length} ${moved.length === 1 ? "person" : "people"} to ${to.name}` : ""}`);
      }),
      saveBranch: (b, copy) => setState((s) => {
        const prof = s.church.profile ?? DEFAULT_PROFILE();
        const existing = (prof.branches ?? []).some((x) => x.id === b.id);
        const branches = existing ? prof.branches!.map((x) => (x.id === b.id ? b : x)) : [...(prof.branches ?? []), b];
        let groups = s.groups;
        if (!existing && copy) {
          const hq = s.groups.filter((g) => !g.branchId && (g.kind === "department" || g.kind === "unit"));
          const idMap = new Map(hq.map((g) => [g.id, nid("g-")]));
          groups = [...s.groups, ...hq.map((g) => ({ ...g, id: idMap.get(g.id)!, parentId: g.parentId ? idMap.get(g.parentId) ?? g.parentId : undefined,
            branchId: b.id, memberIds: [], leaderIds: [], assistants: [], overseerId: b.pastorId }))];
        }
        return log({ ...s, groups, church: { ...s.church, profile: { ...prof, branches } } }, actor, existing ? `updated the ${b.name} branch` : `opened the ${b.name} branch`);
      }),
      removeBranch: (branchId) => setState((s) => {
        const prof = s.church.profile ?? DEFAULT_PROFILE();
        const b = prof.branches?.find((x) => x.id === branchId);
        return log({ ...s, church: { ...s.church, profile: { ...prof, branches: (prof.branches ?? []).filter((x) => x.id !== branchId) } },
          people: s.people.map((p) => (p.branchId === branchId ? { ...p, branchId: undefined } : p)),
          groups: s.groups.filter((g) => g.branchId !== branchId) }, actor, `closed the ${b?.name} branch; its people now belong to headquarters`);
      }),
      transferBranch: (personId, branchId) => setState((s) => {
        const names = (id?: string) => (id ? s.church.profile?.branches?.find((b) => b.id === id)?.name : undefined) ?? "headquarters";
        const p = s.people.find((x) => x.id === personId);
        // Leaving a branch means leaving that branch's departments too
        const groups = s.groups.map((g) => (g.branchId && g.branchId !== branchId && (g.memberIds.includes(personId) || g.leaderIds.includes(personId))
          ? { ...g, memberIds: g.memberIds.filter((m) => m !== personId), leaderIds: g.leaderIds.filter((m) => m !== personId) } : g));
        return log({ ...s, groups, people: s.people.map((x) => (x.id === personId ? { ...x, branchId } : x)) }, actor, `moved ${nameOf(s, personId)} from ${names(p?.branchId)} to ${names(branchId)}`);
      }),
      saveJourney: (j) => setState((s) => {
        const keys = new Set(j.stages.map((x) => x.key));
        const oldKind = (k: string) => (s.church.profile?.journey?.stages ?? []).find((x) => x.key === k)?.kind ?? kindOf(k);
        const home = (k: string) => j.stages.find((x) => x.kind === oldKind(k))?.key ?? j.stages[0]?.key ?? k;
        const people = s.people.map((p) => (keys.has(p.stage) ? p : { ...p, stage: home(p.stage) }));
        return log({ ...s, people, church: { ...s.church, profile: { ...(s.church.profile ?? DEFAULT_PROFILE()), journey: j } } }, actor, "updated the church's journey");
      }),
      confirmStage: (personId) => setState((s) => {
        const p = s.people.find((x) => x.id === personId);
        const r = confirmStage(s, personId);
        return log(r.state, actor, `confirmed ${nameOf(s, personId)} as ${p?.awaitingStage ? stageView(p.awaitingStage).name : "next stage"}`);
      }),
      decideProbation: (personId, decision) => setState((s) => {
        const p = s.people.find((x) => x.id === personId);
        if (!p?.probation) return s;
        const months = s.church.profile?.journey?.probation?.months ?? 3;
        const until = new Date(); until.setMonth(until.getMonth() + Math.max(1, Math.round(months / 3)));
        let next: SeedState = s;
        if (decision === "confirm") next = { ...s, people: s.people.map((x) => (x.id === personId ? { ...x, probation: undefined } : x)) };
        if (decision === "extend") next = { ...s, people: s.people.map((x) => (x.id === personId ? { ...x, probation: { ...x.probation!, until: until.toISOString().slice(0, 10) } } : x)) };
        if (decision === "remove") {
          const gid = p.probation.groupId;
          next = { ...s, people: s.people.map((x) => (x.id === personId ? { ...x, probation: undefined } : x)),
            groups: gid ? s.groups.map((g) => (g.id === gid ? { ...g, memberIds: g.memberIds.filter((m) => m !== personId) } : g)) : s.groups };
        }
        return log(next, actor, decision === "confirm" ? `confirmed ${nameOf(s, personId)} after probation` : decision === "extend" ? `extended ${nameOf(s, personId)}'s probation` : `ended ${nameOf(s, personId)}'s time serving after probation`);
      }),
      startProbation: (personId, groupId) => setState((s) => {
        const months = s.church.profile?.journey?.probation?.months ?? 3;
        const until = new Date(); until.setMonth(until.getMonth() + months);
        return log({ ...s, people: s.people.map((x) => (x.id === personId ? { ...x, probation: { startedAt: new Date().toISOString(), until: until.toISOString().slice(0, 10), groupId, reason: "new_worker" as const } } : x)) }, actor, `put ${nameOf(s, personId)} on probation`);
      }),
      addProbationNote: (personId, text) => setState((s) => ({ ...s, people: s.people.map((x) => (x.id === personId && x.probation ? { ...x, probation: { ...x.probation, notes: [...(x.probation.notes ?? []), { byId: actor, text, at: new Date().toISOString() }] } } : x)) })),
      handOver: (fromId, toId) => {
        let moved = 0;
        setState((s) => {
          const open = s.cases.filter((c) => c.assigneeId === fromId && ["new", "contacted", "visited"].includes(c.stage));
          let next: SeedState = { ...s, people: s.people.map((p) => (p.id === fromId ? { ...p, unavailable: true } : p)) };
          for (const c of open) {
            const target = toId ?? autoPick(next, next.people.find((p) => p.id === c.personId)!)?.id;
            next = { ...next, cases: next.cases.map((x) => (x.id === c.id ? { ...x, assigneeId: target } : x)) };
          }
          moved = open.length;
          return log(next, actor, `handed over ${open.length} follow-up${open.length === 1 ? "" : "s"} from ${nameOf(s, fromId)}${toId ? ` to ${nameOf(s, toId)}` : ""}`);
        });
        return moved;
      },
      approveRoleChange: (personId, roleId, ok) => setState((s) => {
        const a = s.assignments.find((x) => x.personId === personId && x.roleId === roleId && x.pending);
        if (!a?.pending) return s;
        const role = s.roles.find((r) => r.id === roleId);
        const give = a.pending.action === "give";
        const keep = give ? ok : !ok;
        const assignments = keep ? s.assignments.map((x) => (x === a ? { ...x, pending: undefined } : x)) : s.assignments.filter((x) => x !== a);
        return log({ ...s, assignments }, actor, `${ok ? "approved" : "turned down"} ${give ? "giving" : "removing"} the ${role?.name} role ${give ? "to" : "from"} ${nameOf(s, personId)}`);
      }),
      addToGroup: (groupId, personId) => setState((s) => {
        const g = s.groups.find((x) => x.id === groupId);
        const groups = s.groups.map((x) => (x.id === groupId ? { ...x, memberIds: [...new Set([...x.memberIds, personId])] } : x));
        const placed = g && !g.tags?.includes("family") ? onPlaced({ ...s, groups }, personId, groupId).state : { ...s, groups };
        return log(placed, actor, `added ${nameOf(s, personId)} to ${g?.name}`);
      }),
      updateGroup: (groupId, patch) => setState((s) => {
        const g = s.groups.find((x) => x.id === groupId);
        const groups = s.groups.map((x) => (x.id === groupId ? { ...x, ...patch, memberIds: [...new Set([...(patch.leaderIds ?? []), ...x.memberIds])] } : x));
        // Choosing a head gives them the Department leader role for this department, automatically.
        const dept = s.roles.find((r) => r.key === "dept");
        const deptId = g?.parentId ?? groupId;
        let assignments = s.assignments;
        if (dept && patch.leaderIds) {
          patch.leaderIds.filter((pid) => !g?.leaderIds.includes(pid)).forEach((pid) => {
            const cur = assignments.find((a) => a.personId === pid && a.roleId === dept.id);
            if (cur?.scope.type === "church") return;
            const ids = cur?.scope.type === "groups" ? [...new Set([...cur.scope.groupIds, deptId])] : [deptId];
            assignments = [...assignments.filter((a) => !(a.personId === pid && a.roleId === dept.id)), { personId: pid, roleId: dept.id, scope: { type: "groups", groupIds: ids } }];
          });
        }
        return log({ ...s, groups, assignments }, actor, `updated ${patch.name && patch.name !== g?.name ? `${g?.name}, now called ${patch.name}` : g?.name}`);
      }),
      addUnit: (parentId, name, purpose) => setState((s) => {
        const parent = s.groups.find((x) => x.id === parentId);
        return log({ ...s, groups: [...s.groups, { id: nid("g-"), name, purpose, kind: "unit", parentId, leaderIds: [], memberIds: [] }] }, actor, `added the ${name} unit to ${parent?.name}`);
      }),
      assignRole: (personId, roleId, scope, until) => setState((s) => {
        const role = s.roles.find((r) => r.id === roleId);
        const rest = s.assignments.filter((a) => !(a.personId === personId && a.roleId === roleId));
        const where = scope.type === "groups" ? ` for ${scope.groupIds.map((g) => s.groups.find((x) => x.id === g)?.name).join(", ")}` : "";
        // Anyone other than a pastor proposes; the pastor approves from their notices.
        const pastor = me ? accessFor(s, me.id).isPastoral : true;
        const pending = pastor ? undefined : { byId: actor, at: new Date().toISOString(), action: "give" as const };
        return log({ ...s, assignments: [...rest, { personId, roleId, scope, until, pending }] }, actor,
          `${pending ? "asked the pastor to approve making" : "made"} ${nameOf(s, personId)} ${role?.name}${where}${until ? ` until ${until}` : ""}`);
      }),
      removeAssignment: (personId, roleId) => setState((s) => {
        const role = s.roles.find((r) => r.id === roleId);
        const a = s.assignments.find((x) => x.personId === personId && x.roleId === roleId);
        const pastor = me ? accessFor(s, me.id).isPastoral : true;
        // Withdrawing your own pending request needs no approval
        if (!pastor && a && !(a.pending?.action === "give")) {
          return log({ ...s, assignments: s.assignments.map((x) => (x === a ? { ...x, pending: { byId: actor, at: new Date().toISOString(), action: "remove" as const } } : x)) }, actor,
            `asked the pastor to approve removing the ${role?.name} role from ${nameOf(s, personId)}`);
        }
        return log({ ...s, assignments: s.assignments.filter((a) => !(a.personId === personId && a.roleId === roleId)) }, actor,
          `removed the ${role?.name} role from ${nameOf(s, personId)}`);
      }),
      requestPlacement: (groupId, note) => setState((s) => {
        const g = s.groups.find((x) => x.id === groupId);
        return log({ ...s, placements: [...s.placements, { id: nid("pl"), personId: actor, groupId, note, status: "open", at: new Date().toISOString() }] }, actor, `asked to join ${g?.name}`);
      }),
      resolvePlacement: (id, accept) => setState((s) => {
        const pl = s.placements.find((x) => x.id === id);
        if (!pl) return s;
        const g = s.groups.find((x) => x.id === pl.groupId);
        const groups = accept ? s.groups.map((x) => (x.id === pl.groupId ? { ...x, memberIds: [...new Set([...x.memberIds, pl.personId])] } : x)) : s.groups;
        const people = accept ? onPlaced({ ...s, groups }, pl.personId, pl.groupId).state.people : s.people;
        return log({ ...s, groups, people, placements: s.placements.map((x) => (x.id === id ? { ...x, status: accept ? "accepted" : "declined" } : x)) }, actor,
          `${accept ? "placed" : "declined the request from"} ${nameOf(s, pl.personId)} ${accept ? "in" : "to join"} ${g?.name}`);
      }),
      importPeople: (rows, fileName) => {
        let added = 0, updated = 0;
        setState((s) => {
          const people = [...s.people];
          let groups = s.groups;
          for (const r of rows) {
            const { groupName, ...p } = r;
            const at = people.findIndex((x) => digits(x.phone) === digits(p.phone));
            let id: string;
            if (at >= 0) {
              id = people[at].id;
              const fill = Object.fromEntries(Object.entries(p).filter(([k, v]) => v && !people[at][k as keyof Person]));
              people[at] = { ...people[at], ...fill }; updated++;
            } else {
              id = nid("p");
              people.push({ stage: "member", firstVisit: today(), missedInARow: 0, consent: { at: new Date().toISOString(), via: "import" }, ...p, id }); added++;
            }
            if (groupName) {
              const g = groups.find((x) => x.name.toLowerCase() === groupName.toLowerCase());
              if (g) groups = groups.map((x) => (x.id === g.id ? { ...x, memberIds: [...new Set([...x.memberIds, id])] } : x));
            }
          }
          return log({ ...s, people, groups }, actor, `imported ${added} new and updated ${updated} people from "${fileName}"`);
        });
        return { added: rows.filter((r) => !state.people.some((x) => digits(x.phone) === digits(r.phone))).length, updated: rows.filter((r) => state.people.some((x) => digits(x.phone) === digits(r.phone))).length };
      },
      newId: (p) => nid(p),
      put: (key, item, text) => setState((s) => {
        const k = keyOf(key, item as Record<string, unknown>);
        const list = s[key] as Record<string, unknown>[];
        let next = { ...s, [key]: [...list.filter((x) => keyOf(key, x) !== k), item] } as SeedState;
        if (key === "enrolments") {
          // Starting or finishing a class can move someone along the journey
          const e = item as Enrolment;
          const before = s.enrolments.find((x) => x.id === e.id);
          if (!before) next = onEnrolled(next, e.personId, e.programmeId).state;
          if (e.status === "completed" && before?.status !== "completed") next = onClassDone(next, e.personId, e.programmeId).state;
        }
        return text ? log(next, actor, text) : next;
      }),
      putMany: (key, items, text) => setState((s) => {
        const ks = new Set(items.map((i) => keyOf(key, i as Record<string, unknown>)));
        const list = s[key] as Record<string, unknown>[];
        const next = { ...s, [key]: [...list.filter((x) => !ks.has(keyOf(key, x))), ...items] } as SeedState;
        return text ? log(next, actor, text) : next;
      }),
      drop: (key, id, text) => setState((s) => {
        const list = s[key] as Record<string, unknown>[];
        const next = { ...s, [key]: list.filter((x) => keyOf(key, x) !== id) } as SeedState;
        return text ? log(next, actor, text) : next;
      }),
      updateChurch: (patch, profile, text) => setState((s) => {
        const next = { ...s, church: { ...s.church, ...patch, profile: { ...(s.church.profile ?? DEFAULT_PROFILE()), ...(profile ?? {}) } } };
        return text ? log(next, actor, text) : next;
      }),
      createChurch: async ({ church, me: founder, role, departments }) => {
        if (LIVE) {
          await createChurchV2({
            name: church.name, slug: church.slug, country: church.country, currency: church.currency, timeZone: church.timeZone,
            goal: church.attendanceGoal ?? null, profile: church.profile, role, departments,
            me: { firstName: founder.firstName, lastName: founder.lastName, gender: founder.gender, phone: founder.phone, email: founder.email },
          });
          churchId.current = null;
          await refresh();
          return;
        }
        const id = nid("p");
        const roles = DEFAULT_ROLES.map((r) => ({ ...r }));
        const groups: Group[] = departments.flatMap((d, i) => {
          const gid = `g-${d.key || i}`;
          return [{ id: gid, name: d.name, kind: "department" as const, purpose: d.purpose, tags: d.tags, leaderIds: [], memberIds: [] },
            ...(d.units ?? []).map((u, j) => ({ id: `${gid}-u${j}`, name: u, kind: "unit" as const, parentId: gid, purpose: "", leaderIds: [], memberIds: [] }))];
        });
        const top = church.profile.journey?.stages.at(-1)?.key ?? "leader";
        const next: SeedState = {
          church: { ...church, template: "pentecostal", trialEndsAt: new Date(Date.now() + 60 * 864e5).toISOString(), profile: { ...DEFAULT_PROFILE(), ...church.profile } },
          placements: [], pendingContact: null,
          people: [{ ...founder, id, stage: top, firstVisit: today(), missedInARow: 0, tracked: true, isLeader: true, confirmedAt: new Date().toISOString(), joinedVia: "staff", consent: { at: new Date().toISOString(), via: "staff" } }],
          households: [], cases: [], careNotes: [], weeks: [], ...emptyCollections(),
          groups, roles,
          assignments: [
            { personId: id, roleId: roles.find((r) => r.key === "lead")!.id, scope: { type: "church" } },
            ...(role !== "lead" ? [{ personId: id, roleId: roles.find((r) => r.key === role)!.id, scope: { type: "church" } as const }] : []),
          ],
          activity: [{ id: nid("a"), at: new Date().toISOString(), actorId: id, text: `created ${church.name} on Traqi` }],
        };
        setState(next);
        setMeId(id);
        try { localStorage.setItem(USER_KEY, id); } catch {}
      },
      joinChurch: async (j) => {
        if (LIVE) {
          await joinChurchLive({ ...j });
          churchId.current = null;
          await refresh();
          return;
        }
        // Demo: join Heirs Church as a new member who isn't confirmed yet
        const id = nid("p");
        const match = state.people.find((p) => digits(p.phone).slice(-10) === digits(j.phone).slice(-10));
        const first = journeyStages()[0]?.key ?? "first_timer";
        setState((s) => log({ ...s, people: [...s.people, {
          id, firstName: j.firstName.trim(), lastName: j.lastName.trim(), gender: j.gender, phone: j.phone.trim(), whatsapp: j.phone.trim(), birthday: j.birthday || undefined,
          stage: first, firstVisit: today(), missedInARow: 0, tracked: true, joinedVia: "search", branchId: j.branch, possibleMatchId: match?.id,
          consent: { at: new Date().toISOString(), via: "staff" },
        }] }, id, "joined from Traqi search"));
        setMeId(id);
        try { localStorage.setItem(USER_KEY, id); } catch {}
      },
      confirmPeople: (ids) => setState((s) => log({ ...s, people: s.people.map((p) => (ids.includes(p.id) ? { ...p, confirmedAt: new Date().toISOString(), possibleMatchId: undefined } : p)) }, actor,
        `confirmed ${ids.length === 1 ? fullName(s.people.find((p) => p.id === ids[0])!) : `${ids.length} new people`}`)),
      mergeJoiner: async (newId, keepId) => {
        if (LIVE) {
          await mergeJoinerLive(churchId.current!, newId, keepId);
          churchId.current = null;
          await refresh();
          return;
        }
        setState((s) => {
          const joiner = s.people.find((p) => p.id === newId)!;
          return log({
            ...s,
            people: s.people.filter((p) => p.id !== newId).map((p) => (p.id === keepId ? { ...p, confirmedAt: new Date().toISOString(), possibleMatchId: undefined, joinedVia: joiner.joinedVia } : p)),
            attendance: s.attendance.map((a) => (a.personId === newId ? { ...a, personId: keepId } : a)),
            assignments: s.assignments.filter((a) => a.personId !== newId),
          }, actor, "merged a new joiner with their existing record");
        });
        if (meId === newId) setMeId(keepId);
      },
    };
  }, [state, meId, ready, log, authStatus, authEmail, saving, syncError, refresh]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}
