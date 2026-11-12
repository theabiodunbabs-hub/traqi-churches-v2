import { PENTECOSTAL } from "./templates";
import type { ChurchLevel, GroupTag } from "./types";

/** A department as chosen (and edited) during sign-up. */
export type DeptDraft = { key: string; name: string; purpose: string; tags?: GroupTag[]; units?: string[] };

export const LEVELS: { k: ChurchLevel; name: string; who: string; sets: string; points: string[] }[] = [
  { k: "close", name: "Close-knit church", who: "One pastor, a few departments", sets: "Your lead pastor, 6 core departments and a simple journey.",
    points: ["Everything in one place", "Simple welfare and offerings", "Grow into more later"] },
  { k: "growing", name: "Growing church", who: "A lead pastor with associate pastors or ministers", sets: "A pastoral team, a pastor overseeing each department, full departments and classes.",
    points: ["Pastors oversee departments", "Welfare minutes and approvals", "Classes and certificates"] },
  { k: "branches", name: "Church with branches", who: "One church meeting in several places", sets: "Headquarters plus branches, each with its own pastor, services, people and attendance.",
    points: ["Branch pastors see their branch", "Headquarters sees everything", "Members move between branches"] },
  { k: "network", name: "Network", who: "Many branches grouped into regions or zones", sets: "Headquarters, regions and branches, with regional overseers.",
    points: ["Regional overseers", "Branch league table", "One look across every branch"] },
];

const CLOSE: DeptDraft[] = [
  { key: "ushering", name: "Ushering and Protocol", purpose: "Welcoming people, headcounts and offering counts", tags: ["ushering"] },
  { key: "choir", name: "Worship Team", purpose: "Praise, worship and music" },
  { key: "outreach", name: "Follow-up", purpose: "Reaching every first-timer within 48 hours", tags: ["followup"] },
  { key: "children", name: "Children's Church", purpose: "Teaching the children", tags: ["children"] },
  { key: "media", name: "Media", purpose: "Sound, screens and social media", tags: ["media"] },
  { key: "welfare", name: "Welfare", purpose: "Caring for people in need", tags: ["welfare"] },
];
const FULL: DeptDraft[] = PENTECOSTAL.map((d) => ({ key: d.key, name: d.name, purpose: d.purpose, tags: d.tags, units: d.units?.map((u) => u.name) }));

export function departmentsFor(level: ChurchLevel): DeptDraft[] {
  return (level === "close" ? CLOSE : FULL).map((d) => ({ ...d, units: d.units ? [...d.units] : undefined }));
}

export type RecommendAnswers = { onlyPastor?: boolean; size?: "lt100" | "100-500" | "500-2000" | "gt2000"; places?: "one" | "few" | "many"; regions?: boolean };

/** "Let Traqi recommend": four simple questions decide the setup. */
export function recommend(a: RecommendAnswers): { level: ChurchLevel; why: string } {
  if (a.places === "many" && a.regions) return { level: "network", why: "Your branches are grouped into regions, so regional overseers can each look after their own." };
  if (a.places === "many" || a.places === "few") return { level: "branches", why: "You meet in more than one place, so each branch gets its own pastor and records, and headquarters sees them all." };
  if (a.onlyPastor && (a.size === "lt100" || a.size === "100-500")) return { level: "close", why: "With one pastor, a simple setup keeps everything in one place, and you can grow into more later." };
  return { level: "growing", why: "With a pastoral team, each pastor can oversee their own departments and people." };
}

/** "Christ Apostolic Church Ikeja" → "cac-ikeja"; "Heirs Church" → "heirs". */
export function suggestSlug(name: string) {
  const words = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const filler = new Set(["the", "of", "and", "in", "for", "a", "an"]);
  const generic = new Set(["church", "ministries", "ministry", "international", "chapel", "assembly", "centre", "center", "global", "incorporated", "inc"]);
  const core = words.filter((w) => !filler.has(w));
  if (!core.length) return "";
  // A long name becomes its initials (+ the last word if it's a place); a short one keeps its main word
  if (core.length >= 3) {
    const place = PLACES.has(core[core.length - 1]) ? core[core.length - 1] : "";
    const initials = core.filter((w) => !place || w !== place).map((w) => w[0]).join("");
    return (place ? `${initials}-${place}` : initials).slice(0, 30);
  }
  const main = core.filter((w) => !generic.has(w));
  return (main.length ? main.join("-") : core.join("-")).slice(0, 30);
}

const PLACES = new Set(["lagos", "ikeja", "lekki", "ajah", "yaba", "surulere", "ikoyi", "gbagada", "ikorodu", "festac", "abuja", "ibadan", "kano", "kaduna", "enugu",
  "benin", "jos", "warri", "abeokuta", "ogbomoso", "ilorin", "akure", "owerri", "uyo", "calabar", "port", "harcourt", "ph", "onitsha", "osogbo", "ife", "accra", "kumasi",
  "nairobi", "kampala", "london", "manchester", "houston", "dallas", "toronto", "johannesburg", "magodo", "maryland", "oregun", "ojodu", "agege", "iganmu", "victoria", "island"]);

/** Addresses the app uses for its own pages. */
export const RESERVED_SLUGS = new Set(["today", "people", "first-timers", "welfare", "attendance", "classes", "events", "departments", "finance", "messages", "settings",
  "activity", "owner", "login", "signup", "start", "join", "welcome", "update", "display", "checkin", "invite", "api", "c", "e", "admin", "help", "about",
  "pricing", "privacy", "terms", "support", "traqi", "app", "www", "mail", "static", "public", "auth", "dashboard",
  "prayer", "meeting", "offline", "icons", "sw", "share", "tickets", "ticket", "register", "demo"]);
