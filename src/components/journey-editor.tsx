"use client";

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { Field, Toggle, cx, inputCls } from "./ui";
import { KINDS, PRESETS, RULES, defaultJourney, type Journey, type JourneyPreset, type JourneyStage, type Probation } from "@/lib/journey";
import type { Programme } from "@/lib/types";

const RAMP = ["bg-j1", "bg-j2", "bg-j3", "bg-j4", "bg-j5", "bg-j6"];
const tone = (i: number, n: number) => RAMP[n <= 1 ? 5 : Math.round((i / (n - 1)) * 5)];

/**
 * Each church's journey: its stages in its own words, what moves people into each one, and optional probation.
 * `simple` (sign-up) shows the ready-made journeys and lets the church rename stages; the full editor is in Settings.
 */
export function JourneyEditor({ value, onChange, classes = [], simple }: { value: Journey; onChange: (j: Journey) => void; classes?: Programme[]; simple?: boolean }) {
  const stages = value.stages;
  const set = (i: number, patch: Partial<JourneyStage>) => onChange({ ...value, preset: undefined, stages: stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: -1 | 1) => { const n = [...stages]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange({ ...value, preset: undefined, stages: n }); };
  const prob = value.probation ?? defaultJourney().probation!;
  const setProb = (p: Partial<Probation>) => onChange({ ...value, probation: { ...prob, ...p } });

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(PRESETS) as JourneyPreset[]).map((k) => {
          const p = PRESETS[k]; const on = value.preset === k;
          return (
            <button key={k} type="button" onClick={() => onChange({ ...defaultJourney(k), probation: value.probation })}
              className={cx("rounded-2xl p-3.5 text-left ring-1 transition", on ? "bg-brand-soft ring-2 ring-brand" : "bg-surface ring-line hover:ring-ink/20")}>
              <span className="flex items-center justify-between"><b className="text-[14.5px] font-semibold">{p.name}</b>{on && <Check size={16} className="text-brand" />}</span>
              <span className="mt-1 block text-[12.5px] leading-snug text-ink-soft">{p.summary}</span>
              <span className="mt-2.5 flex gap-1">{p.stages.map((s, i) => <span key={s.key} className={cx("h-1.5 flex-1 rounded-full", tone(i, p.stages.length))} />)}</span>
            </button>
          );
        })}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{simple ? "Your stages (rename any of them)" : "Your stages, in order"}</p>
        <ol className="space-y-2">
          {stages.map((s, i) => (
            <li key={`${s.key}-${i}`} className="rounded-2xl bg-page p-3 ring-1 ring-line">
              <div className="flex items-center gap-2">
                <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold", tone(i, stages.length), i / Math.max(1, stages.length - 1) > 0.45 ? "text-white" : "text-on-light")}>{i + 1}</span>
                <input className={cx(inputCls, "py-2 font-medium")} value={s.name} onChange={(e) => set(i, { name: e.target.value })} aria-label={`Stage ${i + 1} name`} />
                {!simple && <>
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg p-1.5 text-muted hover:bg-ink/5 disabled:opacity-30" aria-label="Move up"><ArrowUp size={15} /></button>
                  <button type="button" disabled={i === stages.length - 1} onClick={() => move(i, 1)} className="rounded-lg p-1.5 text-muted hover:bg-ink/5 disabled:opacity-30" aria-label="Move down"><ArrowDown size={15} /></button>
                  <button type="button" disabled={stages.length <= 2} onClick={() => onChange({ ...value, preset: undefined, stages: stages.filter((_, j) => j !== i) })} className="rounded-lg p-1.5 text-muted hover:bg-alert-soft hover:text-alert disabled:opacity-30" aria-label="Remove stage"><Trash2 size={15} /></button>
                </>}
              </div>
              {simple ? (
                <p className="mt-1.5 pl-10 text-[12.5px] text-muted">{RULES.find((r) => r.k === s.rule)?.label}{s.classId ? ` (${classes.find((c) => c.id === s.classId)?.name ?? "a class you'll choose"})` : ""}</p>
              ) : (
                <div className="mt-2 grid gap-2 pl-10 sm:grid-cols-3">
                  <select className={cx(inputCls, "py-2 text-[13.5px]")} value={s.rule} onChange={(e) => set(i, { rule: e.target.value as JourneyStage["rule"] })} aria-label="What moves people here">
                    {RULES.map((r) => <option key={r.k} value={r.k}>{r.label}</option>)}
                  </select>
                  {RULES.find((r) => r.k === s.rule)?.needsClass
                    ? <select className={cx(inputCls, "py-2 text-[13.5px]")} value={s.classId ?? ""} onChange={(e) => set(i, { classId: e.target.value || undefined })} aria-label="Which class">
                        <option value="">Any class</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    : <span className="hidden sm:block" />}
                  <select className={cx(inputCls, "py-2 text-[13.5px]")} value={s.kind} onChange={(e) => set(i, { kind: e.target.value as JourneyStage["kind"] })} aria-label="Counts as">
                    {KINDS.map((k) => <option key={k.k} value={k.k}>Counts as {k.label.toLowerCase()}</option>)}
                  </select>
                </div>
              )}
            </li>
          ))}
        </ol>
        {!simple && (
          <button type="button" onClick={() => onChange({ ...value, preset: undefined, stages: [...stages, { key: `s${Date.now().toString(36)}`, name: "New stage", kind: "leader", rule: "manual" }] })}
            className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand"><Plus size={15} /> Add a stage</button>
        )}
      </div>

      {!simple && (
        <div className="rounded-2xl p-4 ring-1 ring-line">
          <label className="flex items-center justify-between gap-3">
            <span><b className="block text-[14.5px] font-semibold">Serving on probation</b><span className="text-[13px] text-ink-soft">Let people serve before finishing the class, while they complete it.</span></span>
            <Toggle label="Probation" on={prob.enabled} onChange={(v) => setProb({ enabled: v })} />
          </label>
          {prob.enabled && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <Field label="How long probation lasts">
                <div className="flex flex-wrap gap-1.5">{[1, 2, 3, 6, 12].map((m) => <button key={m} type="button" onClick={() => setProb({ months: m })} className={cx("rounded-xl px-3 py-2 text-sm ring-1", prob.months === m ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{m} month{m > 1 ? "s" : ""}</button>)}</div>
              </Field>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line">Every new worker starts on probation, even after the class<Toggle label="Every new worker" on={!!prob.everyNewWorker} onChange={(v) => setProb({ everyNewWorker: v })} /></label>
              <Field label="Waits until they're confirmed">
                <div className="flex flex-wrap gap-1.5">
                  {([["head", "Being a department head"], ["assistant", "Being an assistant"], ["count", "Counting offerings"]] as const).map(([k, l]) => {
                    const on = prob.holdBack.includes(k);
                    return <button key={k} type="button" onClick={() => setProb({ holdBack: on ? prob.holdBack.filter((x) => x !== k) : [...prob.holdBack, k] })} className={cx("rounded-full px-3 py-1.5 text-[13px] ring-1", on ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}>{on && "✓ "}{l}</button>;
                  })}
                </div>
              </Field>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
