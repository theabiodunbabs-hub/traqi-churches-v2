/**
 * Each church's own journey: the stages people move through, in the church's own words,
 * and what moves someone into each stage.
 */

/** What a stage means to Traqi, whatever the church calls it. */
export type StageKind = "visitor" | "member" | "worker" | "leader";
/** What moves someone into a stage. */
export type StageRule = "added" | "returned" | "enrolled" | "class" | "class_confirm" | "manual";

export type JourneyStage = { key: string; name: string; kind: StageKind; rule: StageRule; classId?: string };
export type Probation = {
  enabled: boolean;
  /** Months a probation lasts. */
  months: number;
  /** Every new worker starts on probation, even after the class. */
  everyNewWorker?: boolean;
  /** Things that wait until someone is confirmed. */
  holdBack: ("head" | "assistant" | "count")[];
};
export type Journey = { preset?: JourneyPreset; stages: JourneyStage[]; probation?: Probation };
export type JourneyPreset = "class_first" | "members_certified" | "class_to_serve";

export const RULES: { k: StageRule; label: string; needsClass?: boolean }[] = [
  { k: "added", label: "They're added here" },
  { k: "returned", label: "After coming back a second time" },
  { k: "enrolled", label: "When they start a class", needsClass: true },
  { k: "class", label: "After finishing a class", needsClass: true },
  { k: "class_confirm", label: "After finishing a class, then a leader confirms", needsClass: true },
  { k: "manual", label: "A pastor or admin moves them" },
];
export const KINDS: { k: StageKind; label: string; hint: string }[] = [
  { k: "visitor", label: "Visitor", hint: "Still getting to know the church" },
  { k: "member", label: "Member", hint: "Belongs to the church" },
  { k: "worker", label: "Worker", hint: "Serves in a department" },
  { k: "leader", label: "Leader", hint: "Leads people" },
];

export const PRESETS: Record<JourneyPreset, { name: string; summary: string; stages: JourneyStage[] }> = {
  class_first: {
    name: "Class first",
    summary: "A membership class makes you a member; a workers' class makes you a worker.",
    stages: [
      { key: "first_timer", name: "First-timer", kind: "visitor", rule: "added" },
      { key: "returning", name: "Returning", kind: "visitor", rule: "returned" },
      { key: "discipleship", name: "In discipleship", kind: "visitor", rule: "enrolled", classId: "pr-foundation" },
      { key: "member", name: "Member", kind: "member", rule: "class", classId: "pr-foundation" },
      { key: "worker", name: "Worker", kind: "worker", rule: "class_confirm", classId: "pr-workers" },
      { key: "leader", name: "Leader", kind: "leader", rule: "manual" },
    ],
  },
  members_certified: {
    name: "Members, then certified",
    summary: "Coming regularly makes you a member; the class certifies you.",
    stages: [
      { key: "first_timer", name: "Visitor", kind: "visitor", rule: "added" },
      { key: "member", name: "Member", kind: "member", rule: "returned" },
      { key: "certified", name: "Certified member", kind: "member", rule: "class" },
      { key: "worker", name: "Worker", kind: "worker", rule: "manual" },
      { key: "leader", name: "Leader", kind: "leader", rule: "manual" },
    ],
  },
  class_to_serve: {
    name: "Class to serve",
    summary: "You're a member from the start; discipleship qualifies you to serve.",
    stages: [
      { key: "member", name: "Member", kind: "member", rule: "added" },
      { key: "worker", name: "Worker", kind: "worker", rule: "class_confirm" },
      { key: "leader", name: "Leader", kind: "leader", rule: "manual" },
    ],
  },
};

export const DEFAULT_PROBATION: Probation = { enabled: false, months: 3, holdBack: ["head", "assistant", "count"] };

export function defaultJourney(preset: JourneyPreset = "class_first"): Journey {
  return { preset, stages: PRESETS[preset].stages.map((s) => ({ ...s })), probation: { ...DEFAULT_PROBATION } };
}

// ---- The journey in use, with the colours of the journey ramp ----

export type StageView = JourneyStage & { label: string; tone: string; text: string; index: number };
const TONES = ["bg-j1", "bg-j2", "bg-j3", "bg-j4", "bg-j5", "bg-j6"];

function view(stages: JourneyStage[]): StageView[] {
  const n = stages.length;
  return stages.map((s, i) => {
    // Spread the six ramp shades across however many stages the church has
    const t = n <= 1 ? 5 : Math.round((i / (n - 1)) * 5);
    return { ...s, label: s.name, tone: TONES[t], text: t <= 2 ? "text-on-light" : "text-white", index: i };
  });
}

let current: StageView[] = view(PRESETS.class_first.stages);

/** Called when a church loads or changes its journey. */
export function setJourney(j?: Journey) { current = view(j?.stages?.length ? j.stages : PRESETS.class_first.stages); }
export const journeyStages = () => current;

const unknown = (key: string): StageView => ({ key, name: key.replace(/_/g, " "), label: key.replace(/_/g, " "), kind: "member", rule: "manual", tone: "bg-j3", text: "text-on-light", index: -1 });
export const stageView = (key: string) => current.find((s) => s.key === key) ?? unknown(key);
export const kindOf = (key: string): StageKind => stageView(key).kind;
export const firstStageKey = () => current[0]?.key ?? "first_timer";
/** The first stage of a given kind, e.g. where a newly confirmed worker goes. */
export const firstOfKind = (k: StageKind) => current.find((s) => s.kind === k)?.key;
/** The stage after this one, if any. */
export const nextStageOf = (key: string) => { const i = current.findIndex((s) => s.key === key); return i >= 0 ? current[i + 1] : undefined; };
export const isVisitor = (key: string) => kindOf(key) === "visitor";
export const atLeast = (key: string, k: StageKind) => ["visitor", "member", "worker", "leader"].indexOf(kindOf(key)) >= ["visitor", "member", "worker", "leader"].indexOf(k);

/** When someone finishes a class, the stage it should move them to (or a stage needing confirmation). */
export function stageAfterClass(currentKey: string, programmeId: string): { key: string; confirm: boolean } | null {
  const at = current.findIndex((s) => s.key === currentKey);
  const target = current.find((s, i) => i > at && (s.rule === "class" || s.rule === "class_confirm") && (!s.classId || s.classId === programmeId));
  return target ? { key: target.key, confirm: target.rule === "class_confirm" } : null;
}
