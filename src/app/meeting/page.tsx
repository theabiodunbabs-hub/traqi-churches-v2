"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { ChurchMark } from "@/components/brand";
import { attendance, cameBack } from "@/lib/metrics";
import { missedLastSunday } from "@/lib/ask";
import { eventCounts, eventState, financeByMonth, sundaySeries } from "@/lib/domain";
import { journeyStages, kindOf } from "@/lib/journey";
import { daysToBirthday, hoursSince } from "@/lib/format";
import { cx } from "@/components/ui";

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
type Slide = { key: string; kicker: string; title: string; body: React.ReactNode };

/** The leadership meeting view: this month's story on the big screen, one slide at a time. */
export default function Meeting() {
  const { state, access, ready } = useStore();
  const [i, setI] = useState(0);
  const [giving, setGiving] = useState(false);

  const slides = useMemo<Slide[]>(() => {
    if (!access) return [];
    const att = attendance(state);
    const series = sundaySeries(state).slice(-8);
    const max = Math.max(1, ...series.map((x) => x.total));
    const back = cameBack(state);
    const month = new Date(); month.setDate(1);
    const ft = state.cases.filter((c) => c.createdAt >= month.toISOString().slice(0, 10));
    const stages = journeyStages();
    const people = state.people.filter((p) => !p.inactive && !p.isChild);
    const missed = missedLastSunday(state, people);
    const ml = missed.filter((p) => p.isLeader || kindOf(p.stage) === "leader").length;
    const mw = missed.filter((p) => kindOf(p.stage) === "worker").length;
    const events = state.events.filter((e) => ["upcoming", "live"].includes(eventState(e))).slice(0, 4);
    const fin = financeByMonth(state).slice(-6);
    const fmax = Math.max(1, ...fin.map((f) => f.cash + f.transfer));
    const bdays = people.filter((p) => { const d = daysToBirthday(p.birthday); return d !== null && d <= 30; }).length;
    const finished = state.enrolments.filter((e) => e.status === "completed" && e.completedAt && hoursSince(e.completedAt) <= 24 * 31).length;

    const out: Slide[] = [
      { key: "att", kicker: "Sunday attendance", title: att.series.length ? `${att.last} at church last Sunday` : "No headcount yet",
        body: (
          <div>
            <p className="text-[clamp(18px,2.2vw,26px)] text-white/75">{att.vsAvg >= 0 ? "Up" : "Down"} {Math.abs(att.vsAvg)}% on the 4-week average{att.goal ? `. Goal: ${att.goal}.` : "."}</p>
            <div className="mt-10 flex h-[38vh] items-end gap-[1.5vw]">
              {series.map((x, k) => (
                <div key={x.date} className="flex flex-1 flex-col items-center gap-3">
                  <span className="num text-[clamp(14px,1.6vw,22px)] text-white/80">{x.total}</span>
                  <div className={cx("w-full rounded-t-2xl", k === series.length - 1 ? "bg-white" : "bg-white/30")} style={{ height: `${(x.total / max) * 30}vh` }} />
                  <span className="text-[clamp(11px,1.1vw,15px)] text-white/60">{new Date(x.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </div>
              ))}
            </div>
          </div>
        ) },
      { key: "ft", kicker: "First-timers", title: `${ft.length} first-timers this month`,
        body: <Big items={[{ n: `${back.pct}%`, l: "of earlier first-timers came back" }, { n: String(state.cases.filter((c) => c.stage === "new").length), l: "not reached yet" }, { n: String(state.cases.filter((c) => c.stage === "member").length), l: "became members" }]} /> },
      { key: "journey", kicker: "The journey", title: "Where our people are",
        body: (
          <div className="mt-6 space-y-4">
            {stages.map((s) => { const n = people.filter((p) => p.stage === s.key).length; return (
              <div key={s.key} className="flex items-center gap-6">
                <span className="w-[22vw] truncate text-[clamp(16px,1.8vw,24px)]">{s.name}</span>
                <div className="h-[3.2vh] flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white/85" style={{ width: `${(n / Math.max(1, people.length)) * 100}%` }} /></div>
                <span className="num w-[8vw] text-right text-[clamp(18px,2vw,28px)]">{n}</span>
              </div>
            ); })}
          </div>
        ) },
      { key: "missed", kicker: "Last Sunday", title: `${missed.length} people who usually come weren't there`,
        body: <Big items={[{ n: String(ml), l: "leaders" }, { n: String(mw), l: "workers" }, { n: String(missed.length - ml - mw), l: "members" }]} /> },
    ];
    if (events.length) out.push({ key: "events", kicker: "Coming up", title: "Events",
      body: (
        <ul className="mt-6 space-y-4">
          {events.map((e) => { const c = eventCounts(state, e); return (
            <li key={e.id} className="flex items-center gap-6 rounded-3xl bg-white/10 px-7 py-5">
              <span className="w-[10vw] text-[clamp(14px,1.5vw,20px)] text-white/70">{new Date(e.start).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              <span className="flex-1 truncate font-display text-[clamp(20px,2.4vw,34px)] font-semibold">{e.title}</span>
              <span className="num text-[clamp(20px,2.4vw,34px)]">{c.people}</span><span className="text-white/60">coming</span>
            </li>
          ); })}
        </ul>
      ) });
    if (access.canFinance && fin.length) out.push({ key: "giving", kicker: "Giving", title: giving ? `${naira((fin.at(-1)!.cash + fin.at(-1)!.transfer))} this month` : "Giving this month",
      body: giving ? (
        <div className="mt-10 flex h-[38vh] items-end gap-[2vw]">
          {fin.map((f) => (
            <div key={f.month} className="flex flex-1 flex-col items-center gap-3">
              <div className="w-full rounded-t-2xl bg-white/80" style={{ height: `${((f.cash + f.transfer) / fmax) * 30}vh` }} />
              <span className="text-[clamp(11px,1.1vw,15px)] text-white/60">{new Date(`${f.month}-01`).toLocaleDateString("en-GB", { month: "short" })}</span>
            </div>
          ))}
        </div>
      ) : <button onClick={() => setGiving(true)} className="mt-10 inline-flex items-center gap-3 rounded-full bg-white/15 px-7 py-4 text-[clamp(16px,1.8vw,22px)] hover:bg-white/25"><Eye size={22} /> Show giving</button> });
    out.push({ key: "celebrate", kicker: "Celebrate", title: "Thank God for",
      body: <Big items={[{ n: String(finished), l: "finished a class this month" }, { n: String(bdays), l: "birthdays in the next 30 days" }, { n: String(people.filter((p) => kindOf(p.stage) === "worker" || kindOf(p.stage) === "leader").length), l: "people serving" }]} /> });
    return out;
  }, [state, access, giving]);

  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(slides.length - 1, x + d))), [slides.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (["ArrowRight", " ", "PageDown"].includes(e.key)) go(1); if (["ArrowLeft", "PageUp"].includes(e.key)) go(-1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go]);
  const [touch, setTouch] = useState<number | null>(null);

  if (!ready) return null;
  if (!access?.isPastoral && !access?.can("roles.manage")) return <div className="p-10 text-center">This view is for the pastors. <Link href="/today" className="text-brand">Go home</Link></div>;
  const s = slides[i];
  const color = state.church.profile?.color ?? "#4f46e5";

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden px-[6vw] py-[5vh] text-white select-none"
      style={{ background: `radial-gradient(1000px 700px at 100% 0%, ${color}cc, transparent 65%), radial-gradient(800px 600px at 0% 100%, ${color}55, transparent 70%), var(--color-deep)` }}
      onTouchStart={(e) => setTouch(e.touches[0].clientX)} onTouchEnd={(e) => { if (touch !== null) { const dx = e.changedTouches[0].clientX - touch; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); } setTouch(null); }}>
      <header className="flex items-center gap-4">
        <ChurchMark church={state.church} size={44} className="ring-2 ring-white/20" />
        <p className="flex-1 font-display text-[clamp(16px,1.6vw,22px)] font-semibold">{state.church.name} · Leadership meeting</p>
        <span className="text-white/60">{i + 1} / {slides.length}</span>
        <Link href="/today" className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close"><X size={20} /></Link>
      </header>
      {s && (
        <main key={s.key} className="rise flex flex-1 flex-col justify-center">
          <p className="text-[clamp(14px,1.5vw,20px)] font-semibold uppercase tracking-[.2em] text-white/60">{s.kicker}</p>
          <h1 className="mt-3 font-display text-[clamp(32px,5vw,76px)] font-semibold leading-[1.05] tracking-tight">{s.title}</h1>
          <div className="mt-4">{s.body}</div>
        </main>
      )}
      <footer className="flex items-center justify-between">
        <button onClick={() => go(-1)} disabled={i === 0} className="flex size-14 items-center justify-center rounded-full bg-white/10 disabled:opacity-30" aria-label="Previous"><ChevronLeft size={26} /></button>
        <div className="flex gap-2">{slides.map((x, k) => <button key={x.key} onClick={() => setI(k)} className={cx("h-2 rounded-full transition-all", k === i ? "w-8 bg-white" : "w-2 bg-white/35")} aria-label={`Slide ${k + 1}`} />)}</div>
        <button onClick={() => go(1)} disabled={i === slides.length - 1} className="flex size-14 items-center justify-center rounded-full bg-white/10 disabled:opacity-30" aria-label="Next"><ChevronRight size={26} /></button>
      </footer>
    </div>
  );
}

function Big({ items }: { items: { n: string; l: string }[] }) {
  return (
    <div className="mt-10 grid gap-[3vw] sm:grid-cols-3">
      {items.map((x) => (
        <div key={x.l} className="rounded-[2rem] bg-white/10 p-[2.5vw]">
          <p className="num text-[clamp(44px,7vw,110px)] font-semibold leading-none">{x.n}</p>
          <p className="mt-3 text-[clamp(16px,1.7vw,24px)] text-white/75">{x.l}</p>
        </div>
      ))}
    </div>
  );
}

