"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Moon, Pipette, Sparkles, Sun, X } from "lucide-react";
import { Button, cx } from "./ui";
import { CHURCH_COLOURS, ChurchMark } from "./brand";
import { HEADING_FONTS, contrast, logoColours, readableBrand, themeVars, type HeadingStyle } from "@/lib/theme";
import { uploadImage } from "@/lib/upload";
import type { ChurchProfile } from "@/lib/types";

type Look = Pick<ChurchProfile, "logo" | "color" | "accent" | "heading">;

/**
 * Logo, colour, accent and heading style, with a live preview of the app in both themes.
 * Used in sign-up and in Church profile.
 */
export function BrandPicker({ name, value, onChange, compact }: { name: string; value: Look; onChange: (v: Look) => void; compact?: boolean }) {
  const file = useRef<HTMLInputElement>(null);
  const [fromLogo, setFromLogo] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const color = value.color ?? "#4f46e5";
  useEffect(() => { if (value.logo) logoColours(value.logo).then(setFromLogo).catch(() => setFromLogo([])); else setFromLogo([]); }, [value.logo]);
  const deepened = readableBrand(color) !== color.toLowerCase() && contrast(color, "#ffffff") < 4.5;

  return (
    <div className={cx("grid gap-6", !compact && "lg:grid-cols-[1fr_minmax(0,320px)]")}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-5">
          <ChurchMark church={{ name: name || "Your church", profile: value as ChurchProfile }} size={80} className="shadow-lg" />
          <div className="space-y-2">
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setBusy(true);
              try { onChange({ ...value, logo: await uploadImage(f, "logo", 512) }); } finally { setBusy(false); e.target.value = ""; }
            }} />
            <div className="flex gap-2">
              <Button onClick={() => file.current?.click()} disabled={busy}><ImagePlus size={15} /> {busy ? "Uploading…" : value.logo ? "Change logo" : "Upload logo"}</Button>
              {value.logo && <Button variant="ghost" onClick={() => onChange({ ...value, logo: undefined })}><X size={15} /> Remove</Button>}
            </div>
            <p className="text-[12.5px] text-muted">A square image works best. Without one, we use your initials.</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Church colour</p>
          {fromLogo.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] text-muted"><Sparkles size={13} className="text-brand" /> From your logo</p>
              <Swatches colours={fromLogo} value={color} onPick={(c) => onChange({ ...value, color: c })} />
            </div>
          )}
          <Swatches colours={CHURCH_COLOURS} value={color} onPick={(c) => onChange({ ...value, color: c })} />
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-page px-3 py-2 text-sm ring-1 ring-line hover:ring-brand/40">
            <Pipette size={15} className="text-muted" /> Any colour
            <input type="color" value={color} onChange={(e) => onChange({ ...value, color: e.target.value })} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Pick any colour" />
            <span className="font-mono text-[12px] text-muted">{color.toUpperCase()}</span>
          </label>
          {deepened && <p className="mt-2 text-[12.5px] text-muted">This colour is light, so Traqi uses a deeper shade of it for buttons and text, to keep them easy to read.</p>}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Accent colour <span className="font-normal text-muted">(optional)</span></p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => onChange({ ...value, accent: undefined })} className={cx("rounded-xl px-3 py-2 text-sm ring-1", !value.accent ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>Choose for me</button>
            {["#f59e0b", "#e11d48", "#0f766e", "#0ea5e9", "#a855f7", "#84cc16"].map((c) => (
              <button key={c} onClick={() => onChange({ ...value, accent: c })} aria-label={`Accent ${c}`} className={cx("flex size-9 items-center justify-center rounded-full text-white transition", value.accent === c && "ring-4 ring-offset-2 ring-offset-surface")} style={{ background: c, ["--tw-ring-color" as string]: `${c}66` }}>{value.accent === c && <Check size={14} />}</button>
            ))}
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">Used for highlights and celebrations.</p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Heading style</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(HEADING_FONTS) as HeadingStyle[]).map((k) => {
              const f = HEADING_FONTS[k]; const on = (value.heading ?? "modern") === k;
              return (
                <button key={k} onClick={() => onChange({ ...value, heading: k })} className={cx("rounded-2xl p-3 text-left ring-1 transition", on ? "bg-brand-soft ring-2 ring-brand" : "bg-page ring-line hover:ring-ink/20")}>
                  <span className="block text-[22px] leading-none" style={{ fontFamily: f.family, fontWeight: f.weight, letterSpacing: f.tracking }}>Aa</span>
                  <span className="mt-2 block text-[13px] font-semibold">{f.label}</span>
                  <span className="block text-[11.5px] text-muted">{f.sample}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <LivePreview name={name} look={value} />
    </div>
  );
}

function Swatches({ colours, value, onPick }: { colours: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">{colours.map((c) => (
      <button key={c} onClick={() => onPick(c)} aria-label={c} className={cx("flex size-10 items-center justify-center rounded-full text-white transition hover:scale-105", value.toLowerCase() === c.toLowerCase() && "scale-110 ring-4 ring-offset-2 ring-offset-surface")} style={{ background: c, ["--tw-ring-color" as string]: `${c}66` }}>
        {value.toLowerCase() === c.toLowerCase() && <Check size={16} />}
      </button>
    ))}</div>
  );
}

