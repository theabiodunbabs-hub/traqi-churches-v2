"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Ticket, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { eventPath } from "@/lib/events";
import { memberReturn, opensFirstTime, ticketSeenKey } from "@/lib/event-join";
import { COVERS } from "./brand";
import { TicketCard } from "./event-landing";
import { eventWhen } from "./event-page";
import { cx } from "./ui";
import type { ChurchEvent, Registration } from "@/lib/types";

const seen = (k: string) => { try { return localStorage.getItem(k) === "1"; } catch { return true; } };
const markSeen = (k: string) => { try { localStorage.setItem(k, "1"); } catch { /* storage unavailable */ } };

/**
 * Events on Home, as collapsible cards. The title opens the event; the arrow shows the tickets
 * (QR, Image, PDF, Send) and "Register someone else". A new ticket is open the first time it's seen, then collapsed.
 * Members also see events open for registration, with "Register now" (the form comes filled in).
 */
export function MyEvents({ className, openOnly = true, registeredOnly }: { className?: string; openOnly?: boolean; registeredOnly?: boolean }) {
  const { state, me } = useStore();
  const [now] = useState(() => Date.now());
  if (!me) return null;
  const mine = (e: ChurchEvent) => state.registrations.filter((r) => r.eventId === e.id && (r.personId === me.id || (r.byRegId && state.registrations.some((x) => x.id === r.byRegId && x.personId === me.id))));
  const upcoming = state.events.filter((e) => e.status === "published" && Date.parse(e.end) > now).sort((a, b) => a.start.localeCompare(b.start));
  const registered = upcoming.filter((e) => mine(e).length > 0);
  const open = registeredOnly ? [] : upcoming.filter((e) => !mine(e).length && e.registration !== false && (!e.closesAt || Date.parse(e.closesAt) > now)).slice(0, openOnly ? 2 : 6);
  if (!registered.length && !open.length) return null;
  return (
    <div className={cx("space-y-3", className)}>
      {registered.map((e) => <EventCard key={e.id} e={e} regs={mine(e)} now={now} />)}
      {open.map((e) => <EventCard key={e.id} e={e} regs={[]} now={now} />)}
    </div>
  );
}

function EventCard({ e, regs, now }: { e: ChurchEvent; regs: Registration[]; now: number }) {
  const { state } = useStore();
  const isReg = regs.length > 0;
  const [open, setOpen] = useState(false);
  // First time a new ticket is seen: open, so it can be downloaded straight away
  useEffect(() => { if (regs.some((r) => opensFirstTime(r, seen, now))) setOpen(true); }, [regs, now]);
  useEffect(() => { if (open) regs.forEach((r) => markSeen(ticketSeenKey(r.id))); }, [open, regs]);
  const path = eventPath(state.church.slug, e);
  const url = typeof window === "undefined" ? path : `${location.origin}${path}`;
  const days = Math.max(0, Math.ceil((Date.parse(e.start) - now) / 864e5));
  const church = { name: state.church.name, slug: state.church.slug, profile: state.church.profile };
  const pending = regs.some((r) => r.status !== "confirmed");
  const id = `ev-${e.id}`;

  return (
    <div className={cx("card overflow-hidden p-0", open && "ring-2 ring-brand/30")}>
      <div className="flex items-stretch">
        <span className="flex w-[84px] shrink-0 flex-col items-center justify-center py-3 text-white" style={{ background: COVERS[e.cover % COVERS.length] }}>
          <span className="num text-[26px] font-semibold leading-none">{days}</span><span className="mt-1 text-[11.5px] text-white/85">{days === 1 ? "day to go" : "days to go"}</span>
        </span>
        <Link href={`/events/${e.id}`} className="min-w-0 flex-1 px-4 py-3.5 hover:bg-page/60">
          <span className={cx("block text-[11.5px] font-semibold uppercase tracking-wider", isReg ? (pending ? "text-glow-ink" : "text-good") : "text-brand")}>
            {isReg ? (pending ? "Waiting to be confirmed" : regs.length > 1 ? `${regs.length} tickets` : "You're registered") : "Registration is open"}
          </span>
          <b className="block truncate font-display text-[17px] font-semibold">{e.title}</b>
          <span className="block truncate text-[13.5px] text-ink-soft">{eventWhen(e)}</span>
        </Link>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}
          className="flex shrink-0 items-center gap-1.5 border-l border-line px-4 text-[13.5px] font-medium text-brand hover:bg-brand-soft/50">
          <span className="hidden sm:inline">{isReg ? (open ? "Hide ticket" : "Ticket") : open ? "Hide" : "Register"}</span>
          {isReg ? <Ticket size={17} className="sm:hidden" /> : <Plus size={17} className="sm:hidden" />}
          <ChevronDown size={17} className={cx("transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
      <div id={id} className={cx("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-3 border-t border-line bg-page/50 p-4">
            {isReg ? (
              <>
                {regs.map((r) => <TicketCard key={r.id} e={e} church={church} url={url} t={{ name: r.name, ticket: r.ticket, status: r.status }} />)}
                <div className="flex flex-wrap gap-2">
                  <Link href={path} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-[14.5px] font-semibold text-white"><UserPlus size={16} /> Register someone else</Link>
                  <Link href={`/events/${e.id}`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-surface px-4 text-[14px] font-semibold ring-1 ring-line">Open the event</Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-[14px] text-ink-soft">{e.theme || e.tagline || "Registration is open."} Your details are filled in for you.</p>
                <Link href={memberReturn(path, true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-[15px] font-semibold text-white"><Ticket size={16} /> Register now</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
