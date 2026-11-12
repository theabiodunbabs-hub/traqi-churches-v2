"use client";

import { useState } from "react";
import { Check, Globe, MapPin, PlayCircle, Video } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Field, Toggle, cx, inputCls, toast } from "./ui";
import { joinCounts, PROGRAMME_TINTS, record, WEEKDAYS } from "@/lib/domain";
import { STAGES_NOW } from "@/lib/format";
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

export function ProgrammeForm({ initial, onSave }: { initial: Programme; onSave: (p: Programme) => void }) {
  const { state } = useStore();
  const [p, setP] = useState(initial);
  const [mods, setMods] = useState(initial.modules.map((m) => m.title).join("\n"));
  const set = <K extends keyof Programme>(k: K, v: Programme[K]) => setP({ ...p, [k]: v });
  const choice = (on: boolean) => cx("rounded-xl py-2 text-sm ring-1", on ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line");
  return (
    <div className="space-y-4">
      <Field label="Name"><input className={inputCls} value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Foundation School" /></Field>
      <Field label="What it's about"><textarea className={cx(inputCls, "min-h-20")} value={p.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <Field label="Classes, one per line" hint="Each line is one class or module.">
        <textarea className={cx(inputCls, "min-h-36")} value={mods} onChange={(e) => setMods(e.target.value)} placeholder={"Salvation\nThe Holy Spirit\nWater baptism"} />
      </Field>
      <div><span className="mb-1.5 block text-sm font-medium">How people join</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => set("run", "batch")} className={choice(p.run === "batch")}>A batch, together</button>
          <button onClick={() => set("run", "rolling")} className={choice(p.run === "rolling")}>Rolling, any time</button>
        </div>
        <p className="mt-1 text-xs text-muted">{p.run === "rolling" ? "Classes repeat. People join any week and take each class once, in any order." : "Everyone starts and finishes together."}</p>
      </div>
      <div><span className="mb-1.5 block text-sm font-medium">Where</span>
        <div className="grid grid-cols-3 gap-1.5">{(["physical", "virtual", "hybrid"] as const).map((m) => <button key={m} onClick={() => set("mode", m)} className={choice(p.mode === m)}>{m === "physical" ? "In person" : m === "virtual" ? "Online" : "Both"}</button>)}</div>
      </div>
      {p.mode !== "virtual" && <Field label="Venue"><input className={inputCls} value={p.venue ?? ""} onChange={(e) => set("venue", e.target.value)} placeholder="Room B, main building" /></Field>}
      {p.mode !== "physical" && <Field label="Meeting link" hint="Students never see it. They tap “Join class” and Traqi records they came."><input className={inputCls} value={p.link ?? ""} onChange={(e) => set("link", e.target.value)} placeholder="https://zoom.us/j/…" /></Field>}
      <div className="grid grid-cols-3 gap-2">
        <Field label="Day"><select className={inputCls} value={p.weekday} onChange={(e) => set("weekday", Number(e.target.value))}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
        <Field label="Time"><input type="time" className={inputCls} value={p.time} onChange={(e) => set("time", e.target.value)} /></Field>
        <Field label="Minutes"><input inputMode="numeric" className={inputCls} value={p.minutes} onChange={(e) => set("minutes", Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
      </div>
      <Field label="Starts on"><input type="date" className={inputCls} value={p.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
      <Field label="Classes needed to finish" hint={`Out of ${mods.split("\n").filter((x) => x.trim()).length}.`}><input inputMode="numeric" className={inputCls} value={p.completeAfter} onChange={(e) => set("completeAfter", Number(e.target.value.replace(/\D/g, "")) || 1)} /></Field>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line"><span>Watching the recording counts<br /><span className="text-muted">Shown as “caught up by recording”.</span></span><Toggle label="Recordings count" on={p.recordingsCount} onChange={(v) => set("recordingsCount", v)} /></label>
      <Field label="Must finish first"><select className={inputCls} value={p.prerequisiteId ?? ""} onChange={(e) => set("prerequisiteId", e.target.value || undefined)}><option value="">Nothing</option>{state.programmes.filter((x) => x.id !== p.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="When they finish, move them to"><select className={inputCls} value={p.stageOnComplete ?? ""} onChange={(e) => set("stageOnComplete", (e.target.value || undefined) as Programme["stageOnComplete"])}><option value="">Leave their stage as it is</option>{STAGES_NOW().map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></Field>
      <Field label="Certificate signed by" hint="Separate with commas."><input className={inputCls} value={p.signatories.join(", ")} onChange={(e) => set("signatories", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></Field>
      <div><span className="mb-1.5 block text-sm font-medium">Colour</span>
        <div className="flex gap-2">{PROGRAMME_TINTS.map((t, i) => <button key={i} onClick={() => set("color", i)} aria-label={`Colour ${i + 1}`} className={cx("flex size-9 items-center justify-center rounded-full text-white", t.bar, p.color === i && "ring-4 ring-offset-2 ring-brand/30")}>{p.color === i && <Check size={15} />}</button>)}</div>
      </div>
      <Button variant="primary" className="w-full py-3" disabled={!p.name.trim() || !mods.trim()} onClick={() => {
        const titles = mods.split("\n").map((x) => x.trim()).filter(Boolean);
        const modules = titles.map((t, i) => p.modules.find((m) => m.title === t) ?? { id: `${p.id}-m${i + 1}-${Date.now() % 1e4}`, title: t });
        onSave({ ...p, modules, completeAfter: Math.min(p.completeAfter, modules.length) });
      }}>Save</Button>
    </div>
  );
}
