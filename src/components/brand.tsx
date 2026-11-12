"use client";

import type { Church } from "@/lib/types";
import { cx } from "./ui";

/**
 * The Traqi mark: three steps rising, each one larger and brighter.
 * It's the journey from first visit to leadership that the whole product follows.
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role="img" aria-label="Traqi">
      <defs>
        <linearGradient id="tq-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#2e2a8f" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#tq-bg)" />
      <path d="M10.5 28.5 Q 17 27.5 19.5 21 T 29 11.5" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10.5" cy="28.5" r="2.6" fill="#c9c4ff" />
      <circle cx="19.5" cy="21" r="3.3" fill="#e6e4ff" />
      <circle cx="29" cy="11.5" r="4.1" fill="#fbbf24" />
    </svg>
  );
}

export function Wordmark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cx("inline-flex items-baseline font-display text-[22px] font-semibold tracking-tight", light ? "text-white" : "text-ink", className)}>
      traq<span className="relative">ı<span className="absolute left-1/2 top-[0.12em] size-[0.2em] -translate-x-1/2 rounded-full bg-glow" /></span>
    </span>
  );
}

export function Logo({ light, small }: { light?: boolean; small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={small ? 28 : 36} />
      <span className="leading-none">
        <Wordmark light={light} className={small ? "text-[19px]" : undefined} />
        <span className={cx("block text-[11px] font-medium tracking-wide", light ? "text-white/60" : "text-muted")}>for churches</span>
      </span>
    </span>
  );
}

/** The church's own mark: its uploaded logo, or its initials in its colour. */
export function ChurchMark({ church, size = 36, className }: { church: Pick<Church, "name" | "profile">; size?: number; className?: string }) {
  const color = church.profile?.color ?? "#4f46e5";
  if (church.profile?.logo) {
    return <img src={church.profile.logo} alt="" width={size} height={size} className={cx("shrink-0 rounded-xl bg-surface object-contain", className)} style={{ width: size, height: size }} />;
  }
  const letters = church.name.split(/\s+/).filter((w) => !/^(the|of|and)$/i.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "C";
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-xl font-display font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${color}, ${shade(color, -0.35)})` }} aria-hidden>
      {letters}
    </span>
  );
}

/** Darken (negative) or lighten (positive) a hex colour. */
export function shade(hex: string, amt: number) {
  const n = hex.replace("#", "");
  const v = parseInt(n.length === 3 ? n.split("").map((x) => x + x).join("") : n, 16);
  const f = (c: number) => Math.round(Math.min(255, Math.max(0, amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f((v >> 16) & 255), g = f((v >> 8) & 255), b = f(v & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Brand colours a church can choose from: all pass contrast with white text. */
export const CHURCH_COLOURS = ["#4f46e5", "#7c3aed", "#be185d", "#b91c1c", "#c2410c", "#a16207", "#15803d", "#0f766e", "#0369a1", "#1e3a8a", "#334155", "#111827"];

/** Event cover artwork: soft gradients that look good with any title. */
export const COVERS = [
  "linear-gradient(135deg, #312e81 0%, #4f46e5 45%, #f59e0b 120%)",
  "linear-gradient(135deg, #831843 0%, #db2777 55%, #fbbf24 130%)",
  "linear-gradient(135deg, #064e3b 0%, #0f766e 50%, #a3e635 130%)",
  "linear-gradient(135deg, #0c4a6e 0%, #0284c7 55%, #a5f3fc 130%)",
  "linear-gradient(135deg, #1f2937 0%, #4b5563 50%, #fcd34d 130%)",
  "linear-gradient(135deg, #7c2d12 0%, #ea580c 55%, #fde68a 130%)",
];
