/**
 * Registering for an event as a member: the event page doubles as the way into Traqi.
 * "I'm a member" → Continue with Google → either straight to Home (already in the church), or the form
 * filled in from Google, which registers them AND joins them to the church.
 */
import type { EventQuestion, Registration } from "./types";

/** What the event page knows about whoever signed in with Google. */
export type MemberStatus = {
  signedIn: boolean;
  /** From Google: fills the form for someone new. */
  email?: string; firstName?: string; lastName?: string;
  /** Already a member of the church hosting the event. */
  member: boolean;
  churchId?: string;
  person?: { firstName: string; lastName: string; phone?: string; birthday?: string; gender?: "M" | "F"; email?: string };
  /** Their tickets for this event, if they've registered. */
  tickets: { name: string; ticket: string; status: "confirmed" | "waitlist" | "pending" | "already" }[];
};

/** The page's link back after Google: the event page with this flag. `register` opens the form for a member. */
export const MEMBER_PARAM = "member";
export const REGISTER_PARAM = "register";
export const memberReturn = (path: string, register = false) => `${path}?${MEMBER_PARAM}=1${register ? `&${REGISTER_PARAM}=1` : ""}`;

/** Names from a Google account: given and family name, or the full name split. */
export function namesFromGoogle(meta: Record<string, unknown> | undefined): { firstName: string; lastName: string } {
  const s = (k: string) => (typeof meta?.[k] === "string" ? (meta[k] as string).trim() : "");
  if (s("given_name") || s("family_name")) return { firstName: s("given_name"), lastName: s("family_name") };
  const full = s("full_name") || s("name");
  const parts = full.split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/** The event's own Gender question, which a member answers once with "I am" instead. */
export const isGenderQuestion = (q: Pick<EventQuestion, "type" | "label">) => q.type === "choice" && /\b(gender|sex)\b/i.test(q.label);
/** The option on that question matching male or female. */
export function genderAnswer(q: Pick<EventQuestion, "options">, g: "M" | "F") {
  const opts = q.options ?? [];
  const hit = opts.find((o) => (g === "M" ? /^\s*(m|male|man|men|boy)\b/i : /^\s*(f|female|woman|women|girl)\b/i).test(o));
  return hit ?? (g === "M" ? "Male" : "Female");
}

/** A ticket shows open on Home the first time someone sees it after registering; collapsed after that. */
export const ticketSeenKey = (regId: string) => `traqi-ticket-seen:${regId}`;
export function opensFirstTime(r: Pick<Registration, "id" | "at">, seen: (key: string) => boolean, now = Date.now()) {
  return !seen(ticketSeenKey(r.id)) && now - Date.parse(r.at) < 3 * 864e5;
}
