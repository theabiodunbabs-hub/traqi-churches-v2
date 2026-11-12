"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Cake, Eye, EyeOff, Gem, HandHeart, Heart, MessageCircleQuestion, MonitorPlay, PartyPopper, Search, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Sheet, cx } from "./ui";
import { ReachOut } from "./care";
import { allowed, ask, type Answer } from "@/lib/ask";
import { attendance, cameBack } from "@/lib/metrics";
import { daysToBirthday, fullName, hoursSince } from "@/lib/format";
import { financeByMonth } from "@/lib/domain";
import { kindOf } from "@/lib/journey";
import type { Person } from "@/lib/types";

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

/** What pastors see below "Needs you": kept short. Everything else is one tap away in the menu. */
export function PastorBoard() {
  const { access } = useStore();
  if (!access) return null;
  return (
    <div className="mt-8 space-y-6">
      <AskTraqi />
      <div className="grid gap-6 md:grid-cols-2">
        <Health />
        <div className="space-y-6">
          {access.canFinance && <Giving />}
          <Celebrate />
        </div>
      </div>
    </div>
  );
}

/** A small link for the hero: the leadership meeting view. */
export function MeetingLink() {
  return (
    <Link href="/meeting" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white/85 ring-1 ring-white/15 transition hover:bg-white/20">
      <MonitorPlay size={14} /> Meeting view
    </Link>
  );
}

function Title({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-[19px] font-semibold tracking-tight">{children}</h2>{action}</div>;
}

// ---------------- Ask Traqi ----------------
function AskTraqi() {
  const { state, access } = useStore();
  const [q, setQ] = useState("");
  const [a, setA] = useState<Answer | null>(null);
  const [list, setList] = useState(false);
  if (!access) return null;
  const chips = allowed(access).filter((c) => ["attendance", "firsttimers", "birthdays", "quiet"].includes(c.key));
  const run = (text: string) => { setQ(text); setA(ask(state, access, text)); };
  return (
    <section className="card overflow-hidden p-0">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) run(q); }} className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white"><Sparkles size={17} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask Traqi…" aria-label="Ask Traqi"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted" />
        <button type="submit" className="flex size-9 items-center justify-center rounded-xl text-muted hover:bg-page hover:text-ink" aria-label="Ask"><Search size={17} /></button>
      </form>
      {a && (
        <div className="pop border-b border-line bg-brand-soft/40 px-4 py-4 md:px-5">
          <div className="flex items-start gap-4">
            {a.number && <span className="num shrink-0 text-[38px] font-semibold leading-none text-brand">{a.number}</span>}
            <div className="min-w-0 flex-1">
              <p className="font-display text-[16px] font-semibold">{a.title}</p>
              <p className="mt-0.5 text-[14.5px] text-ink-soft">{a.text}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-[13.5px] font-medium">
                {a.people && a.people.length > 0 && <button className="text-brand" onClick={() => setList(true)}>See the {a.people.length} {a.people.length === 1 ? "person" : "people"}</button>}
                {a.href && <Link href={a.href} className="text-brand">Open <ArrowRight size={13} className="inline" /></Link>}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 md:flex-wrap md:px-5">
        {chips.map((c) => (
          <button key={c.key} onClick={() => run(c.label)} className="shrink-0 rounded-full bg-page px-3 py-1.5 text-[13px] text-ink-soft ring-1 ring-line transition hover:text-ink hover:ring-brand/40">
            <MessageCircleQuestion size={12} className="mr-1 inline text-brand" />{c.label}
          </button>
        ))}
      </div>
      <PeopleSheet open={list} onClose={() => setList(false)} title={a?.title ?? ""} people={a?.people ?? []} />
    </section>
  );
}

