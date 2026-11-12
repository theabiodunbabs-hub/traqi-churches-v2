// In-memory router used only by the single-file preview build.
import { useSyncExternalStore } from "react";

let path = "/login";
let query = "";
export const currentQuery = () => query;
const listeners = new Set<() => void>();
const history: string[] = [];

export function navigate(to: string, replace = false) {
  if (!replace) history.push(path);
  const [p, q] = to.split("?");
  path = p;
  query = q ?? "";
  // Pages read ?edit=1 and similar from location.search, so mirror the query there.
  try { window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "")); } catch { /* not allowed here */ }
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") window.scrollTo({ top: 0 });
}
export function back() { navigate(history.pop() ?? "/today", true); }
export function usePath() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => path, () => path);
}

export const ROUTES = [
  "/", "/login", "/signup", "/welcome", "/update", "/display/welcome", "/today", "/people", "/people/import", "/people/:id",
  "/first-timers", "/departments", "/departments/:id", "/settings/roles", "/settings/billing", "/activity",
  "/attendance", "/welfare", "/classes", "/classes/:id", "/classes/certificate/:id", "/events", "/events/:id", "/finance", "/messages",
  "/settings/templates", "/settings/church", "/owner", "/checkin/:church", "/display/checkin", "/e/:church/:event", "/c/:church", "/invite/:token",
  "/start", "/join", "/prayer", "/meeting", "/settings/journey", "/settings/branches", "/settings/email",
  // Short event links come last, so every named page above wins
  "/:church/:event",
];
export function match(p: string): { route: string; params: Record<string, string> } {
  for (const r of ROUTES) {
    const a = r.split("/"), b = p.split("/");
    if (a.length !== b.length) continue;
    const params: Record<string, string> = {};
    if (a.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = decodeURIComponent(b[i])), true) : seg === b[i]))) return { route: r, params };
  }
  return { route: "/today", params: {} };
}
