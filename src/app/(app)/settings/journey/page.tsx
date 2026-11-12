"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BadgeCheck, CalendarClock, Check, Hourglass, MessageSquarePlus, PartyPopper, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { JourneyEditor } from "@/components/journey-editor";
import { Avatar, Badge, Button, Empty, PageHeader, Panel, Sheet, Tabs, cx, inputCls } from "@/components/ui";
import { defaultJourney, journeyStages, stageView, type Journey } from "@/lib/journey";
import { probationDue } from "@/lib/journey-engine";
import { fullName, shortDate } from "@/lib/format";
import type { Person } from "@/lib/types";

type Tab = "now" | "stages";

export default function JourneyPage() {
  const { state, access } = useStore();
  const [tab, setTab] = useState<Tab>("now");
  if (!access) return null;
  if (!(access.isPastoral || access.can("roles.manage"))) return <Empty title="For pastors and admins" body="The journey is set by the church's pastors." />;
  const waiting = state.people.filter((p) => p.awaitingStage && !p.inactive).length;
  const due = probationDue(state).length;
  return (
    <div>
      <PageHeader title="Journey" sub="The steps people take in your church, from first visit to leading. See where people are, and who's waiting on you." />
      <Tabs value={tab} onChange={setTab} className="mb-6" items={[
        { key: "now", label: "Where people are", count: waiting + due || undefined },
        { key: "stages", label: "Stages and rules" },
      ]} />
      {tab === "now" ? <Now /> : <Stages />}
    </div>
  );
}

