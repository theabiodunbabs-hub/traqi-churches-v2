"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Person, Stage } from "@/lib/types";
import { STAGES_NOW, initials, stageIndex, stageInfo } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

export function Avatar({ person, size = 40 }: { person?: Person; size?: number }) {
  const info = person ? stageInfo(person.stage) : null;
  if (person?.photo) {
    return <img src={person.photo} alt="" aria-hidden className="inline-block shrink-0 rounded-full object-cover ring-1 ring-ink/5" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold", info?.tone ?? "bg-line", info?.text ?? "text-muted")}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(person)}
    </span>
  );
}

export function StageChip({ stage }: { stage: Stage }) {
  const s = stageInfo(stage);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-soft ring-1 ring-line">
      <span className={cx("size-2 rounded-full", s.tone)} />
      {s.label}
    </span>
  );
}

/** The signature element: the person's journey, deepening in colour as they grow. */
export function JourneyTrack({ stage, compact }: { stage: Stage; compact?: boolean }) {
  const at = stageIndex(stage);
  return (
    <div>
      <div className="flex gap-1" role="img" aria-label={`Journey stage: ${stageInfo(stage).label}`}>
        {STAGES_NOW().map((s, i) => (
          <span key={s.key} className={cx("h-2 flex-1 rounded-full transition-colors", i <= at ? s.tone : "bg-line/70", i === at && "ring-2 ring-surface ring-offset-0 outline outline-2 outline-brand/30")} />
        ))}
      </div>
      {!compact && (
        <>
          <div className="mt-2 hidden text-[11px] text-muted sm:flex">
            {STAGES_NOW().map((s, i) => (
              <span key={s.key} className={cx("flex-1", i === at && "font-semibold text-ink")}>{s.label}</span>
            ))}
          </div>
          <p className="mt-2 flex justify-between text-[12px] text-muted sm:hidden">
            <span>Stage {at + 1} of {STAGES_NOW().length}: <span className="font-semibold text-ink">{STAGES_NOW()[at].label}</span></span>
            {at < STAGES_NOW().length - 1 && <span>Next: {STAGES_NOW()[at + 1].label}</span>}
          </p>
        </>
      )}
    </div>
  );
}

