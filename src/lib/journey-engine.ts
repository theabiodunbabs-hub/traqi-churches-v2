/**
 * Moves people along their church's journey when things happen:
 * coming back, starting a class, finishing one, being placed in a department.
 * Pure functions over the state, so the demo and live modes behave the same.
 */
import type { SeedState } from "./seed";
import type { Person } from "./types";
import { DEFAULT_PROBATION, atLeast, firstOfKind, journeyStages, kindOf, stageAfterClass } from "./journey";

const idx = (key: string) => journeyStages().findIndex((s) => s.key === key);
const setPerson = (s: SeedState, id: string, patch: Partial<Person>): SeedState => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10); };

/** The first later stage that this kind of event moves people into. */
function laterStage(current: string, rule: "returned" | "enrolled", programmeId?: string) {
  const at = idx(current);
  return journeyStages().find((st, i) => i > at && st.rule === rule && (!st.classId || !programmeId || st.classId === programmeId));
}

export type Moved = { state: SeedState; to?: string; awaiting?: string; probation?: boolean };

/** Came back a second time. */
export function onReturned(s: SeedState, personId: string): Moved {
  const p = s.people.find((x) => x.id === personId);
  const to = p && laterStage(p.stage, "returned");
  return to ? { state: setPerson(s, personId, { stage: to.key }), to: to.key } : { state: s };
}

/** Started a class. */
export function onEnrolled(s: SeedState, personId: string, programmeId: string): Moved {
  const p = s.people.find((x) => x.id === personId);
  const to = p && laterStage(p.stage, "enrolled", programmeId);
  return to ? { state: setPerson(s, personId, { stage: to.key }), to: to.key } : { state: s };
}

/** Finished a class: move them on, or wait for a leader where the stage asks for that. */
export function onClassDone(s: SeedState, personId: string, programmeId: string): Moved {
  const p = s.people.find((x) => x.id === personId);
  if (!p) return { state: s };
  const next = stageAfterClass(p.stage, programmeId);
  let out: Moved = { state: s };
  if (next?.confirm) out = { state: setPerson(s, personId, { awaitingStage: next.key }), awaiting: next.key };
  else if (next) out = { state: setPerson(s, personId, { stage: next.key, awaitingStage: undefined }), to: next.key };
  // Finishing the class a probation was waiting on ends it early
  const pr = out.state.people.find((x) => x.id === personId)?.probation;
  if (pr?.reason === "no_class") {
    const g = s.groups.find((x) => x.id === pr.groupId);
    const workerClass = journeyStages().find((st) => st.kind === "worker")?.classId;
    if ((g?.requiresClassId ?? workerClass) === programmeId) out = { ...out, state: setPerson(out.state, personId, { probation: undefined }) };
  }
  return out;
}

/** A leader confirms a stage someone finished the class for. */
export function confirmStage(s: SeedState, personId: string): Moved {
  const p = s.people.find((x) => x.id === personId);
  if (!p?.awaitingStage) return { state: s };
  return { state: setPerson(s, personId, { stage: p.awaitingStage, awaitingStage: undefined, tracked: true }), to: p.awaitingStage };
}

/** Did they finish the class this department (or the worker stage) asks for? */
export function hasRequiredClass(s: SeedState, personId: string, groupId?: string) {
  const g = s.groups.find((x) => x.id === groupId);
  const need = g?.requiresClassId ?? journeyStages().find((st) => st.kind === "worker" && st.classId)?.classId;
  if (!need) return true;
  return s.enrolments.some((e) => e.personId === personId && e.programmeId === need && e.status === "completed");
}

/** Placed in a department: they become a worker, on probation when the church uses it. */
export function onPlaced(s: SeedState, personId: string, groupId: string): Moved {
  const p = s.people.find((x) => x.id === personId);
  if (!p) return { state: s };
  let state = s;
  let to: string | undefined;
  if (!atLeast(p.stage, "worker")) {
    to = firstOfKind("worker");
    if (to) state = setPerson(state, personId, { stage: to, tracked: true, awaitingStage: undefined });
  }
  const cfg = s.church.profile?.journey?.probation ?? DEFAULT_PROBATION;
  const missing = !hasRequiredClass(s, personId, groupId);
  const becameWorker = !!to || kindOf(p.stage) !== "worker";
  if (cfg.enabled && !p.probation && (missing || (cfg.everyNewWorker && becameWorker))) {
    const now = new Date();
    state = setPerson(state, personId, { probation: { startedAt: now.toISOString(), until: addMonths(now, cfg.months), groupId, reason: missing ? "no_class" : "new_worker" } });
    return { state, to, probation: true };
  }
  return { state, to };
}

/** People whose probation period is over and need a decision. */
export const probationDue = (s: SeedState, today = new Date().toISOString().slice(0, 10)) =>
  s.people.filter((p) => p.probation && p.probation.until <= today);

/** What this person can do next on their journey, in plain words. */
export function nextStepFor(s: SeedState, p: Person): { title: string; body: string; href?: string } | null {
  if (p.awaitingStage) return { title: `Almost ${stageNameOf(p.awaitingStage)}`, body: "You finished the class. A leader will confirm you soon." };
  if (p.probation) return { title: "Serving on probation", body: `Until ${p.probation.until}. ${p.probation.reason === "no_class" ? "Finishing the class ends it early." : "Keep going, you're doing well."}` };
  const at = idx(p.stage);
  const next = journeyStages()[at + 1];
  if (!next) return null;
  const prog = next.classId ? s.programmes.find((x) => x.id === next.classId) : undefined;
  const enrolled = prog && s.enrolments.some((e) => e.personId === p.id && e.programmeId === prog.id && e.status === "active");
  switch (next.rule) {
    case "returned": return { title: "Come again this Sunday", body: `Your next step is ${next.name}.` };
    case "enrolled":
    case "class":
    case "class_confirm":
      return prog ? { title: enrolled ? `Keep going with ${prog.name}` : `Join ${prog.name}`, body: `It's the way to ${next.name}.`, href: `/classes/${prog.id}` }
        : { title: `Next: ${next.name}`, body: "Join the class for this step.", href: "/classes" };
    case "manual": return next.kind === "worker" ? { title: "Ready to serve?", body: "Ask to join a department.", href: "/departments" } : { title: `Next: ${next.name}`, body: "Speak to a pastor about this step." };
    default: return null;
  }
}
const stageNameOf = (k: string) => journeyStages().find((x) => x.key === k)?.name ?? k;