function Now() {
  const { state, me, confirmStage } = useStore();
  const stages = journeyStages();
  const people = state.people.filter((p) => !p.inactive && !p.isChild);
  const counts = useMemo(() => stages.map((s) => ({ s, n: people.filter((p) => p.stage === s.key).length })), [stages, people]);
  const total = Math.max(1, people.length);
  const waiting = people.filter((p) => p.awaitingStage);
  const onProbation = people.filter((p) => p.probation);
  const due = probationDue(state);
  // A stage is a bottleneck when far more people sit in it than move on to the next.
  const bottleneck = counts.slice(0, -1).map((c, i) => ({ ...c, next: counts[i + 1] })).filter((c) => c.n >= 5 && c.n > (c.next?.n ?? 0) * 2).sort((a, b) => b.n - a.n)[0];
  const [deciding, setDeciding] = useState<Person | null>(null);
  const isNew = (p: Person) => p.joinedVia !== "import" && !!p.firstVisit && (Date.now() - Date.parse(p.firstVisit)) / 864e5 <= 30;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-surface p-5 ring-1 ring-line md:p-6">
        <div className="flex h-4 overflow-hidden rounded-full">
          {counts.map(({ s, n }) => n > 0 && <span key={s.key} className={s.tone} style={{ width: `${(n / total) * 100}%` }} title={`${s.name}: ${n}`} />)}
        </div>
        <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {counts.map(({ s, n }, i) => (
            <li key={s.key}>
              <Link href={`/people?stage=${s.key}`} className="flex items-center gap-3 rounded-2xl bg-page px-3.5 py-3 ring-1 ring-line transition hover:ring-brand/40">
                <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-semibold", s.tone, s.text)}>{i + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{s.name}</span><span className="block text-[12.5px] text-muted">{s.kind === "visitor" ? "Visitor" : s.kind[0].toUpperCase() + s.kind.slice(1)}</span></span>
                <span className="font-display text-2xl font-semibold tabular-nums">{n}</span>
              </Link>
            </li>
          ))}
        </ol>
        {bottleneck && (
          <p className="mt-5 flex items-start gap-2.5 rounded-2xl bg-glow-soft px-4 py-3 text-[14.5px] text-glow-ink">
            <TrendingUp size={17} className="mt-0.5 shrink-0" />
            <span><b>{bottleneck.n} people are at {bottleneck.s.name}</b>, but only {bottleneck.next?.n ?? 0} have moved on to {bottleneck.next?.s.name}. {bottleneck.next?.s.rule === "class" || bottleneck.next?.s.rule === "class_confirm" || bottleneck.next?.s.rule === "enrolled" ? "Starting a new class could help." : "A personal invitation could help."}</span>
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={<span className="flex items-center gap-2"><BadgeCheck size={17} className="text-brand" /> Waiting for you to confirm ({waiting.length})</span>}>
          {waiting.length === 0 ? <p className="text-sm text-muted">No one. When someone finishes a class that needs a leader to confirm, they&apos;ll show here.</p> : (
            <ul className="-mx-2 divide-y divide-line">
              {waiting.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-2 py-3">
                  <Avatar person={p} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/people/${p.id}`} className="block truncate font-medium hover:text-brand">{fullName(p)}</Link>
                    <p className="flex items-center gap-1.5 text-[12.5px] text-muted">{stageView(p.stage).name} <ArrowRight size={12} /> {stageView(p.awaitingStage!).name}</p>
                  </div>
                  <Button variant="primary" onClick={() => confirmStage(p.id)}><Check size={15} /> Confirm</Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={<span className="flex items-center gap-2"><Hourglass size={17} className="text-brand" /> On probation ({onProbation.length})</span>}
          action={state.church.profile?.journey?.probation?.enabled ? undefined : <span className="text-xs text-muted">Off</span>}>
          {onProbation.length === 0 ? <p className="text-sm text-muted">{state.church.profile?.journey?.probation?.enabled ? "No one is on probation." : "Probation is off. Turn it on under Stages and rules if you'd like new workers to serve for a while before they're confirmed."}</p> : (
            <ul className="-mx-2 divide-y divide-line">
              {onProbation.map((p) => {
                const isDue = due.some((d) => d.id === p.id);
                const g = state.groups.find((x) => x.id === p.probation!.groupId);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-2 py-3">
                    <Avatar person={p} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/people/${p.id}`} className="block truncate font-medium hover:text-brand">{fullName(p)}</Link>
                      <p className="text-[12.5px] text-muted">{g?.name ?? "Serving"} · {p.probation!.reason === "no_class" ? "Class not done yet" : "New worker"} · ends {shortDate(p.probation!.until)}</p>
                    </div>
                    {isDue ? <Button variant="primary" onClick={() => setDeciding(p)}><CalendarClock size={15} /> Decide</Button>
                      : <Button onClick={() => setDeciding(p)}><MessageSquarePlus size={15} /> Notes</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {(() => {
        const fresh = people.filter((p) => isNew(p) && p.stage !== stages[0]?.key).slice(0, 6);
        return fresh.length > 0 && (
          <Panel title={<span className="flex items-center gap-2"><PartyPopper size={17} className="text-glow-ink" /> Moved forward this month</span>}>
            <ul className="flex flex-wrap gap-2">
              {fresh.map((p) => <li key={p.id} className="flex items-center gap-2 rounded-full bg-page py-1 pl-1 pr-3 text-sm ring-1 ring-line"><Avatar person={p} size={26} />{p.firstName}<Badge tone="brand">{stageView(p.stage).name}</Badge></li>)}
            </ul>
          </Panel>
        );
      })()}

      {deciding && <Decide person={deciding} canDecide={!!me} onClose={() => setDeciding(null)} />}
    </div>
  );
}

function Decide({ person: p, onClose }: { person: Person; canDecide: boolean; onClose: () => void }) {
  const { state, person, decideProbation, addProbationNote } = useStore();
  const [note, setNote] = useState("");
  const pr = state.people.find((x) => x.id === p.id)?.probation;
  if (!pr) return null;
  const isDue = pr.until <= new Date().toISOString().slice(0, 10);
  const g = state.groups.find((x) => x.id === pr.groupId);
  const act = (d: "confirm" | "extend" | "remove") => { decideProbation(p.id, d); onClose(); };
  return (
    <Sheet open onClose={onClose} title={`${p.firstName}'s probation`} footer={
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={() => act("remove")} className="text-alert">Step down</Button>
        <Button onClick={() => act("extend")}>Extend</Button>
        <Button variant="primary" onClick={() => act("confirm")}><Check size={15} /> Confirm</Button>
      </div>
    }>
      <div className="space-y-5">
        <div className="rounded-2xl bg-page p-4 ring-1 ring-line text-[14.5px]">
          <p><b>{fullName(p)}</b> has served in {g?.name ?? "their department"} since {shortDate(pr.startedAt.slice(0, 10))}.</p>
          <p className="mt-1 text-ink-soft">{isDue ? "The probation period is over. Choose what happens next." : `It ends on ${shortDate(pr.until)}. You can decide early.`}</p>
          {pr.reason === "no_class" && <p className="mt-2 flex items-center gap-1.5 text-[13px] text-glow-ink"><AlertTriangle size={13} /> Started serving before finishing the class. Finishing it ends probation on its own.</p>}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Notes from leaders</p>
          {(pr.notes ?? []).length === 0 ? <p className="text-sm text-muted">No notes yet.</p> : (
            <ul className="space-y-2">{pr.notes!.map((n, i) => <li key={i} className="rounded-xl bg-page px-3 py-2 text-[14px] ring-1 ring-line">{n.text}<span className="mt-0.5 block text-[12px] text-muted">{fullName(person(n.byId))} · {shortDate(n.at.slice(0, 10))}</span></li>)}</ul>
          )}
          <div className="mt-3 flex gap-2">
            <input className={inputCls} placeholder="Faithful at rehearsals, on time…" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button onClick={() => { if (note.trim()) { addProbationNote(p.id, note.trim()); setNote(""); } }}>Add</Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function Stages() {
  const { state, saveJourney } = useStore();
  const saved = state.church.profile?.journey ?? defaultJourney();
  const [j, setJ] = useState<Journey>(saved);
  const changed = JSON.stringify(j) !== JSON.stringify(saved);
  const removed = saved.stages.filter((s) => !j.stages.some((x) => x.key === s.key));
  const stranded = removed.reduce((n, s) => n + state.people.filter((p) => p.stage === s.key).length, 0);
  return (
    <div className="space-y-5">
      <Panel>
        <JourneyEditor value={j} onChange={setJ} classes={state.programmes} />
      </Panel>
      {changed && (
        <div className="sticky bottom-24 z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-deep p-4 text-white shadow-xl md:bottom-6">
          <p className="flex-1 text-[14.5px]">{stranded ? `${stranded} people are in stages you removed. They'll move to the nearest stage of the same kind.` : "You have unsaved changes."}</p>
          <Button onClick={() => setJ(saved)} className="bg-white/10 text-white ring-white/20">Undo</Button>
          <Button variant="light" onClick={() => saveJourney(j)}>Save journey</Button>
        </div>
      )}
    </div>
  );
}
