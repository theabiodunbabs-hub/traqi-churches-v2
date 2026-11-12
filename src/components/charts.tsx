"use client";

import { useState } from "react";
import { cx } from "./ui";

/** Stacked columns with a hover readout. Values in the same order as `keys`. */
export function StackedBars({ data, keys, colors, labels, height = 180, format = (n: number) => n.toLocaleString("en-NG") }: {
  data: { label: string; values: number[] }[]; keys: string[]; colors: string[]; labels?: string[]; height?: number; format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.values.reduce((a, b) => a + b, 0)));
  const show = hover ?? data.length - 1;
  const cur = data[show];
  return (
    <div>
      {cur && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="num text-[26px] font-semibold">{format(cur.values.reduce((a, b) => a + b, 0))}</span>
          <span className="text-sm text-muted">{cur.label}</span>
          <span className="flex flex-wrap gap-3 text-[12.5px] text-ink-soft">
            {keys.map((k, i) => <span key={k} className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: colors[i] }} />{labels?.[i] ?? k} {format(cur.values[i])}</span>)}
          </span>
        </div>
      )}
      <div className="flex items-end gap-1.5 md:gap-2.5" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const total = d.values.reduce((a, b) => a + b, 0);
          return (
            <button key={d.label} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)}
              aria-label={`${d.label}: ${format(total)}`}
              className="group flex h-full flex-1 flex-col justify-end">
              <span className={cx("flex w-full flex-col-reverse overflow-hidden rounded-t-[10px] rounded-b-[4px] transition-all duration-500", show === i ? "opacity-100" : "opacity-55 group-hover:opacity-80")}
                style={{ height: `${(total / max) * 100}%` }}>
                {d.values.map((v, j) => <span key={j} style={{ height: `${(v / Math.max(total, 1)) * 100}%`, background: colors[j] }} />)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 md:gap-2.5">
        {data.map((d, i) => <span key={d.label} className={cx("flex-1 truncate text-center text-[10.5px]", show === i ? "font-semibold text-ink" : "text-muted")}>{d.label.replace(/^\w+ /, "")}</span>)}
      </div>
    </div>
  );
}

/** A small trend line, for cards. */
export function Sparkline({ values, width = 120, height = 36, className }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values), r = Math.max(1, max - min);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 4 - ((v - min) / r) * (height - 8)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <path d={`${d} L${width - 2},${height} L2,${height} Z`} fill="currentColor" opacity=".12" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="3" fill="currentColor" />
    </svg>
  );
}

/** Horizontal bars, for "what they enjoyed" and similar breakdowns. */
export function BarList({ items, color = "bg-brand" }: { items: { label: string; n: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between text-[13.5px]"><span>{i.label}</span><span className="num font-semibold">{i.n}</span></div>
          <div className="h-2 rounded-full bg-page"><div className={cx("h-full rounded-full transition-all duration-700", color)} style={{ width: `${(i.n / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
