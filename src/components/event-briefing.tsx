"use client";

import { useRef } from "react";
import { BedDouble, CalendarClock, Expand, Lightbulb, MapPin, TrendingUp, Users, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { briefing } from "@/lib/event-mgmt";
import { money } from "@/lib/format";
import type { ChurchEvent } from "@/lib/types";
import { Button, Panel, cx } from "./ui";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number) => Math.round(n).toLocaleString("en-NG");
const dayShort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function Bars({ rows, total, tone = "bg-brand" }: { rows: [string, number][]; total: number; tone?: string }) {
  return (
    <ul className="space-y-2.5">{rows.map(([k, n]) => (
      <li key={k}><div className="mb-1 flex justify-between text-[13.5px]"><span className="truncate pr-2">{k}</span><span className="num shrink-0 text-ink-soft">{num(n)} · {total ? pct(n / total) : "0%"}</span></div>
        <div className="h-2.5 rounded-full bg-page"><div className={cx("h-full rounded-full", tone)} style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></div></li>
    ))}</ul>
  );
}
function Big({ n, label, sub, tone }: { n: string; label: string; sub?: string; tone?: string }) {
  return <div className="card p-4"><p className={cx("num text-[28px] font-semibold leading-none", tone)}>{n}</p><p className="mt-1.5 text-[13px] text-ink-soft">{label}</p>{sub && <p className="text-[12px] text-muted">{sub}</p>}</div>;
}

/**
 * The smart meeting view: one screen the committee opens when briefing the Pastorate.
 * Registration against the target, who is coming and from where, what they need, the money, and the pace.
 */
