"use client";

import { useEffect, useRef, useState } from "react";
import { Cake, ChevronLeft, ChevronRight, X } from "lucide-react";
import { MONTH_NAMES, birthdayISO, birthdayParts, dayMonth, daysInMonth } from "@/lib/format";
import { cx, inputCls } from "./ui";

const APP = { field: inputCls, muted: "text-muted", pop: "bg-surface ring-line", on: "bg-brand font-semibold text-white", hover: "hover:bg-brand-soft hover:text-brand" };
const EV = {
  field: "w-full rounded-xl bg-[var(--ev-page)] px-3.5 py-3 text-[15.5px] text-[var(--ev-fg)] ring-1 ring-[var(--ev-line)] outline-none focus:ring-2 focus:ring-[var(--ev-accent)]",
  muted: "text-[var(--ev-muted)]", pop: "bg-[var(--ev-card)] text-[var(--ev-fg)] ring-[var(--ev-line)]",
  on: "bg-[var(--ev-accent)] font-semibold text-white", hover: "hover:bg-[color-mix(in_oklab,var(--ev-accent)_12%,transparent)]",
};

/**
 * A birthday calendar with only the day and the month: no year to scroll through or give away.
 * Staff may add the year (for children, say) when `withYear` is on.
 * The value is the YYYY-MM-DD the database keeps (see birthdayISO); "" when not chosen.
 */
export function BirthdayPicker({ value, onChange, withYear, invalid, id, event }: { value?: string; onChange: (v: string) => void; withYear?: boolean; invalid?: boolean; id?: string;
  /** On a public event page: the event's own colours. */ event?: boolean }) {
  const t = event ? EV : APP;
  const cur = birthdayParts(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(cur?.month ?? new Date().getMonth() + 1);
  const box = useRef<HTMLDivElement>(null);
  // The year box keeps what's typed until it's four digits
  const [yr, setYr] = useState(cur?.year ? String(cur.year) : "");
  useEffect(() => { const y = birthdayParts(value)?.year; if (y) setYr(String(y)); else if (!value) setYr(""); }, [value]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("touchstart", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const show = () => { setMonth(cur?.month ?? new Date().getMonth() + 1); setOpen((o) => !o); };
  const step = (d: number) => setMonth((m) => ((m - 1 + d + 12) % 12) + 1);
  const pick = (day: number) => { onChange(birthdayISO(day, month, cur?.year)); setOpen(false); };

  return (
    <div ref={box} className="relative">
      <div className={cx("flex gap-2", withYear && "items-stretch")}>
        <button type="button" id={id} onClick={show} aria-haspopup="dialog" aria-expanded={open}
          className={cx(t.field, "flex min-h-11 flex-1 items-center gap-2 text-left", invalid && "ring-2 ring-alert")}>
          <Cake size={16} className={cx("shrink-0", t.muted)} />
          {cur ? <span><span className="num font-medium">{dayMonth(value)}</span><span className={t.muted}> · {cur.day} {MONTH_NAMES[cur.month - 1]}</span></span>
            : <span className={t.muted}>DD-MM</span>}
        </button>
        {withYear && (
          <input className={cx(inputCls, "w-24")} inputMode="numeric" maxLength={4} placeholder="Year" aria-label="Year (optional)"
            value={yr} disabled={!cur}
            onChange={(e) => { const t = e.target.value.replace(/\D/g, "").slice(0, 4); setYr(t); if (cur && (t.length === 4 || !t)) onChange(birthdayISO(cur.day, cur.month, t ? Number(t) : undefined)); }} />
        )}
        {cur && <button type="button" onClick={() => onChange("")} className="rounded-xl px-2 text-muted hover:bg-page" aria-label="Clear birthday"><X size={16} /></button>}
      </div>

      {open && (
        <div role="dialog" aria-label="Choose the day and month" className={cx("absolute left-0 z-30 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl p-3 shadow-xl ring-1", t.pop)}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => step(-1)} className="rounded-lg p-2 text-muted hover:bg-page" aria-label="Previous month"><ChevronLeft size={18} /></button>
            <select className="rounded-lg bg-transparent px-2 py-1 text-center font-display text-[16px] font-semibold outline-none" value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month">
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <button type="button" onClick={() => step(1)} className="rounded-lg p-2 text-muted hover:bg-page" aria-label="Next month"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map((d) => {
              const on = cur?.day === d && cur?.month === month;
              return (
                <button key={d} type="button" onClick={() => pick(d)} aria-pressed={on} aria-label={`${d} ${MONTH_NAMES[month - 1]}`}
                  className={cx("num flex aspect-square items-center justify-center rounded-lg text-[14px]", on ? t.on : t.hover)}>{d}</button>
              );
            })}
          </div>
          <p className={cx("mt-2 text-center text-[12px]", t.muted)}>Day and month only{withYear ? ". Add the year beside it if you know it." : ". No year needed."}</p>
        </div>
      )}
    </div>
  );
}
