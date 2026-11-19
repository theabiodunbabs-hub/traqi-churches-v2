"use client";

import { useState } from "react";
import { Check, Globe, MapPin, PlayCircle, Video } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Field, Toggle, cx, inputCls, toast } from "./ui";
import { courseWords, joinCounts, plural, PROGRAMME_TINTS, record, signersOf, WEEKDAYS } from "@/lib/domain";
import { SignersEditor } from "./signature";
import type { Journey } from "@/lib/journey";
import type { ClassSession, Programme } from "@/lib/types";

export const tint = (p: Programme) => PROGRAMME_TINTS[p.color % PROGRAMME_TINTS.length];
export const MODE_LABEL = { physical: "In person", virtual: "Online", hybrid: "In person and online" };
export const ModeIcon = ({ mode, size = 14 }: { mode: Programme["mode"]; size?: number }) => mode === "virtual" ? <Globe size={size} /> : mode === "hybrid" ? <Video size={size} /> : <MapPin size={size} />;
export const fmtTime = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
export const scheduleText = (p: Programme) => `${WEEKDAYS[p.weekday]}s · ${fmtTime(p.time)} · ${p.minutes} minutes`;

/**
 * "Join class": opens the meeting without ever showing the raw link,
 * and records attendance when clicked from 15 minutes before until the class ends.
 */
export function JoinButton({ s, p, className, light }: { s: ClassSession; p: Programme; className?: string; light?: boolean }) {
  const { me, state, put, newId } = useStore();
  const link = s.link ?? p.link;
  if (!link || p.mode === "physical") return null;
  const live = joinCounts(s, p);
  const done = state.attendance.some((a) => a.meetingId === s.id && a.personId === me?.id);
  return (
    <Button variant={light ? "light" : "primary"} className={cx(live && "pulse", className)} onClick={() => {
      if (live && me && !done) { put("attendance", record(s.id, me.id, "online", newId("at"))); toast("You're marked present. Enjoy the class!"); }
      window.open(link, "_blank", "noopener");
    }}><Video size={15} /> {live ? "Join class now" : "Join class"}</Button>
  );
}

export function RecordingButton({ s, p }: { s: ClassSession; p: Programme }) {
  const { me, state, put, newId } = useStore();
  if (!s.recording) return null;
  const done = state.attendance.some((a) => a.meetingId === s.id && a.personId === me?.id);
  return (
    <Button onClick={() => {
      if (p.recordingsCount && me && !done) { put("attendance", record(s.id, me.id, "recording", newId("at"))); toast("Marked as caught up by recording"); }
      window.open(s.recording, "_blank", "noopener");
    }}><PlayCircle size={15} /> Watch recording</Button>
  );
}

type Finish = "member" | "worker" | "growth";
const COURSE_WORDS = ["Course", "Programme", "Class", "School"];
const PART_WORDS = ["Lesson", "Module", "Class", "Session"];

/** Which journey step finishing this course leads to, read from the church's journey. */
export function finishOf(state: { church: { profile?: { journey?: Journey } } }, id: string): Finish {
  const st = (state.church.profile?.journey?.stages ?? []).find((x) => x.classId === id && (x.rule === "class" || x.rule === "class_confirm"));
  return st?.kind === "worker" ? "worker" : st && (st.kind === "member" || st.kind === "visitor") ? "member" : "growth";
}
/** Point the journey at this course: the member step, the worker step, or neither. */
export function linkJourney(j: Journey, id: string, finish: Finish): Journey {
  const isClassRule = (r: string) => r === "class" || r === "class_confirm" || r === "enrolled";
  // Unlink it everywhere first
  let stages = j.stages.map((x) => (x.classId === id ? { ...x, classId: undefined } : x));
  if (finish !== "growth") {
    const i = stages.findIndex((x) => x.kind === finish && isClassRule(x.rule));
    const at = i >= 0 ? i : stages.findIndex((x) => x.kind === finish);
    if (at >= 0) {
      stages = stages.map((x, k) => (k === at ? { ...x, classId: id, rule: isClassRule(x.rule) ? x.rule : "class" } : x));
      // A "while in the class" step just before it follows the same course
      if (at > 0 && stages[at - 1].rule === "enrolled") stages = stages.map((x, k) => (k === at - 1 ? { ...x, classId: id } : x));
    }
  }
  return { ...j, stages };
}