export function EventBriefing({ e }: { e: ChurchEvent }) {
  const { state } = useStore();
  const box = useRef<HTMLDivElement>(null);
  const b = briefing(state, e);
  const n = b.confirmed.length;
  const onPace = b.target ? b.projected >= b.target : true;
  const maxTrend = Math.max(1, ...b.trend.map((t) => t.n));
  const m = b.money;
  return (
    <div ref={box} className="space-y-5 bg-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-ink-soft">Live figures for <b>{e.title}</b>{b.daysLeft > 0 ? ` · ${b.daysLeft} day${b.daysLeft === 1 ? "" : "s"} to go` : ""}</p>
        <Button onClick={() => { const el = box.current; if (el && !document.fullscreenElement) void el.requestFullscreen?.().catch(() => {}); else void document.exitFullscreen?.(); }}><Expand size={15} /> Present full screen</Button>
      </div>

      {/* A. Registration overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Big n={num(b.people)} label="Registered" sub={b.target ? `of ${num(b.target)} target · ${pct(b.pct)}` : "No target set"} />
        <Big n={b.target ? num(b.remaining) : "–"} label="To reach the target" sub={b.daysLeft ? `${b.neededPerDay.toFixed(1)} a day needed` : undefined} tone={b.remaining ? "text-glow-ink" : "text-good"} />
        <Big n={b.pace.toFixed(1)} label="Registering a day" sub="Average over the last 7 days" />
        <Big n={num(b.projected)} label="Projected by the event" sub={b.target ? (onPace ? "On course for the target" : "Behind the target at this pace") : undefined} tone={onPace ? "text-good" : "text-alert"} />
      </div>
      {b.target > 0 && <div className="h-4 overflow-hidden rounded-full bg-surface ring-1 ring-line"><div className="h-full rounded-full bg-gradient-to-r from-brand to-glow" style={{ width: `${Math.min(100, b.pct * 100)}%` }} /></div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={<span className="flex items-center gap-2"><TrendingUp size={17} className="text-brand" /> Registrations, last 14 days</span>}>
          <div className="flex h-36 items-end gap-1" aria-label="Registrations per day">{b.trend.map((t) => (
            <div key={t.d} className="flex flex-1 flex-col items-center gap-1" title={`${dayShort(t.d)}: ${t.n}`}>
              <span className="num text-[10.5px] text-muted">{t.n || ""}</span>
              <div className="w-full rounded-t-md bg-brand/80" style={{ height: `${(t.n / maxTrend) * 100}%`, minHeight: t.n ? 4 : 1 }} />
            </div>
          ))}</div>
          <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{dayShort(b.trend[0].d)}</span><span>Today</span></div>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Users size={17} className="text-brand" /> Men and women</span>}>
          {n ? <Bars rows={b.gender} total={n} /> : <p className="text-sm text-muted">No registrations yet.</p>}
          {!b.genderAsked && <p className="mt-3 text-[12.5px] text-muted">Taken from church records where known. Add a Gender question to the form for everyone.</p>}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[13px]">
            <div className="rounded-xl bg-page p-2"><b className="num block text-lg">{num(b.newToChurch)}</b>new to the church</div>
            <div className="rounded-xl bg-page p-2"><b className="num block text-lg">{num(b.waitlist)}</b>waiting list</div>
            <div className="rounded-xl bg-page p-2"><b className="num block text-lg">{num(b.pending)}</b>to approve</div>
          </div>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><MapPin size={17} className="text-brand" /> Where people are coming from</span>}>
          {b.locations.top.length ? <Bars rows={[...b.locations.top, ...(b.locations.others ? [["Other places", b.locations.others] as [string, number]] : [])]} total={n} tone="bg-j4" /> : <p className="text-sm text-muted">{b.locationAsked ? "No answers yet." : "Add a “Where are you coming from?” question to the form to see this."}</p>}
          {b.locations.unknown > 0 && b.locations.top.length > 0 && <p className="mt-2 text-[12.5px] text-muted">{num(b.locations.unknown)} didn&apos;t say.</p>}
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><BedDouble size={17} className="text-brand" /> Needs and preferences</span>}>
          {b.stayAsked ? <p className="mb-4 rounded-2xl bg-glow-soft px-4 py-3 text-[14px]"><b className="num text-lg">{num(b.stay ?? 0)}</b> need accommodation ({n ? pct((b.stay ?? 0) / n) : "0%"})</p> : <p className="mb-4 text-[13px] text-muted">Accommodation isn&apos;t asked on the form.</p>}
          <div className="space-y-5">{b.answers.map((a) => (
            <div key={a.q.id}><p className="mb-2 text-[13.5px] font-semibold">{a.q.label} <span className="font-normal text-muted">· {num(a.answered)} answered</span></p><Bars rows={a.counts.slice(0, 6)} total={a.answered} tone="bg-j3" /></div>
          ))}</div>
          {!b.answers.length && <p className="text-[13px] text-muted">Choice questions on the form show here, e.g. T-shirt size or diet.</p>}
        </Panel>
      </div>

      {/* B. Financial overview */}
      <Panel title={<span className="flex items-center gap-2"><Wallet size={17} className="text-brand" /> Money</span>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Target budget", m.target ? money(m.target) : "Not set", ""], ["Budgets submitted", money(m.budgets.amount), `${m.budgets.n} budget${m.budgets.n === 1 ? "" : "s"}`],
            ["Requests raised", money(m.submitted.amount), `${m.submitted.n} request${m.submitted.n === 1 ? "" : "s"}`], ["Approved", money(m.approved.amount), `${m.approved.n} approved`],
            ["Funds deployed", money(m.deployed), "Paid out"], ["Expenses documented", money(m.spent), m.reportsDue ? `${m.reportsDue} report${m.reportsDue === 1 ? "" : "s"} still due` : "All reports in"],
            ["Waiting on committee", money(m.atCommittee), ""], ["With finance / Lead Pastor", money(m.atFinance + m.atPastor), m.returned ? `${m.returned} sent back` : ""]].map(([l, v, s]) => (
            <div key={l} className="rounded-2xl bg-page p-3 ring-1 ring-line"><p className="text-[12.5px] text-muted">{l}</p><p className="num text-[19px] font-semibold">{v}</p>{s && <p className="text-[12px] text-muted">{s}</p>}</div>
          ))}
        </div>
        {m.target > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[13px]"><span>Approved against the target budget</span><span className="num">{pct(m.approved.amount / m.target)}</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-page ring-1 ring-line"><div className={cx("h-full rounded-full", m.approved.amount > m.target ? "bg-alert" : "bg-good")} style={{ width: `${Math.min(100, (m.approved.amount / m.target) * 100)}%` }} /></div>
            {m.approved.amount > m.target && <p className="mt-1 text-[12.5px] text-alert">Over the target budget by {money(m.approved.amount - m.target)}.</p>}
          </div>
        )}
      </Panel>

      {/* C. Other insights */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="card p-4"><p className="flex items-center gap-2 text-[13px] text-muted"><Users size={15} /> Check-in</p><p className="num mt-1 text-[22px] font-semibold">{num(b.checkin.in)} <span className="text-[14px] font-normal text-muted">of {num(b.checkin.expected)} in · {pct(b.checkin.pct)}</span></p></div>
        <div className="card p-4"><p className="flex items-center gap-2 text-[13px] text-muted"><Lightbulb size={15} /> Suggestions</p><p className="num mt-1 text-[22px] font-semibold">{b.notes.total} <span className="text-[14px] font-normal text-muted">· {b.notes.open} open</span></p></div>
        <div className="card p-4"><p className="flex items-center gap-2 text-[13px] text-muted"><CalendarClock size={15} /> Next committee meeting</p><p className="mt-1 text-[16px] font-semibold">{b.next ? `${dayShort(b.next.date)} at ${b.next.time}` : "None scheduled"}</p></div>
      </div>
      <p className="text-[12.5px] text-muted">How they&apos;re coming: {b.types.map(([k, v]) => `${num(v)} ${k === "online" ? "online" : k === "group" ? "in groups" : "on their own"}`).join(" · ") || "no registrations yet"}.</p>
    </div>
  );
}
