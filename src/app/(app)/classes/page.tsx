"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Award, CalendarClock, GraduationCap, Plus, Repeat, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge, Button, Empty, PageHeader, ProgressRing, Sheet, cx, toast } from "@/components/ui";
import { JoinButton, MODE_LABEL, ModeIcon, ProgrammeForm, RecordingButton, scheduleText, tint } from "@/components/classes";
import { progress } from "@/lib/domain";
import { dayName, timeOf, todayLagos } from "@/lib/format";
import type { Programme } from "@/lib/types";

export default function Classes() {
  const { state, access, me, put, newId } = useStore();
  const [creating, setCreating] = useState<Programme | null>(null);
  if (!access || !me) return null;
  const manage = access.can("classes.manage") || access.leadsTraining;
  const myEnrolments = state.enrolments.filter((e) => e.personId === me.id);
  const upcoming = state.sessions
    .filter((s) => !s.cancelled && Date.parse(s.start) + 3 * 36e5 > Date.now() && myEnrolments.some((e) => e.programmeId === s.programmeId && e.status === "active"))
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const upProg = upcoming && state.programmes.find((p) => p.id === upcoming.programmeId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Classes" sub={manage ? "Every programme your church runs, and how each student is doing." : "Grow at your own pace, with your church family."}
        actions={manage && <Button variant="primary" onClick={() => setCreating({ id: newId("pr"), name: "", description: "", modules: [], run: "batch", mode: "physical", weekday: 0, time: "12:00", minutes: 60, completeAfter: 1, recordingsCount: true, signatories: ["Lead pastor"], startDate: todayLagos(), color: state.programmes.length % 4 })}><Plus size={16} /> New programme</Button>} />

      {upcoming && upProg && (
        <section className="hero mb-6 flex flex-wrap items-center justify-between gap-5 px-6 py-6 md:px-8">
          <div>
            <p className="text-[13px] text-white/60">Your next class</p>
            <p className="mt-1 font-display text-2xl font-semibold">{upProg.modules.find((m) => m.id === upcoming.moduleId)?.title}</p>
            <p className="mt-1 text-white/70">{upProg.name} · {dayName(upcoming.start, { weekday: "long", day: "numeric", month: "short" })} at {timeOf(upcoming.start)}{upProg.mode !== "virtual" && ` · ${upcoming.venue ?? upProg.venue}`}</p>
          </div>
          <div className="flex gap-2"><JoinButton s={upcoming} p={upProg} light /><RecordingButton s={upcoming} p={upProg} /></div>
        </section>
      )}

      {state.programmes.length === 0 ? (
        <Empty title="No classes yet" body="Set up your first programme: the classes, the schedule, and where it meets." icon={<GraduationCap size={26} />} action={manage && <Button variant="primary" onClick={() => setCreating({ id: newId("pr"), name: "", description: "", modules: [], run: "batch", mode: "physical", weekday: 0, time: "12:00", minutes: 60, completeAfter: 1, recordingsCount: true, signatories: ["Lead pastor"], startDate: todayLagos(), color: 0 })}>New programme</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {state.programmes.map((p) => {
            const t = tint(p);
            const enr = state.enrolments.filter((e) => e.programmeId === p.id);
            const mine = myEnrolments.find((e) => e.programmeId === p.id);
            const pr = mine && progress(state, mine);
            const done = enr.filter((e) => e.status === "completed").length;
            const preOk = !p.prerequisiteId || state.enrolments.some((e) => e.personId === me.id && e.programmeId === p.prerequisiteId && e.status === "completed");
            return (
              <div key={p.id} className="card card-hover group relative overflow-hidden">
                <div className={cx("relative h-24 overflow-hidden", t.bg)}>
                  <div aria-hidden className={cx("absolute -right-6 -top-10 size-36 rounded-full opacity-25", t.bar)} />
                  <div aria-hidden className={cx("absolute right-20 top-10 size-16 rounded-full opacity-15", t.bar)} />
                  <div className="absolute bottom-3 left-5 flex gap-1.5">
                    <Badge tone="neutral"><ModeIcon mode={p.mode} size={12} /> {MODE_LABEL[p.mode]}</Badge>
                    <Badge tone="neutral">{p.run === "rolling" ? <><Repeat size={12} /> Join any week</> : <><CalendarClock size={12} /> Batch</>}</Badge>
                  </div>
                </div>
                <Link href={`/classes/${p.id}`} className="block p-5">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-xl font-semibold tracking-tight group-hover:text-brand">{p.name}</h2>
                      <p className="mt-1 line-clamp-2 text-[14px] text-ink-soft">{p.description}</p>
                    </div>
                    {pr && <span className={t.fg}><ProgressRing value={pr.done.length / p.modules.length} size={52}>{pr.done.length}/{p.modules.length}</ProgressRing></span>}
                  </div>
                  <p className="mt-3 text-[13px] text-muted">{p.modules.length} classes · {scheduleText(p)}</p>
                  {manage && <div className="mt-4 flex gap-4 text-[13px]"><span className="flex items-center gap-1.5"><Users size={14} className="text-muted" /> {enr.filter((e) => e.status === "active").length} studying</span><span className="flex items-center gap-1.5"><Award size={14} className="text-muted" /> {done} finished</span></div>}
                </Link>
                {!mine && !manage && (
                  <div className="px-5 pb-5">
                    {preOk ? <Button variant="primary" className="w-full" onClick={() => { put("enrolments", { id: newId("en"), programmeId: p.id, personId: me.id, status: "active", enrolledAt: new Date().toISOString() }, `enrolled in ${p.name}`); toast(`You're enrolled in ${p.name}`); }}>Enrol <ArrowRight size={15} /></Button>
                      : <p className="rounded-xl bg-page px-3 py-2 text-[13px] text-muted">Finish {state.programmes.find((x) => x.id === p.prerequisiteId)?.name} first.</p>}
                  </div>
                )}
                {mine?.status === "completed" && <div className="px-5 pb-5"><Link href={`/classes/certificate/${mine.id}`} className="flex items-center justify-center gap-2 rounded-xl bg-glow-soft py-2.5 text-sm font-semibold text-glow-ink"><Award size={16} /> View your certificate</Link></div>}
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!creating} onClose={() => setCreating(null)} title="New programme">
        {creating && <ProgrammeForm initial={creating} onSave={(p) => { put("programmes", p, `created the programme ${p.name}`); setCreating(null); toast(`${p.name} is ready`); }} />}
      </Sheet>
    </div>
  );
}