function WordPick({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const custom = !options.includes(value);
  return (
    <div>
      <span className="mb-1.5 block text-[13.5px] text-ink-soft">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => <button type="button" key={o} onClick={() => onChange(o)} className={cx("min-h-10 rounded-xl px-3.5 text-sm ring-1", value === o ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-surface ring-line")}>{o}</button>)}
        <input className={cx(inputCls, "w-36 py-2", custom && "ring-2 ring-brand")} value={custom ? value : ""} onChange={(e) => onChange(e.target.value)} placeholder="Other word" aria-label={`Other word for ${label.toLowerCase()}`} />
      </div>
    </div>
  );
}

export function ProgrammeForm({ initial, onSave }: { initial: Programme; onSave: (p: Programme, finish: Finish) => void }) {
  const { state } = useStore();
  const [p, setP] = useState<Programme>({ ...initial, signers: signersOf(initial) });
  const [mods, setMods] = useState(initial.modules.map((m) => m.title).join("\n"));
  const [finish, setFinish] = useState<Finish>(() => finishOf(state, initial.id));
  const set = <K extends keyof Programme>(k: K, v: Programme[K]) => setP({ ...p, [k]: v });
  const w = courseWords(p);
  const choice = (on: boolean) => cx("min-h-11 rounded-xl px-2 text-sm ring-1", on ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line");
  const count = mods.split("\n").filter((x) => x.trim()).length;
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl bg-page p-4 ring-1 ring-line">
        <p className="font-medium">What does your church call these?</p>
        <WordPick label="The whole thing" options={COURSE_WORDS} value={w.course} onChange={(v) => set("words", { course: v, part: w.part })} />
        <WordPick label="Each part of it" options={PART_WORDS} value={w.part} onChange={(v) => set("words", { course: w.course, part: v })} />
      </div>
      <Field label={`Name of the ${w.course.toLowerCase()}`}><input className={inputCls} value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Foundation School" /></Field>
      <Field label="What it's about"><textarea className={cx(inputCls, "min-h-20")} value={p.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <Field label={`${plural(w.part)}, one per line`} hint={`Each line is one ${w.part.toLowerCase()}.`}>
        <textarea className={cx(inputCls, "min-h-36")} value={mods} onChange={(e) => setMods(e.target.value)} placeholder={"Salvation\nThe Holy Spirit\nWater baptism"} />
      </Field>
      <div><span className="mb-1.5 block text-sm font-medium">How people join</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => set("run", "batch")} className={choice(p.run === "batch")}>Everyone starts on the same date</button>
          <button type="button" onClick={() => set("run", "rolling")} className={choice(p.run === "rolling")}>People can join any week</button>
        </div>
        <p className="mt-1 text-[12.5px] text-muted">{p.run === "rolling" ? `The ${plural(w.part).toLowerCase()} repeat. People join any week and take each one once, in any order.` : "Everyone starts and finishes together."}</p>
      </div>
      <div><span className="mb-1.5 block text-sm font-medium">What happens when someone finishes this {w.course.toLowerCase()}?</span>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {([["member", "They become a member"], ["worker", "They can serve as a worker"], ["growth", "Nothing, it's for growth"]] as [Finish, string][]).map(([k, l]) => <button type="button" key={k} onClick={() => setFinish(k)} className={choice(finish === k)}>{l}</button>)}
        </div>
        <p className="mt-1 text-[12.5px] text-muted">{finish === "growth" ? "Good for counselling, marriage classes and Bible studies. It won't move anyone on their journey." : "This links the course to your church's journey."}</p>
      </div>
      <div><span className="mb-1.5 block text-sm font-medium">Where</span>
        <div className="grid grid-cols-3 gap-1.5">{(["physical", "virtual", "hybrid"] as const).map((m) => <button type="button" key={m} onClick={() => set("mode", m)} className={choice(p.mode === m)}>{m === "physical" ? "In person" : m === "virtual" ? "Online" : "Both"}</button>)}</div>
      </div>
      {p.mode !== "virtual" && <Field label="Venue"><input className={inputCls} value={p.venue ?? ""} onChange={(e) => set("venue", e.target.value)} placeholder="Room B, main building" /></Field>}
      {p.mode !== "physical" && <Field label="Meeting link" hint={`Students never see it. They tap “Join” and Traqi records they came.`}><input className={inputCls} value={p.link ?? ""} onChange={(e) => set("link", e.target.value)} placeholder="https://zoom.us/j/…" /></Field>}
      <div className="grid grid-cols-3 gap-2">
        <Field label="Day"><select className={inputCls} value={p.weekday} onChange={(e) => set("weekday", Number(e.target.value))}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
        <Field label="Time"><input type="time" className={inputCls} value={p.time} onChange={(e) => set("time", e.target.value)} /></Field>
        <Field label="Minutes"><input inputMode="numeric" className={inputCls} value={p.minutes} onChange={(e) => set("minutes", Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
      </div>
      <Field label="Starts on"><input type="date" className={inputCls} value={p.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
      <Field label={`${plural(w.part)} needed to finish`} hint={`Out of ${count}.`}><input inputMode="numeric" className={inputCls} value={p.completeAfter} onChange={(e) => set("completeAfter", Number(e.target.value.replace(/\D/g, "")) || 1)} /></Field>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line"><span>For couples<br /><span className="text-muted">Each person enrols; the pair share one certificate with both names.</span></span><Toggle label="For couples" on={!!p.couples} onChange={(v) => set("couples", v || undefined)} /></label>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line"><span>Watching the recording counts<br /><span className="text-muted">Shown as “caught up by recording”.</span></span><Toggle label="Recordings count" on={p.recordingsCount} onChange={(v) => set("recordingsCount", v)} /></label>
      <Field label="Must finish first"><select className={inputCls} value={p.prerequisiteId ?? ""} onChange={(e) => set("prerequisiteId", e.target.value || undefined)}><option value="">Nothing</option>{state.programmes.filter((x) => x.id !== p.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <SignersEditor value={p.signers ?? []} onChange={(v) => set("signers", v)} />
      <div><span className="mb-1.5 block text-sm font-medium">Colour</span>
        <div className="flex gap-2">{PROGRAMME_TINTS.map((t, i) => <button type="button" key={i} onClick={() => set("color", i)} aria-label={`Colour ${i + 1}`} className={cx("flex size-10 items-center justify-center rounded-full text-white", t.bar, p.color === i && "ring-4 ring-offset-2 ring-brand/30")}>{p.color === i && <Check size={15} />}</button>)}</div>
      </div>
      <Button variant="primary" className="w-full py-3" disabled={!p.name.trim() || !mods.trim()} onClick={() => {
        const titles = mods.split("\n").map((x) => x.trim()).filter(Boolean);
        const modules = titles.map((t, i) => p.modules.find((m) => m.title === t) ?? { id: `${p.id}-m${i + 1}-${Date.now() % 1e4}`, title: t });
        const signers = (p.signers ?? []).filter((x) => x.name.trim() || x.title.trim());
        onSave({ ...p, modules, signers, signatories: signers.map((x) => x.title || x.name), stageOnComplete: undefined, completeAfter: Math.min(p.completeAfter, modules.length) }, finish);
      }}>Save</Button>
    </div>
  );
}
