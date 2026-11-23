"use client";

import Link from "next/link";
import { CalendarClock, ChevronRight, ScanLine, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { DUTY_LABEL, myEventDuties } from "@/lib/event-mgmt";
import { cx } from "./ui";

const dayShort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Home: a box for every event committee this person sits on, and every check-in or follow-up team they're on. */
export function EventDuties({ className }: { className?: string }) {
  const { state, me } = useStore();
  if (!me) return null;
  const list = myEventDuties(state, me.id);
  if (!list.length) return null;
  return (
    <div className={cx("grid gap-3 md:grid-cols-2", className)}>
      {list.map(({ e, seat, duties, next }) => {
        const door = duties.includes("checkin") && Date.parse(e.start) - Date.now() < 2 * 864e5;
        return (
          <Link key={e.id} href={`/events/${e.id}?tab=${seat ? "committee" : door ? "door" : "people"}`} className="card card-hover flex items-start gap-3 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">{seat ? <Users size={20} /> : <ScanLine size={20} />}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold uppercase tracking-wider text-brand">{seat ? "Event committee" : `${duties.map((d) => DUTY_LABEL[d].title).join(" and ")} team`}</span>
              <b className="block truncate text-[15.5px]">{e.title}</b>
              <span className="block text-[13px] text-ink-soft">{seat ?? `${duties.map((d) => DUTY_LABEL[d].title).join(", ")}`}{seat && duties.length ? ` · ${duties.map((d) => DUTY_LABEL[d].title.toLowerCase()).join(", ")} team` : ""}</span>
              {seat && next && <span className="mt-1 flex items-center gap-1.5 text-[12.5px] text-glow-ink"><CalendarClock size={13} /> Meeting {dayShort(next.date)} at {next.time}</span>}
              {door && <span className="mt-1 block text-[12.5px] font-medium text-good">Check-in is ready: tap to open</span>}
            </span>
            <ChevronRight size={18} className="mt-3 text-muted" />
          </Link>
        );
      })}
    </div>
  );
}