export function Button({ variant = "secondary", className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "light" }) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition active:scale-[.98] disabled:opacity-50",
        variant === "primary" && "bg-brand text-white hover:bg-brand-hover shadow-sm shadow-brand/20",
        variant === "secondary" && "bg-surface text-ink ring-1 ring-line shadow-[0_1px_2px_rgb(30_27_75/.05)] hover:ring-ink/20",
        variant === "ghost" && "text-ink-soft hover:bg-ink/5",
        variant === "light" && "bg-white text-[#15141c] shadow-sm hover:bg-white/90",
        className,
      )}
    />
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("card p-5 md:p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-[17px] font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight md:text-[32px]">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-ink-soft">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/**
 * A side panel on wide screens, a full-height sheet on phones.
 * It renders into <body> so nothing on the page can clip it, sizes to the visible screen
 * (so the phone's browser bar never hides the buttons), and can pin actions to the bottom.
 */
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[55] flex h-[100dvh] justify-end" role="dialog" aria-modal aria-label={title}>
      <button aria-label="Close" className="fade absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx("sheet relative flex h-[100dvh] w-full flex-col bg-surface shadow-2xl", wide ? "max-w-xl" : "max-w-md")}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-ink/5" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
        {footer && <div className="border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** A label for a group of buttons (not a <label>, so taps on the buttons inside always land). */
export function FieldGroup({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div role="group" aria-label={label}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-xl bg-page px-3.5 py-2.5 text-[15px] ring-1 ring-line outline-none transition placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-brand";

export function Empty({ title, body, action, icon }: { title: string; body: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card dots flex flex-col items-center px-6 py-14 text-center">
      <Illustration>{icon}</Illustration>
      <p className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[15px] text-ink-soft">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A soft, friendly spot illustration: overlapping journey circles around an icon. */
export function Illustration({ children }: { children?: ReactNode }) {
  return (
    <div className="relative size-28" aria-hidden>
      <span className="absolute left-1 top-6 size-16 rounded-full bg-j1" />
      <span className="absolute right-0 top-1 size-12 rounded-full bg-glow-soft ring-4 ring-surface" />
      <span className="absolute bottom-0 right-5 size-20 rounded-full bg-j2/70" />
      <span className="absolute inset-0 m-auto flex size-14 items-center justify-center rounded-2xl bg-surface text-brand shadow-lg shadow-brand/15 ring-1 ring-line">{children}</span>
    </div>
  );
}

export function PersonLink({ person, sub, size = 40 }: { person?: Person; sub?: ReactNode; size?: number }) {
  if (!person) return <span className="text-muted">Unassigned</span>;
  return (
    <Link href={`/people/${person.id}`} className="group flex min-w-0 items-center gap-3">
      <Avatar person={person} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium group-hover:text-brand">{person.firstName} {person.lastName}</span>
        {sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}
      </span>
    </Link>
  );
}

/** Big number with a label, used across dashboards. */
export function Stat({ n, label, sub, tone, icon }: { n: ReactNode; label: string; sub?: ReactNode; tone?: "alert" | "glow" | "good" | "brand"; icon?: ReactNode }) {
  const t = { alert: "text-alert", glow: "text-glow-ink", good: "text-good", brand: "text-brand" };
  return (
    <div className="card p-4 md:p-5">
      <div className="flex items-start justify-between">
        <p className={cx("num text-[30px] font-semibold leading-none md:text-[34px]", tone && t[tone])}>{n}</p>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <p className="mt-2 text-[13.5px] text-ink-soft">{label}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

/** Segmented tabs. */
export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { key: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={cx("inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface p-1 ring-1 ring-line scrollbar-thin", className)}>
      {items.map((i) => (
        <button key={i.key} role="tab" aria-selected={value === i.key} onClick={() => onChange(i.key)}
          className={cx("flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition", value === i.key ? "bg-deep font-medium text-white shadow-sm" : "text-ink-soft hover:bg-page hover:text-ink")}>
          {i.label}
          {i.count !== undefined && <span className={cx("rounded-full px-1.5 text-[11px]", value === i.key ? "bg-white/20" : "bg-page text-muted")}>{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-brand" : "bg-line", disabled && "cursor-not-allowed opacity-60")}>
      <span className={cx("absolute top-0.5 size-5 rounded-full bg-surface shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "good" | "glow" | "alert" | "dark" }) {
  const t = {
    neutral: "bg-page text-ink-soft ring-1 ring-line", brand: "bg-brand-soft text-brand", good: "bg-good-soft text-good",
    glow: "bg-glow-soft text-glow-ink", alert: "bg-alert-soft text-alert", dark: "bg-deep text-white",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium", t[tone])}>{children}</span>;
}

/** Counts up to a number once, for a little life on dashboards. */
export function CountUp({ to, format = (n: number) => n.toLocaleString("en-NG") }: { to: number; format?: (n: number) => string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setN(to); return; }
    let raf = 0; const start = performance.now(); const dur = 700;
    const tick = (t: number) => { const k = Math.min(1, (t - start) / dur); setN(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{format(n)}</>;
}

export function ProgressRing({ value, size = 44, stroke = 5, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e6e5f0" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} className="text-brand transition-all duration-700" />
      </svg>
      <span className="absolute text-[11px] font-semibold">{children}</span>
    </span>
  );
}

/** A burst of confetti for milestones: a completed class, a new member, a placement. */
export function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  const colours = ["var(--color-brand)", "var(--color-j3)", "#f59e0b", "#0e9f6e", "#db2777", "#38bdf8"];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center">
      <div className="relative">
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2, d = 120 + (i % 5) * 40;
          return <span key={i} className="confetti" style={{ background: colours[i % colours.length], ["--x" as string]: `${Math.cos(a) * d}px`, ["--y" as string]: `${Math.sin(a) * d + 80}px`, ["--r" as string]: `${i * 47}deg` }} />;
        })}
      </div>
    </div>
  );
}

// ---------- Toasts: a clear "done" after important actions, with undo ----------
type ToastItem = { id: number; text: string; undo?: () => void; tone?: "good" | "dark" };
let toasts: ToastItem[] = [];
const listeners = new Set<(t: ToastItem[]) => void>();
let tid = 0;
export function toast(text: string, opts: { undo?: () => void; tone?: "good" | "dark" } = {}) {
  const t = { id: ++tid, text, ...opts };
  toasts = [...toasts.slice(-2), t];
  listeners.forEach((l) => l(toasts));
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); listeners.forEach((l) => l(toasts)); }, opts.undo ? 6500 : 3500);
}
export function Toasts() {
  const [list, setList] = useState<ToastItem[]>([]);
  const ref = useRef(setList);
  useEffect(() => { const l = (t: ToastItem[]) => ref.current(t); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[75] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {list.map((t) => (
        <div key={t.id} className="toast pointer-events-auto flex items-center gap-3 rounded-2xl bg-deep py-2.5 pl-4 pr-2 text-sm text-white shadow-2xl">
          <span className="size-2 rounded-full bg-[#7ee2b8]" />
          <span>{t.text}</span>
          {t.undo ? (
            <button onClick={() => { t.undo?.(); toasts = toasts.filter((x) => x.id !== t.id); listeners.forEach((l) => l(toasts)); }}
              className="rounded-xl bg-white/15 px-3 py-1.5 font-medium hover:bg-white/25">Undo</button>
          ) : <span className="w-2" />}
        </div>
      ))}
    </div>
  );
}

/** Two-line list row used across lists. */
export function Row({ left, title, sub, right, href, onClick }: { left?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      {left}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}
      </span>
      {right}
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-page";
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls.replace(" hover:bg-page", "")}>{inner}</div>;
}
