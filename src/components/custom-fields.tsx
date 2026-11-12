"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button, Field, Toggle, cx, inputCls } from "./ui";
import type { CustomField, Person } from "@/lib/types";

const TYPES: { k: CustomField["type"]; label: string }[] = [
  { k: "text", label: "Text" }, { k: "date", label: "Date" }, { k: "choice", label: "Choice" }, { k: "yesno", label: "Yes / No" }, { k: "number", label: "Number" },
];
const IDEAS: Omit<CustomField, "id">[] = [
  { label: "Baptised (date)", type: "date" }, { label: "Marital status", type: "choice", options: ["Single", "Married", "Widowed", "Divorced"] },
  { label: "Home cell", type: "text" }, { label: "Spouse's name", type: "text" }, { label: "Preferred language", type: "choice", options: ["English", "Yoruba", "Igbo", "Hausa", "Pidgin"] },
  { label: "Holy Ghost baptism", type: "yesno" },
];
const nid = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** The church adds the details it needs about people. */
export function CustomFieldsEditor({ value, onChange }: { value: CustomField[]; onChange: (v: CustomField[]) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const set = (id: string, patch: Partial<CustomField>) => onChange(value.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) => { const n = [...value]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };
  const unused = IDEAS.filter((i) => !value.some((f) => f.label.toLowerCase() === i.label.toLowerCase()));
  return (
    <div>
      <p className="mb-4 text-[14px] text-ink-soft">Record what your church needs to know. These appear on each profile, in downloads, and, if you choose, on the welcome form.</p>
      {value.length > 0 && (
        <ul className="mb-4 space-y-2">
          {value.map((f, i) => (
            <li key={f.id} className={cx("rounded-2xl ring-1", open === f.id ? "bg-surface ring-brand/40" : "bg-page ring-line")}>
              <div className="flex items-center gap-2 p-3">
                <button onClick={() => setOpen(open === f.id ? null : f.id)} className="min-w-0 flex-1 text-left">
                  <span className={cx("block font-medium", f.hidden && "text-muted line-through")}>{f.label || "Untitled field"}</span>
                  <span className="text-[12px] text-muted">{TYPES.find((t) => t.k === f.type)?.label}{f.options?.length ? ` · ${f.options.join(", ")}` : ""}{f.onWelcome ? " · on the welcome form" : ""}</span>
                </button>
                <button disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg p-1.5 text-muted hover:bg-ink/5 disabled:opacity-30" aria-label="Move up"><ArrowUp size={15} /></button>
                <button disabled={i === value.length - 1} onClick={() => move(i, 1)} className="rounded-lg p-1.5 text-muted hover:bg-ink/5 disabled:opacity-30" aria-label="Move down"><ArrowDown size={15} /></button>
                <button onClick={() => set(f.id, { hidden: !f.hidden })} className="rounded-lg p-1.5 text-muted hover:bg-ink/5" aria-label={f.hidden ? "Show" : "Hide"} title={f.hidden ? "Hidden. Answers are kept." : "Hide without losing answers"}>{f.hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
              {open === f.id && (
                <div className="space-y-3 border-t border-line p-3">
                  <Field label="Name"><input className={inputCls} value={f.label} onChange={(e) => set(f.id, { label: e.target.value })} /></Field>
                  <div className="flex flex-wrap gap-1.5">{TYPES.map((t) => <button key={t.k} onClick={() => set(f.id, { type: t.k })} className={cx("rounded-full px-3 py-1.5 text-sm ring-1", f.type === t.k ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-surface ring-line")}>{t.label}</button>)}</div>
                  {f.type === "choice" && <Field label="Choices, one per line"><textarea className={cx(inputCls, "min-h-24")} value={(f.options ?? []).join("\n")} onChange={(e) => set(f.id, { options: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} /></Field>}
                  <label className="flex items-center justify-between rounded-xl bg-page p-3 text-sm ring-1 ring-line">Ask on the first-timer welcome form <Toggle label="On welcome form" on={!!f.onWelcome} onChange={(v) => set(f.id, { onWelcome: v })} /></label>
                  <Button variant="ghost" className="text-alert" onClick={() => { if (confirm(`Remove "${f.label}"? Answers already recorded stay in downloads until you delete them.`)) onChange(value.filter((x) => x.id !== f.id)); }}><Trash2 size={15} /> Remove field</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button onClick={() => { const f: CustomField = { id: nid(), label: "", type: "text" }; onChange([...value, f]); setOpen(f.id); }}><Plus size={15} /> Add a field</Button>
        {unused.slice(0, 4).map((i) => <button key={i.label} onClick={() => onChange([...value, { ...i, id: nid() }])} className="rounded-full bg-page px-3 py-1.5 text-[13px] ring-1 ring-line hover:ring-brand">+ {i.label}</button>)}
      </div>
    </div>
  );
}

/** One field's input, used when editing a person and on the welcome form. */
export function CustomFieldInput({ f, value, onChange }: { f: CustomField; value?: string; onChange: (v: string) => void }) {
  if (f.type === "choice") return <select className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)}><option value="">Choose</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</select>;
  if (f.type === "yesno") return <div className="grid grid-cols-2 gap-1.5">{["Yes", "No"].map((o) => <button type="button" key={o} onClick={() => onChange(value === o ? "" : o)} className={cx("rounded-xl py-2.5 text-sm ring-1", value === o ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{o}</button>)}</div>;
  return <input className={inputCls} type={f.type === "date" ? "date" : "text"} inputMode={f.type === "number" ? "numeric" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

/** How a recorded answer reads on a profile. */
export function customValue(f: CustomField, p: Person) {
  const v = p.custom?.[f.id];
  if (!v) return null;
  if (f.type === "date") { const d = new Date(`${v}T12:00:00Z`); return isNaN(+d) ? v : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
  return v;
}
