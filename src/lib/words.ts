import type { ChurchProfile, TermKey } from "./types";

/** Traqi's default words. A church can replace any of them with its own. */
export const DEFAULT_TERMS: Record<TermKey, string> = {
  firstTimer: "First-timer", firstTimers: "First-timers", followUp: "Follow-up",
  department: "Department", departments: "Departments", welfare: "Welfare",
  worker: "Worker", workers: "Workers", member: "Member", members: "Members",
};

export const TERM_LABELS: { key: TermKey; plural?: TermKey; hint: string; examples: string }[] = [
  { key: "firstTimer", plural: "firstTimers", hint: "Someone visiting for the first time", examples: "Guest, New friend, Visitor" },
  { key: "followUp", hint: "Reaching out to new people", examples: "Assimilation, Connect, Outreach" },
  { key: "department", plural: "departments", hint: "Groups people serve in", examples: "Unit, Ministry, Team" },
  { key: "welfare", hint: "Practical help for people in need", examples: "Benevolence, Care, Support" },
  { key: "worker", plural: "workers", hint: "People who serve in a department", examples: "Volunteer, Servant, Minister" },
  { key: "member", plural: "members", hint: "People who belong to the church", examples: "Family, Partner" },
];

export type Words = Record<TermKey, string> & { lower: (k: TermKey) => string };

/** The church's words, falling back to Traqi's. */
export function wordsFor(profile?: Partial<ChurchProfile>): Words {
  const t = { ...DEFAULT_TERMS, ...Object.fromEntries(Object.entries(profile?.terms ?? {}).filter(([, v]) => v && v.trim())) } as Record<TermKey, string>;
  return { ...t, lower: (k: TermKey) => t[k].toLowerCase() };
}
