"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, Pencil, UserRound } from "lucide-react";
import { cx, inputCls } from "./ui";
import { DEFAULT_PROBATION, type Journey, type JourneyStage } from "@/lib/journey";

/** The answers to the three questions, in plain words. */
export type Answers = { classForMember?: boolean; memberFromStart?: boolean; classToServe?: boolean; leaderConfirms?: boolean };

/** Read the answers back from a journey the church already has. */
export function answersFrom(j: Journey): Answers {
  const st = j.stages;
  const member = st.find((s) => s.kind === "member");
  const worker = st.find((s) => s.kind === "worker");
  const classForMember = !!member && (member.rule === "class" || member.rule === "class_confirm") && st.indexOf(member) > 0 && st.slice(0, st.indexOf(member)).every((s) => s.kind === "visitor");
  const memberFromStart = !classForMember && st[0]?.kind === "member";
  return {
    classForMember,
    memberFromStart: classForMember ? undefined : memberFromStart,
    classToServe: worker ? worker.rule === "class" || worker.rule === "class_confirm" : undefined,
    leaderConfirms: worker?.rule === "class_confirm",
  };
}

/** Build the journey from the answers, keeping the names and class links the church already chose. */
export function buildJourney(a: Answers, base?: Journey): Journey {
  const old = new Map((base?.stages ?? []).map((s) => [s.key, s]));
  const keep = (s: JourneyStage): JourneyStage => { const o = old.get(s.key); return o ? { ...s, name: o.name, classId: s.rule === "class" || s.rule === "class_confirm" || s.rule === "enrolled" ? o.classId ?? s.classId : undefined } : s; };
  const stages: JourneyStage[] = [];
  if (a.classForMember) {
    stages.push(
      { key: "first_timer", name: "First-timer", kind: "visitor", rule: "added" },
      { key: "returning", name: "Returning", kind: "visitor", rule: "returned" },
      { key: "discipleship", name: "In class", kind: "visitor", rule: "enrolled" },
      { key: "member", name: "Member", kind: "member", rule: "class" },
    );
  } else if (a.memberFromStart) {
    stages.push({ key: "member", name: "Member", kind: "member", rule: "added" });
  } else {
    stages.push({ key: "first_timer", name: "Visitor", kind: "visitor", rule: "added" }, { key: "member", name: "Member", kind: "member", rule: "returned" });
  }
  stages.push(a.classToServe
    ? { key: "worker", name: "Worker", kind: "worker", rule: a.leaderConfirms ? "class_confirm" : "class" }
    : { key: "worker", name: "Worker", kind: "worker", rule: "manual" });
  stages.push({ key: "leader", name: "Leader", kind: "leader", rule: "manual" });
  return { stages: stages.map(keep), probation: base?.probation ?? { ...DEFAULT_PROBATION } };
}

/** The story of one person going through the journey, so the choice is easy to check. */
function story(j: Journey) {
  const name = (k: string) => j.stages.find((s) => s.kind === k)?.name.toLowerCase() ?? k;
  const out: string[] = [];
  const st = j.stages;
  if (st[0].kind === "member") out.push(`Ada is a ${name("member")} from her first Sunday.`);
  else if (st.find((s) => s.kind === "member")?.rule === "returned") out.push(`Ada visits, keeps coming back, and is counted as a ${name("member")}.`);
  else out.push(`Ada visits on Sunday. Once she finishes the membership class, she becomes a ${name("member")}.`);
  const w = st.find((s) => s.kind === "worker");
  if (w?.rule === "manual") out.push(`When she joins a department, she becomes a ${name("worker")}.`);
  else out.push(`She takes the workers' class${w?.rule === "class_confirm" ? ", a leader confirms her," : ""} and serves as a ${name("worker")}.`);
  out.push(`A pastor can make her a ${name("leader")}.`);
  return out.join(" ");
}

/**
 * Up to three yes/no questions. The church's path draws itself as they answer,
 * with a short story to check it, and a Rename link on each step.
 */
export function JourneyBuilder({ value, onChange }: { value: Journey; onChange: (j: Journey) => void }) {
  const [a, setA] = useState<Answers>(() => answersFrom(value));
  const [renaming, setRenaming] = useState<string | null>(null);
  const answer = (patch: Answers) => { const n = { ...a, ...patch }; setA(n); onChange(buildJourney(n, value)); };
  const q = (k: keyof Answers, text: string) => (
    <div key={k} className="rise flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <p className="min-w-[12rem] flex-1 text-[15px] font-medium">{text}</p>
      <div className="flex gap-2">
        {([true, false] as const).map((v) => (
          <button type="button" key={String(v)} onClick={() => answer(k === "classForMember" ? { classForMember: v, memberFromStart: undefined } : k === "classToServe" ? { classToServe: v, leaderConfirms: v ? a.leaderConfirms : undefined } : { [k]: v })}
            className={cx("min-h-11 min-w-[72px] rounded-xl px-4 text-sm font-medium ring-1 transition", a[k] === v ? "bg-deep text-white ring-deep" : "bg-page ring-line hover:ring-ink/25")}>{v ? "Yes" : "No"}</button>
        ))}
      </div>
    </div>
  );
  const memberDone = a.classForMember === true || a.memberFromStart !== undefined;
  return (
    <div className="space-y-3">
      {q("classForMember", "Do people need to finish a class before you call them members?")}
      {a.classForMember === false && q("memberFromStart", "Are people members from their very first visit?")}
      {memberDone && q("classToServe", "Do people take a class before they can serve in a department?")}
      {a.classToServe && q("leaderConfirms", "After that class, should a leader confirm them before they serve?")}

      {memberDone && (
        <div className="rounded-2xl bg-brand-soft/50 p-4 ring-1 ring-brand/15">
          <p className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Your church&apos;s journey</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {value.stages.map((s, i) => (
              <span key={s.key} className="flex items-center gap-1.5">
                {i > 0 && <ArrowRight size={14} className="text-muted" />}
                {(s.rule === "class" || s.rule === "class_confirm") && <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[12.5px] text-brand ring-1 ring-brand/20"><BookOpen size={12} /> {s.kind === "worker" ? "Workers' class" : "Membership class"}{s.rule === "class_confirm" ? " + leader confirms" : ""}</span>}
                {(s.rule === "class" || s.rule === "class_confirm") && <ArrowRight size={14} className="text-muted" />}
                {renaming === s.key ? (
                  <input autoFocus className={cx(inputCls, "w-40 py-1.5")} defaultValue={s.name} onBlur={(e) => { const n = e.target.value.trim(); if (n) onChange({ ...value, stages: value.stages.map((x) => (x.key === s.key ? { ...x, name: n } : x)) }); setRenaming(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} aria-label={`New name for ${s.name}`} />
                ) : (
                  <button type="button" onClick={() => setRenaming(s.key)} className="group inline-flex min-h-9 items-center gap-1.5 rounded-full bg-deep px-3 text-[13.5px] font-medium text-white" title="Rename">
                    {s.name}<Pencil size={11} className="opacity-60 group-hover:opacity-100" />
                  </button>
                )}
              </span>
            ))}
          </div>
          <p className="mt-3 flex gap-2 text-[14px] leading-relaxed text-ink-soft"><UserRound size={16} className="mt-0.5 shrink-0 text-brand" />{story(value)}</p>
          <p className="mt-2 text-[12.5px] text-muted">Tap a step to rename it, for example “Covenant member”.</p>
        </div>
      )}
    </div>
  );
}
