"use client";

import Link from "next/link";
import { useState } from "react";
import { Baby, Heart, HeartHandshake, User, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Sheet, cx } from "./ui";
import { fullName } from "@/lib/format";
import { kindOf } from "@/lib/journey";
import type { Person } from "@/lib/types";

/**
 * Family life at a glance: singles, married couples, children and "others" (with their own words),
 * among members and first-timers who have committed (joined a class or become members). Tap to see the people.
 */
export function FamilyLifeCard() {
  const { state, access } = useStore();
  const [open, setOpen] = useState<null | { title: string; people: Person[]; why?: boolean }>(null);
  if (!access?.leadsFamilyLife && !access?.isPastoral) return null;
  const enrolled = new Set(state.enrolments.filter((e) => e.status === "active" || e.status === "completed").map((e) => e.personId));
  const committed = state.people.filter((p) => !p.inactive && !p.isChild && (kindOf(p.stage) !== "visitor" || enrolled.has(p.id)));
  const by = (k: string) => committed.filter((p) => p.custom?.marital === k);
  const single = by("single"), married = by("married"), other = by("other");
  const unknown = committed.filter((p) => !p.custom?.marital);
  // Couples: married people sharing a household; anyone else married counts as one (spouse not in church yet)
  const homes = new Map<string, number>();
  married.forEach((p) => { if (p.householdId) homes.set(p.householdId, (homes.get(p.householdId) ?? 0) + 1); });
  const couples = [...homes.values()].filter((n) => n >= 2).length;
  const children = state.people.filter((p) => p.isChild && !p.inactive);
  const tiles = [
    { label: "Single", n: single.length, icon: User, list: single, tone: "bg-j1" },
    { label: "Married couples", n: couples, sub: `${married.length} married people`, icon: Heart, list: married, tone: "bg-j5" },
    { label: "Children", n: children.length, icon: Baby, list: children, tone: "bg-j3" },
    { label: "Others", n: other.length, icon: HeartHandshake, list: other, tone: "bg-j4", why: true },
  ];
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Users size={19} /></span>
        <span className="flex-1"><b className="block font-display text-[17px] font-semibold">Families at a glance</b><span className="text-[13px] text-muted">Members, and first-timers who have committed. Tap to see who.</span></span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map((t) => { const I = t.icon; return (
          <button type="button" key={t.label} onClick={() => setOpen({ title: t.label, people: t.list, why: t.why })} className="rounded-2xl bg-page p-3.5 text-left ring-1 ring-line hover:ring-brand/40">
            <span className={cx("mb-2 flex size-8 items-center justify-center rounded-lg text-on-light", t.tone)}><I size={16} /></span>
            <span className="num block text-[26px] font-semibold leading-none">{t.n}</span>
            <span className="mt-1 block text-[13px] text-ink-soft">{t.label}</span>
            {t.sub && <span className="block text-[12px] text-muted">{t.sub}</span>}
          </button>
        ); })}
      </div>
      {(() => {
        const courses = state.programmes.filter((x) => x.owner === "family");
        if (!courses.length) return <Link href="/classes" className="mt-4 block rounded-2xl border border-dashed border-line px-4 py-3 text-[13.5px] text-brand">Start a premarital counselling or parenting course</Link>;
        return (
          <div className="mt-4 space-y-2">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Your courses</p>
            {courses.map((c) => { const en = state.enrolments.filter((e) => e.programmeId === c.id); return (
              <Link key={c.id} href={`/classes/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-page px-4 py-3 ring-1 ring-line hover:ring-brand/40">
                <span className="min-w-0 flex-1"><b className="block truncate font-medium">{c.name}</b><span className="text-[12.5px] text-muted">{en.filter((e) => e.status === "active").length} taking it · {en.filter((e) => e.status === "completed").length} finished</span></span>
                {c.pendingEdit && <span className="rounded-full bg-glow px-2 py-0.5 text-[12px] font-semibold text-white">Change to approve</span>}
              </Link>
            ); })}
          </div>
        );
      })()}
      {unknown.length > 0 && <button type="button" onClick={() => setOpen({ title: "Not told us yet", people: unknown })} className="mt-3 min-h-9 text-[13px] font-medium text-brand">{unknown.length} haven&apos;t given their marital status yet</button>}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ""}>
        <ul className="divide-y divide-line">
          {open?.people.map((p) => (
            <li key={p.id}><Link href={`/people/${p.id}`} className="flex items-center gap-3 py-2.5 hover:bg-page">
              <Avatar person={p} size={34} />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{fullName(p)}</span>{open.why && <span className="block text-[13px] text-ink-soft">{p.custom?.maritalOther || "No reason given"}</span>}</span>
            </Link></li>
          ))}
          {!open?.people.length && <li className="py-6 text-center text-sm text-muted">Nobody here yet.</li>}
        </ul>
      </Sheet>
    </section>
  );
}