function PeopleSheet({ open, onClose, title, people, message }: { open: boolean; onClose: () => void; title: string; people: Person[]; message?: (p: Person) => string }) {
  const { access } = useStore();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ul className="-mx-1 divide-y divide-line">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-1 py-2.5">
            <Link href={`/people/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar person={p} size={36} /><span className="truncate font-medium">{fullName(p)}</span></Link>
            {message && <ReachOut person={p} compact message={message(p)} canContact={!!access?.canSeeContacts(p)} />}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

// ---------------- Church health ----------------
function Health() {
  const { state } = useStore();
  const att = attendance(state);
  const back = cameBack(state);
  const people = state.people.filter((p) => !p.inactive && !p.isChild);
  const serving = people.filter((p) => ["worker", "leader"].includes(kindOf(p.stage))).length;
  const inClass = new Set(state.enrolments.filter((e) => e.status === "active").map((e) => e.personId)).size;
  const pc = (a: number, b: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const rows = [
    { label: "Attendance goal", v: att.goal ? pc(att.last, att.goal) : null },
    { label: "First-timers back", v: back.of ? back.pct : null },
    { label: "Serving", v: pc(serving, people.length) },
    { label: "In a class", v: pc(inClass, people.length) },
  ];
  return (
    <section>
      <Title>Church health</Title>
      <div className="card grid grid-cols-2 gap-x-5 gap-y-5 p-5">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="num text-[26px] font-semibold leading-none">{r.v === null ? "–" : `${r.v}%`}</p>
            <p className="mt-1 text-[13px] text-ink-soft">{r.label}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-page">{r.v !== null && <div className={cx("h-full rounded-full", r.v >= 70 ? "bg-good" : r.v >= 40 ? "bg-brand" : "bg-glow")} style={{ width: `${r.v}%` }} />}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------- Giving: hidden until tapped ----------------
function Giving() {
  const { state } = useStore();
  const [show, setShow] = useState(false);
  const m = financeByMonth(state);
  const cur = m.at(-1), prev = m.at(-2);
  const t = cur ? cur.cash + cur.transfer : 0, p = prev ? prev.cash + prev.transfer : 0;
  return (
    <section>
      <Title>Giving</Title>
      <button onClick={() => setShow(!show)} className="card flex w-full items-center gap-4 p-5 text-left" aria-pressed={show}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-glow-soft text-glow-ink"><Gem size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-muted">This month</span>
          <span className={cx("num block text-[26px] font-semibold leading-tight transition", !show && "select-none blur-md")} aria-hidden={!show}>{naira(t)}</span>
          {show && prev && <span className={cx("text-[13px]", t >= p ? "text-good" : "text-alert")}>{t >= p ? "Up" : "Down"} {p ? Math.abs(Math.round(((t - p) / p) * 100)) : 0}% on last month</span>}
        </span>
        <span className="flex items-center gap-1 text-[13px] font-medium text-brand">{show ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}</span>
      </button>
    </section>
  );
}

// ---------------- Celebrate and pray ----------------
function Celebrate() {
  const { state, access } = useStore();
  if (!access) return null;
  const people = access.visiblePeople().filter((p) => !p.inactive);
  const soon = (d?: string) => { const n = daysToBirthday(d); return n !== null && n <= 6; };
  const items = [
    { icon: Cake, n: people.filter((p) => soon(p.birthday)).length, label: "Birthdays", href: "/messages", tone: "bg-glow-soft text-glow-ink" },
    { icon: Heart, n: people.filter((p) => soon(p.anniversary)).length, label: "Anniversaries", href: "/messages", tone: "bg-alert-soft text-alert" },
    { icon: PartyPopper, n: state.enrolments.filter((e) => e.status === "completed" && e.completedAt && hoursSince(e.completedAt) <= 24 * 14).length, label: "Finished a class", href: "/classes", tone: "bg-good-soft text-good" },
    ...(access.seesPrayers ? [{ icon: HandHeart, n: state.prayers.filter((x) => !x.answered && hoursSince(x.at) <= 24 * 14).length, label: "Prayer requests", href: "/prayer", tone: "bg-brand-soft text-brand" }] : []),
  ];
  return (
    <section>
      <Title>Celebrate and pray <span className="text-[13px] font-normal text-muted">this week</span></Title>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((i) => (
          <Link key={i.label} href={i.href} className="card card-hover flex items-center gap-3 p-3.5">
            <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl", i.tone)}><i.icon size={18} /></span>
            <span className="min-w-0"><span className="num block text-[20px] font-semibold leading-none">{i.n}</span><span className="mt-1 block truncate text-[12.5px] text-ink-soft">{i.label}</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

