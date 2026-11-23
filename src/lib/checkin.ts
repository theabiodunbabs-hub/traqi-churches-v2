/**
 * Event check-in, the same whether it's opened in the app or from the team's shared link.
 * Live: every search and check-in goes through database functions that lock the registration,
 * so 20 people at different doors can't check the same person in twice or overwrite each other.
 * Demo: the same rules on the data in this browser.
 */
import { supabase } from "./supabase";
import { findRegs, inMark, isIn, nextTicket } from "./event-mgmt";
import { digits } from "./format";
import type { CheckinVia, ChurchEvent, EventDay, Registration } from "./types";

/** What the door sees of a registration: enough to recognise the person, nothing more. */
export type DoorReg = {
  id: string; name: string; ticket: string; phone: string; email?: string; status: Registration["status"]; type?: Registration["type"];
  checkins: string[]; sessions: string[]; checkinLog: Registration["checkinLog"];
  /** Already in for this day: who did it and when. */
  inBy?: string; inAt?: string;
};
export type MarkResult = { result: "in" | "already" | "not-confirmed" | "online"; reg: DoorReg };
export type DoorStats = { registered: number; in: number; notYet: number; pct: number };
export type DoorEvent = { id: string; churchId?: string; title: string; churchName: string; days: EventDay[]; sessionCheckin?: boolean; start: string; end: string };

export interface Desk {
  find(q: string): Promise<DoorReg[]>;
  mark(regId: string, day: string, via: CheckinVia, session?: string): Promise<MarkResult>;
  walkin(w: { name: string; firstName?: string; lastName?: string; phone: string; altPhone?: string; email?: string }, day: string, session?: string): Promise<MarkResult>;
  stats(day: string, session?: string): Promise<DoorStats>;
}

export const maskPhone = (p: string) => { const d = digits(p); return d.length >= 4 ? `•••• ${d.slice(-4)}` : ""; };
export const maskEmail = (e?: string) => { if (!e) return undefined; const [u, h] = e.split("@"); return h ? `${u.slice(0, 2)}•••@${h}` : undefined; };

const toDoor = (r: Registration, day: string, session: string | undefined, nameOf: (id?: string) => string): DoorReg => {
  const m = inMark(r, day, session);
  return { id: r.id, name: r.name, ticket: r.ticket, phone: maskPhone(r.phone), email: maskEmail(r.email), status: r.status, type: r.type,
    checkins: r.checkins, sessions: r.sessions ?? [], checkinLog: r.checkinLog, inBy: isIn(r, day, session) ? nameOf(m?.byId) || "someone on the team" : undefined, inAt: isIn(r, day, session) ? m?.at : undefined };
};

/** Check-in on this device's data (demo mode). */
export function storeDesk(o: {
  e: ChurchEvent; regs: () => Registration[]; meId: string; nameOf: (id?: string) => string;
  save: (r: Registration, log?: string) => void; newId: (p: string) => string; personByPhone: (p: string) => string | undefined; day: () => string; session: () => string | undefined;
}): Desk {
  const mine = () => o.regs().filter((r) => r.eventId === o.e.id);
  const markOne = (r: Registration, day: string, via: CheckinVia, session?: string): MarkResult => {
    if (r.status !== "confirmed") return { result: "not-confirmed", reg: toDoor(r, day, session, o.nameOf) };
    if (isIn(r, day, session)) return { result: "already", reg: toDoor(r, day, session, o.nameOf) };
    const at = new Date().toISOString();
    const next: Registration = { ...r, checkins: r.checkins.includes(day) ? r.checkins : [...r.checkins, day],
      sessions: session && !(r.sessions ?? []).includes(session) ? [...(r.sessions ?? []), session] : r.sessions,
      checkinLog: [...(r.checkinLog ?? []), { day, at, byId: o.meId, via, session }] };
    o.save(next);
    return { result: "in", reg: toDoor(next, day, session, o.nameOf) };
  };
  return {
    find: async (q) => findRegs(mine(), q).map((r) => toDoor(r, o.day(), o.session(), o.nameOf)),
    mark: async (id, day, via, session) => { const r = mine().find((x) => x.id === id); if (!r) throw new Error("That registration is no longer there"); return markOne(r, day, via, session); },
    walkin: async (w, day, session) => {
      const dup = mine().find((r) => digits(r.phone).slice(-10) === digits(w.phone).slice(-10) && digits(w.phone).length >= 10);
      if (dup) return markOne(dup, day, "phone", session);
      const r: Registration = { id: o.newId("rg"), eventId: o.e.id, personId: o.personByPhone(w.phone), firstName: w.firstName?.trim() || undefined, lastName: w.lastName?.trim() || undefined, name: w.name.trim(), altPhone: w.altPhone?.trim() || undefined, phone: w.phone, email: w.email || undefined, guests: 0, days: [day], answers: {},
        ticket: nextTicket(o.e, o.regs()), status: "confirmed", checkins: [], sessions: [], at: new Date().toISOString(), type: "individual" };
      o.save(r, `added a walk-in at ${o.e.title}`);
      return markOne(r, day, "walkin", session);
    },
    stats: async (day, session) => {
      const list = mine().filter((r) => r.status === "confirmed" && r.type !== "online");
      const n = list.filter((r) => isIn(r, day, session)).length;
      return { registered: list.length, in: n, notYet: list.length - n, pct: list.length ? n / list.length : 0 };
    },
  };
}

const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new Error("Not connected");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message.replace(/^.*?: /, ""));
  return data as T;
};

/** Check-in through the database (live mode). `onSaved` lets the app show the change without writing it again. */
export function liveDesk(churchId: string, eventId: string, onSaved?: (regId: string, r: DoorReg) => void): Desk {
  const base = { p_church: churchId, p_event: eventId };
  const saved = (m: MarkResult) => { if (m.result === "in") onSaved?.(m.reg.id, m.reg); return m; };
  return {
    find: (q) => rpc<DoorReg[]>("checkin_find", { ...base, p_q: q }).then((x) => x ?? []),
    mark: (id, day, via, session) => rpc<MarkResult>("checkin_mark", { ...base, p_reg: id, p_day: day, p_session: session ?? null, p_via: via }).then(saved),
    walkin: (w, day, session) => rpc<MarkResult>("checkin_walkin", { ...base, p_name: w.name, p_phone: w.phone, p_email: w.email ?? null, p_first: w.firstName ?? null, p_last: w.lastName ?? null, p_alt: w.altPhone ?? null, p_day: day, p_session: session ?? null }).then(saved),
    stats: (day, session) => rpc<DoorStats>("checkin_stats", { ...base, p_day: day, p_session: session ?? null }),
  };
}

/** Opening the shared link: which event, and may this signed-in person check people in? */
export async function openLink(token: string): Promise<{ allowed: boolean; event?: DoorEvent; reason?: string }> {
  return rpc("checkin_open", { p_token: token });
}

/** A fresh, hard-to-guess token for the shared link. */
export function newLinkToken() {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const r = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(14)) : Array.from({ length: 14 }, () => Math.floor(Math.random() * 2 ** 32));
  return Array.from(r, (n) => a[n % a.length]).join("");
}
