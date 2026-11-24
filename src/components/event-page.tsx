"use client";

import { useStore } from "@/lib/store";
import { digits, dayName } from "@/lib/format";
import { daysOf } from "@/lib/events";
import { nextTicket } from "@/lib/event-mgmt";
import { categoriesFor } from "@/lib/event-page";
import type { ChurchEvent, Registration } from "@/lib/types";
import type { RegInput, RegResult, RegTicket } from "./event-landing";

export type { RegInput, RegResult };

export const eventWhen = (e: ChurchEvent) => {
  const d = daysOf(e);
  return d.length > 1
    ? `${dayName(d[0].date, { weekday: "short", day: "numeric", month: "short" })} to ${dayName(d.at(-1)!.date, { weekday: "short", day: "numeric", month: "short" })}`
    : dayName(d[0].date, { weekday: "long", day: "numeric", month: "long" });
};

/** Registration in demo mode, doing what the database function does: one registration and ticket per person. */
export function useDemoRegister() {
  const { state, putMany, newId, findByPhone } = useStore();
  /** personId: a member registering themselves (the event page's member flow). */
  return async (e: ChurchEvent, r: RegInput, personId?: string): Promise<RegResult> => {
    const regs = state.registrations.filter((x) => x.eventId === e.id);
    // Ticket category: one the person may choose, with room left
    const cats = categoriesFor(e, r.categoryToken);
    const cat = r.category ? cats.find((c) => c.id === r.category) : undefined;
    if (r.category && !cat) throw new Error("That ticket type isn't available");
    if (!r.category && cats.some((c) => !c.private)) throw new Error("Choose a ticket type");
    if (cat?.limit && regs.filter((x) => x.category === cat.id && x.status !== "waitlist").length + 1 + r.others.length > cat.limit) throw new Error(`Sorry, ${cat.name} tickets are all taken`);
    const key = digits(r.phone).slice(-10);
    const dup = regs.find((x) => digits(x.phone).slice(-10) === key && !x.byRegId);
    if (dup && personId && !dup.personId) putMany("registrations", [{ ...dup, personId }], `linked ${dup.name}'s registration for ${e.title} to their account`);
    if (dup) return { status: "already", ticket: dup.ticket, tickets: [{ name: dup.name, ticket: dup.ticket, status: "already", category: dup.category }, ...regs.filter((x) => x.byRegId === dup.id).map((x) => ({ name: x.name, ticket: x.ticket, status: "already" as const, category: x.category }))] };
    let taken = regs.filter((x) => x.status === "confirmed").reduce((n, x) => n + 1 + (x.guests ?? 0), 0);
    const people = [{ ...r, byRegId: undefined as string | undefined }, ...r.others.map((o) => ({ ...o, byRegId: "lead" }))];
    const leadId = newId("rg");
    const out: Registration[] = [];
    const tickets: RegTicket[] = [];
    for (const [i, p] of people.entries()) {
      const status = e.needsApproval ? "pending" : e.capacity && taken + 1 > e.capacity ? "waitlist" : "confirmed";
      if (status === "confirmed") taken++;
      const phone = p.phone?.trim() || (i > 0 ? r.phone : "");
      const ticket = nextTicket(e, state.registrations, i);
      out.push({
        id: i === 0 ? leadId : newId("rg"), eventId: e.id, personId: i === 0 && personId ? personId : p.phone ? findByPhone(p.phone)?.id : undefined,
        firstName: p.firstName?.trim() || undefined, lastName: p.lastName?.trim() || undefined, name: p.name, altPhone: p.altPhone?.trim() || undefined, phone, email: p.email || undefined,
        guests: 0, days: r.days, answers: p.answers, ticket, status, checkins: [], at: new Date().toISOString(), type: r.type, byRegId: i === 0 ? undefined : leadId, sessions: [], category: cat?.id,
      });
      tickets.push({ name: p.name, ticket, status, category: cat?.id });
    }
    putMany("registrations", out, `${r.name} registered for ${e.title}${out.length > 1 ? ` with ${out.length - 1} ${out.length === 2 ? "other" : "others"}` : ""}`);
    return { status: tickets[0].status, ticket: tickets[0].ticket, tickets };
  };
}

/** Feedback after the event, demo mode. */
export function useDemoFeedback() {
  const { state, put } = useStore();
  return async (e: ChurchEvent, ticket: string, answers: Record<string, string>) => {
    const r = state.registrations.find((x) => x.eventId === e.id && x.ticket === ticket);
    if (!r) throw new Error("We couldn't find that ticket.");
    put("registrations", { ...r, feedback: { answers, at: new Date().toISOString() } }, `${r.name} gave feedback on ${e.title}`);
  };
}