/** A small, real-looking slice of the app, painted with the chosen look. */
export function LivePreview({ name, look }: { name: string; look: Look }) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const vars = useMemo(() => themeVars(look.color ?? "#4f46e5", look.accent, mode), [look.color, look.accent, mode]);
  const f = HEADING_FONTS[look.heading ?? "modern"];
  const font = { fontFamily: f.family, fontWeight: f.weight, letterSpacing: f.tracking };
  return (
    <div className="lg:sticky lg:top-6 lg:self-start">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Live preview</p>
        <div className="flex rounded-lg bg-page p-0.5 ring-1 ring-line">
          {(["light", "dark"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} aria-label={`${m} theme`} className={cx("flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px]", mode === m ? "bg-surface font-medium text-ink shadow-sm" : "text-muted")}>
              {m === "light" ? <Sun size={12} /> : <Moon size={12} />}{m === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </div>
      <div style={vars as React.CSSProperties} className="overflow-hidden rounded-3xl ring-1 ring-line shadow-xl">
        <div className="flex" style={{ background: "var(--color-page)", color: "var(--color-ink)" }}>
          <div className="side w-[92px] shrink-0 space-y-2 p-2.5">
            <ChurchMark church={{ name: name || "Church", profile: look as ChurchProfile }} size={30} />
            {["People", "Events", "Classes", "Offerings"].map((x, i) => (
              <div key={x} className={cx("rounded-lg px-2 py-1.5 text-[10px]", i === 0 ? "bg-white/[.12] font-semibold text-white" : "text-white/60")}>{i === 0 && <span className="mr-1 inline-block size-1.5 rounded-full" style={{ background: "var(--color-accent)" }} />}{x}</div>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-2.5 p-3">
            <div className="hero rounded-2xl p-3">
              <p className="text-[9.5px] text-white/60">Good morning</p>
              <p className="text-[15px] leading-tight text-white" style={font}>{name || "Your church"}</p>
              <p className="mt-1 text-[9.5px] text-white/70">287 people last Sunday</p>
            </div>
            <div className="rounded-2xl p-2.5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}>
              <p className="text-[12px]" style={font}>First-timers</p>
              <div className="mt-1.5 h-1.5 rounded-full" style={{ background: "var(--color-brand-soft)" }}><div className="h-full w-2/3 rounded-full" style={{ background: "var(--color-brand)" }} /></div>
              <p className="mt-1.5 text-[9.5px]" style={{ color: "var(--color-muted)" }}>12 of 18 reached in 48 hours</p>
            </div>
            <div className="flex gap-1.5">
              <span className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold text-white" style={{ background: "var(--color-brand)" }}>Check in</span>
              <span className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-medium" style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}>Register</span>
              <span className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-medium" style={{ background: "var(--color-glow-soft)", color: "var(--color-glow-ink)" }}>Waiting</span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-muted">Everyone in your church sees Traqi in these colours. Each person can still choose light or dark.</p>
    </div>
  );
}
