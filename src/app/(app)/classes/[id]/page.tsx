"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Award, Check, CalendarPlus, Link2, PlayCircle, Search, Settings2, UserPlus, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { DownloadButton } from "@/components/download";
import { Avatar, Badge, Button, Confetti, Empty, Panel, Sheet, Tabs, cx, inputCls, toast } from "@/components/ui";
import { JoinButton, MODE_LABEL, ModeIcon, ProgrammeForm, RecordingButton, scheduleText, tint } from "@/components/classes";
import { progress, record } from "@/lib/domain";
import { addDays, at } from "@/lib/seed-more";
import { dayName, fullName, timeOf } from "@/lib/format";
import type { ClassSession, Enrolment } from "@/lib/types";

type Tab = "sessions" | "students" | "dropoff";

export default function ProgrammePage() {
  const { id } = useParams<{ id: string }>();
  const { state, access, me, put, putMany, newId, updatePerson, person } = useStore();
  const [tab, setTab] = useState<Tab>("sessions");
  const [edit, setEdit] = useState(false);
  const [taking, setTaking] = useState<ClassSession | null>(null);
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [party, setParty] = useState(false);
  const p = state.programmes.find((x) => x.id === id);
  if (!access || !me) return null;
  if (!p) return <Empty title="Programme not found" body="It may have been removed." icon={<Award size={26} />} action={<Link href="/classes" className="text-brand">Back to classes</Link>} />;
  const manage = access.can("classes.manage") || access.leadsTraining;
  const t = tint(p);
  const sessions = state.sessions.filter((s) => s.programmeId === p.id).sort((a, b) => a.start.localeCompare(b.start));
  const enrolments = state.enrolments.filter((e) => e.programmeId === p.id);
  const mine = enrolments.find((e) => e.personId === me.id);

  const complete = (e: Enrolment) => {
    const n = enrolments.filter((x) => x.status === "completed").length + 1;
    put("enrolments", { ...e, status: "completed", completedAt: new Date().toISOString(), certNo: `${p.name.split(/\s+/).map((w) => w[0]).join("").toUpperCase()}-${new Date().getFullYear()}-${String(n).padStart(3, "0")}` }, `marked ${fullName(state.people.find((x) => x.id === e.personId))} as finished ${p.name}`);
    if (p.stageOnComplete) updatePerson(e.personId, { stage: p.stageOnComplete });
    setParty(true); setTimeout(() => setParty(false), 1400);
    toast(`${state.people.find((x) => x.id === e.personId)?.firstName} finished ${p.name}!`);
  };

  const addSessions = () => {
    const last = sessions.at(-1);
    const start = last ? addDays(last.date, 7) : p.startDate;
    const used = p.run === "batch" ? new Set(sessions.map((s) => s.moduleId)) : new Set<string>();
    const next = (p.run === "batch" ? p.modules.filter((m) => !used.has(m.id)) : p.modules).slice(0, p.run === "batch" ? 99 : p.modules.length);
    const list = (next.length ? next : p.modules).map((m, i) => {
      const d = addDays(start, 7 * i);
      return { id: newId("cs"), programmeId: p.id, moduleId: m.id, date: d, start: at(d, p.time), venue: p.venue, link: p.link, teacherId: me.id };
    });
    putMany("sessions", list, `scheduled ${list.length} classes for ${p.name}`);
    toast(`${list.length} classes scheduled`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Confetti show={party} />
      <Link href="/classes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> Classes</Link>
      <section className={cx("relative mb-6 overflow-hidden rounded-[28px] p-6 md:p-8", t.bg)}>
        <div aria-hidden className={cx("absolute -right-10 -top-16 size-64 rounded-full opacity-20", t.bar)} />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex flex-wrap gap-1.5"><Badge tone="neutral"><ModeIcon mode={p.mode} size={12} /> {MODE_LABEL[p.mode]}</Badge><Badge tone="neutral">{p.run === "rolling" ? "Join any week" : "Batch"}</Badge>{p.recordingsCount && <Badge tone="neutral"><PlayCircle size={12} /> Recordings count</Badge>}</div>
            <h1 className="mt-3 font-display text-[32px] font-semibold leading-tight tracking-tight md:text-[40px]">{p.name}</h1>
            <p className="mt-1 text-ink-soft">{p.description}</p>
            <p className="mt-2 text-[13.5px] text-muted">{scheduleText(p)}{p.venue && p.mode !== "virtual" ? ` · ${p.venue}` : ""} · finish after {p.completeAfter} of {p.modules.length}</p>
          </div>
          {manage && <div className="flex gap-2"><Button onClick={() => setEdit(true)}><Settings2 size={15} /> Settings</Button><Button variant="primary" onClick={() => setEnrolOpen(true)}><UserPlus size={15} /> Enrol people</Button></div>}
        </div>
      </section>

      {mine && <MyProgress e={mine} />}

      {manage && <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ key: "sessions", label: "Classes", count: sessions.length }, { key: "students", label: "Students", count: enrolments.length }, { key: "dropoff", label: "Where people drop off" }]} />}

      {(tab === "sessions" || !manage) && (
        <Panel title="Classes" action={manage && <Button onClick={addSessions}><CalendarPlus size={15} /> Schedule {p.run === "rolling" ? "the next round" : "the remaining classes"}</Button>}>
          {sessions.length === 0 ? <p className="text-sm text-muted">No classes scheduled yet.</p> : (
            <ol className="space-y-2">
              {sessions.map((s, i) => {
                const mod = p.modules.find((m) => m.id === s.moduleId);
                const past = Date.parse(s.start) + p.minutes * 6e4 < Date.now();
                const here = state.attendance.filter((a) => a.meetingId === s.id);
                const iCame = here.find((a) => a.personId === me.id);
                return (
                  <li key={s.id} className={cx("flex flex-wrap items-center gap-4 rounded-2xl p-3 ring-1", past ? "ring-line" : "bg-surface ring-brand/20")}>
                    <span className={cx("flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl leading-none", past ? "bg-page text-muted" : cx(t.bg, t.fg))}>
                      <span className="text-[10.5px] font-semibold uppercase">{dayName(s.start, { month: "short" })}</span>
                      <span className="num text-lg font-semibold">{dayName(s.start, { day: "numeric" })}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{i + 1}. {mod?.title}</span>
                      <span className="block text-[13px] text-muted">{timeOf(s.start)}{s.venue && p.mode !== "virtual" ? ` · ${s.venue}` : ""}{manage ? ` · ${here.length} came` : ""}</span>
                    </span>
                    {iCame && <Badge tone="good"><Check size={12} /> {iCame.method === "recording" ? "Caught up by recording" : "You came"}</Badge>}
                    {mine && !past && <JoinButton s={s} p={p} />}
                    {mine && !iCame && <RecordingButton s={s} p={p} />}
                    {manage && <span className="flex gap-1.5">
                      {p.mode !== "virtual" && <Button onClick={() => setTaking(s)}><Users size={15} /> Attendance</Button>}
                      <Button variant="ghost" onClick={() => { const url = prompt("Recording link", s.recording ?? ""); if (url !== null) { put("sessions", { ...s, recording: url || undefined }); toast(url ? "Recording added" : "Recording removed"); } }} aria-label="Recording link"><Link2 size={15} /></Button>
                    </span>}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      )}

      {manage && tab === "students" && (
        <Panel title="Students" action={<DownloadButton what={`${p.name} students`} small sheets={() => [{ name: p.name, rows: enrolments, columns: [
          { key: "name", label: "Name", value: (e: Enrolment) => fullName(person(e.personId)), width: 24 },
          { key: "phone", label: "Phone", value: (e: Enrolment) => { const x = person(e.personId); return x && access?.canSeeContacts(x) ? x.phone : "Hidden"; }, width: 16 },
          { key: "status", label: "Status", value: (e: Enrolment) => (e.status === "completed" ? "Finished" : e.status === "active" ? "In class" : e.status) },
          { key: "done", label: "Classes attended", value: (e: Enrolment) => progress(state, e).done.length },
          { key: "of", label: "Of", value: () => p.modules.length },
          { key: "enrolled", label: "Enrolled", value: (e: Enrolment) => e.enrolledAt?.slice(0, 10) },
          { key: "finished", label: "Finished", value: (e: Enrolment) => e.completedAt?.slice(0, 10) },
        ] }]} />}>
          {enrolments.length === 0 ? <p className="text-sm text-muted">No one has enrolled yet.</p> : (
            <ul className="divide-y divide-line">
              {enrolments.map((e) => {
                const person = state.people.find((x) => x.id === e.personId);
                const pr = progress(state, e);
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar person={person} size={38} />
                    <Link href={`/people/${e.personId}`} className="min-w-0 flex-1 font-medium hover:text-brand">{fullName(person)}</Link>
                    <span className="flex gap-1" aria-label={`${pr.done.length} of ${p.modules.length} classes`}>
                      {p.modules.map((m) => { const how = pr.attended.get(m.id); return <span key={m.id} title={`${m.title}${how === "recording" ? " (recording)" : ""}`} className={cx("size-3.5 rounded-[5px]", how === "recording" ? cx(t.bar, "opacity-45") : how ? t.bar : "bg-line")} />; })}
                    </span>
                    {e.status === "completed" ? <Link href={`/classes/certificate/${e.id}`}><Badge tone="glow"><Award size={12} /> Finished</Badge></Link>
                      : pr.ready ? <Button variant="primary" onClick={() => complete(e)}><Award size={15} /> Mark finished</Button>
                      : <span className="text-[12.5px] text-muted">{pr.left.length} to go</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {manage && tab === "dropoff" && <DropOff />}

      <Sheet open={edit} onClose={() => setEdit(false)} title="Programme settings">{edit && <ProgrammeForm initial={p} onSave={(x) => { put("programmes", x, `updated ${x.name}`); setEdit(false); toast("Saved"); }} />}</Sheet>
      <Sheet open={!!taking} onClose={() => setTaking(null)} title="Class attendance">{taking && <TakeAttendance s={taking} />}</Sheet>
      <Sheet open={enrolOpen} onClose={() => setEnrolOpen(false)} title={`Enrol in ${p.name}`}><Enrol /></Sheet>
    </div>
  );

  function MyProgress({ e }: { e: Enrolment }) {
    const pr = progress(state, e);
    return (
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-display text-lg font-semibold">{e.status === "completed" ? "You finished. Well done!" : `${pr.done.length} of ${p!.completeAfter} classes done`}</p><p className="text-sm text-muted">{e.status === "completed" ? "Your certificate is ready." : `${pr.left.length} left`}</p></div>
          {e.status === "completed" && <Link href={`/classes/certificate/${e.id}`}><Button variant="primary"><Award size={15} /> Certificate</Button></Link>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {p!.modules.map((m) => { const how = pr.attended.get(m.id); return (
            <div key={m.id} className={cx("flex items-center gap-2 rounded-xl px-3 py-2 text-[13px]", how ? cx(t.bg, t.fg) : "bg-page text-muted")}>
              {how ? <Check size={14} /> : <span className="size-3.5 rounded-full ring-2 ring-line" />}<span className="truncate">{m.title}</span>{how === "recording" && <PlayCircle size={12} className="ml-auto shrink-0" />}
            </div>
          ); })}
        </div>
      </div>
    );
  }

  function TakeAttendance({ s }: { s: ClassSession }) {
    const already = new Set(state.attendance.filter((a) => a.meetingId === s.id).map((a) => a.personId));
    const [ticks, setTicks] = useState<Set<string>>(new Set());
    const students = enrolments.map((e) => state.people.find((x) => x.id === e.personId)).filter(Boolean) as typeof state.people;
    return (
      <div>
        <p className="mb-3 text-sm text-muted">{p!.modules.find((m) => m.id === s.moduleId)?.title} · {dayName(s.start)}</p>
        <ul className="space-y-1">{students.map((st) => {
          const on = already.has(st.id) || ticks.has(st.id);
          return (
            <li key={st.id}><button disabled={already.has(st.id)} onClick={() => { const n = new Set(ticks); if (n.has(st.id)) n.delete(st.id); else n.add(st.id); setTicks(n); }}
              className={cx("flex w-full items-center gap-3 rounded-xl p-2 text-left", on ? "bg-good-soft" : "hover:bg-page")}>
              <Avatar person={st} size={34} /><span className="flex-1 font-medium">{fullName(st)}</span>
              <span className={cx("flex size-6 items-center justify-center rounded-lg", on ? "bg-good text-white" : "ring-2 ring-line")}>{on && <Check size={14} />}</span>
            </button></li>
          );
        })}</ul>
        <Button variant="primary" className="mt-4 w-full" disabled={!ticks.size} onClick={() => { putMany("attendance", [...ticks].map((pid) => record(s.id, pid, "usher", newId("at"))), `took attendance for ${p!.name}`); toast(`${ticks.size} marked present`); setTaking(null); }}>Save {ticks.size || ""} present</Button>
      </div>
    );
  }

  function Enrol() {
    const [q, setQ] = useState("");
    const ids = new Set(enrolments.map((e) => e.personId));
    const found = access!.visiblePeople().filter((x) => !x.isChild && !ids.has(x.id) && (!q || fullName(x).toLowerCase().includes(q.toLowerCase()))).slice(0, 12);
    return (
      <div>
        <div className="relative"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input className={cx(inputCls, "pl-10")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" autoFocus /></div>
        <ul className="mt-3 space-y-1">{found.map((x) => (
          <li key={x.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-page"><Avatar person={x} size={34} /><span className="flex-1 font-medium">{fullName(x)}</span>
            <Button onClick={() => { put("enrolments", { id: newId("en"), programmeId: p!.id, personId: x.id, status: "active", enrolledAt: new Date().toISOString() }, `enrolled ${fullName(x)} in ${p!.name}`); toast(`${x.firstName} enrolled`); }}>Enrol</Button></li>
        ))}</ul>
      </div>
    );
  }

  function DropOff() {
    const total = enrolments.length || 1;
    const rows = p!.modules.map((m) => ({ m, n: enrolments.filter((e) => progress(state, e).attended.has(m.id)).length }));
    return (
      <Panel title="How many reached each class">
        <ul className="space-y-3">
          {rows.map(({ m, n }, i) => (
            <li key={m.id}>
              <div className="mb-1 flex justify-between text-[13.5px]"><span>{i + 1}. {m.title}</span><span className="num font-semibold">{n} <span className="font-normal text-muted">· {Math.round((n / total) * 100)}%</span></span></div>
              <div className="h-3 rounded-full bg-page"><div className={cx("h-full rounded-full transition-all duration-700", t.bar)} style={{ width: `${(n / total) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-muted">Of {enrolments.length} enrolled. A sharp drop shows where people may need a call.</p>
      </Panel>
    );
  }
}
