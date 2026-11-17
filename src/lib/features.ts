import type { SeedState } from "./seed";

/** Branches show once switched on, or when the church already has branches or chose a branch size. */
export const usesBranches = (s: SeedState) => {
  const p = s.church.profile;
  return !!p?.features?.branches || (p?.branches?.length ?? 0) > 0 || p?.level === "branches" || p?.level === "network";
};
/** Department assistants show once switched on, or when any department already has one. */
export const usesAssistants = (s: SeedState) => !!s.church.profile?.features?.assistants || s.groups.some((g) => (g.assistants ?? []).length > 0);
