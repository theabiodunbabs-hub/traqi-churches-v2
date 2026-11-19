"use client";

import { useEffect, useState } from "react";

const LINES = ["Gathering your church", "Counting the faithful", "Setting out the chairs", "Warming up the choir", "Almost ready"];

/**
 * Shown while Traqi loads: three circles orbiting and gathering, like people coming together,
 * with a gentle line underneath that changes every couple of seconds.
 */
export function Preloader({ label }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => Math.min(x + 1, LINES.length - 1)), 1800); return () => clearInterval(t); }, []);
  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-page" role="status" aria-live="polite">
      <div className="relative size-28" aria-hidden>
        <span className="pl-ring absolute inset-0 rounded-full border-2 border-brand/15" />
        <span className="pl-ring absolute inset-4 rounded-full border-2 border-brand/25 [animation-delay:-.6s]" />
        {[0, 1, 2].map((k) => (
          <span key={k} className="pl-orbit absolute inset-0" style={{ animationDelay: `${-k * 0.55}s` }}>
            <span className="absolute left-1/2 top-0 size-4 -translate-x-1/2 rounded-full shadow-lg" style={{ background: ["var(--color-brand)", "var(--color-glow, #f59e0b)", "var(--color-deep)"][k] }} />
          </span>
        ))}
        <span className="pl-heart absolute inset-[38%] rounded-full bg-brand" />
      </div>
      <p className="mt-8 font-display text-[22px] font-semibold tracking-tight text-ink">Traqi</p>
      <p key={i} className="rise mt-1 text-[14.5px] text-ink-soft">{label ?? LINES[i]}…</p>
    </div>
  );
}
