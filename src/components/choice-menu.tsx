"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
/** The event page's colours, carried into the menu (it opens outside the page, above everything). */
const THEME_VARS = ["--ev-page", "--ev-card", "--ev-fg", "--ev-muted", "--ev-line", "--ev-accent", "--ev-heading"];

/**
 * A modern dropdown for one choice, e.g. T-shirt size, on event pages.
 * Desktop: a menu under the field. Phone: a sheet that slides up from the bottom, with big rows to tap.
 * Keyboard: arrows move, Enter or Space picks, Escape closes, typing a letter jumps to it.
 */
export function ChoiceMenu({ label, options, value, onChange, placeholder = "Choose one" }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const [vars, setVars] = useState<CSSProperties>({});
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const room = window.innerHeight - r.bottom;
    setPos({ left: r.left, width: r.width, top: room < 280 && r.top > room ? r.top : r.bottom, up: room < 280 && r.top > room });
  };
  const show = () => {
    if (!btn.current) return;
    const cs = getComputedStyle(btn.current);
    setVars(Object.fromEntries(THEME_VARS.map((k) => [k, cs.getPropertyValue(k)])) as CSSProperties);
    setSheet(window.matchMedia("(max-width: 639px)").matches);
    setActive(Math.max(0, options.indexOf(value)));
    place();
    setOpen(true);
  };
  const close = (focus = true) => { setOpen(false); if (focus) btn.current?.focus(); };
  const pick = (o: string) => { onChange(o); close(); };

  useLayoutEffect(() => { if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [open, active]);
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const away = (e: Event) => { const t = e.target as Node; if (!list.current?.parentElement?.contains(t) && !btn.current?.contains(t)) close(false); };
    const move = () => { if (!sheet) place(); };
    document.addEventListener("mousedown", away); document.addEventListener("touchstart", away);
    window.addEventListener("resize", move); window.addEventListener("scroll", move, true);
    const lock = sheet ? document.body.style.overflow : null; if (sheet) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away);
      window.removeEventListener("resize", move); window.removeEventListener("scroll", move, true);
      if (lock !== null) document.body.style.overflow = lock;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheet]);

  const keys = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (options[active]) pick(options[active]); }
    else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); close(); }
    else if (e.key.length === 1) { const i = options.findIndex((o) => o.toLowerCase().startsWith(e.key.toLowerCase())); if (i >= 0) setActive(i); }
  };

  const rows = (
    <ul ref={list} id={id} role="listbox" aria-label={label} tabIndex={-1} onKeyDown={keys} aria-activedescendant={`${id}-${active}`}
      className={cx("overflow-y-auto overscroll-contain outline-none", sheet ? "max-h-[60vh] px-3 pb-3" : "max-h-64 p-1.5")}>
      {options.map((o, i) => {
        const on = o === value;
        return (
          <li key={o} id={`${id}-${i}`} data-i={i} role="option" aria-selected={on} onMouseEnter={() => setActive(i)} onClick={() => pick(o)}
            className={cx("flex cursor-pointer items-center gap-3 rounded-xl px-3 transition-colors select-none", sheet ? "min-h-13 text-[16px]" : "min-h-10 text-[14.5px]", on && "font-semibold")}
            style={i === active || on ? { background: `color-mix(in oklab, var(--ev-accent) ${on ? 16 : 9}%, transparent)` } : undefined}>
            <span className="flex-1">{o}</span>
            <span className={cx("flex size-5 shrink-0 items-center justify-center rounded-full transition", on ? "bg-[var(--ev-accent)] text-white" : "ring-1 ring-[var(--ev-line)]")}>{on && <Check size={12} strokeWidth={3} />}</span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <button ref={btn} type="button" onClick={() => (open ? close() : show())} onKeyDown={(e) => { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); } }}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={value ? `${label}: ${value}` : label}
        className={cx("group flex w-full items-center gap-2 rounded-xl bg-[var(--ev-page)] px-3.5 py-3 text-left text-[15.5px] ring-1 outline-none transition",
          open ? "ring-2 ring-[var(--ev-accent)]" : "ring-[var(--ev-line)] hover:ring-[var(--ev-accent)]/60 focus-visible:ring-2 focus-visible:ring-[var(--ev-accent)]")}>
        {value
          ? <span className="flex-1 font-medium text-[var(--ev-fg)]">{value}</span>
          : <span className="flex-1 text-[var(--ev-muted)]">{placeholder}</span>}
        <ChevronDown size={18} className={cx("shrink-0 text-[var(--ev-muted)] transition-transform duration-200", open && "rotate-180 text-[var(--ev-accent)]")} />
      </button>

      {open && pos && createPortal(
        sheet ? (
          <div style={vars} className="fixed inset-0 z-[80] text-[var(--ev-fg)]">
            <button type="button" aria-label="Close" onClick={() => close()} className="absolute inset-0 bg-black/45 backdrop-blur-[2px] [animation:cm-fade_.18s_ease-out]" />
            <div role="dialog" aria-label={label} className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-[var(--ev-card)] pb-[max(env(safe-area-inset-bottom),12px)] shadow-2xl [animation:cm-up_.24s_cubic-bezier(.2,.8,.2,1)]">
              <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-[var(--ev-line)]" />
              <div className="flex items-center gap-2 px-5 pt-3 pb-2">
                <p className="flex-1 text-[17px] font-semibold">{label}</p>
                <button type="button" onClick={() => close()} className="flex size-9 items-center justify-center rounded-full ring-1 ring-[var(--ev-line)]" aria-label="Close"><X size={17} /></button>
              </div>
              {rows}
            </div>
          </div>
        ) : (
          <div style={{ ...vars, position: "fixed", left: pos.left, width: pos.width, top: pos.up ? undefined : pos.top + 6, bottom: pos.up ? window.innerHeight - pos.top + 6 : undefined }}
            className={cx("z-[80] overflow-hidden rounded-2xl bg-[var(--ev-card)] text-[var(--ev-fg)] shadow-[0_18px_50px_-12px_rgba(0,0,0,.35)] ring-1 ring-[var(--ev-line)]", pos.up ? "[animation:cm-drop-up_.16s_ease-out]" : "[animation:cm-drop_.16s_ease-out]")}>
            {rows}
          </div>
        ),
        document.body,
      )}
      <style>{`@keyframes cm-fade{from{opacity:0}}@keyframes cm-up{from{transform:translateY(100%)}}@keyframes cm-drop{from{opacity:0;transform:translateY(-6px) scale(.98)}}@keyframes cm-drop-up{from{opacity:0;transform:translateY(6px) scale(.98)}}@media (prefers-reduced-motion:reduce){[class*="cm-"]{animation:none!important}}`}</style>
    </>
  );
}
