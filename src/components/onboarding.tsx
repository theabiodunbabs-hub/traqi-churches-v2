"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Logo } from "./brand";
import { cx } from "./ui";

/** The frame for signing in, joining and starting a church: a dark story panel and a calm form side. */
export function OnboardFrame({ children, title, points, back, wide }: { children: ReactNode; title: string; points?: string[]; back?: { href: string; label: string }; wide?: boolean }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
      <section className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col" style={{ background: "linear-gradient(160deg, var(--color-deep), var(--color-deep-2))" }}>
        <div aria-hidden className="pointer-events-none absolute -right-28 -top-36 size-[480px] rounded-full opacity-60 blur-3xl" style={{ background: "var(--hero-a)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-10 size-[380px] rounded-full opacity-30 blur-3xl" style={{ background: "var(--color-accent)" }} />
        <div className="relative"><Logo light /></div>
        <div className="relative mt-auto">
          <h1 className="max-w-md font-display text-[42px] leading-[1.06]">{title}</h1>
          {points && (
            <ul className="mt-8 space-y-3 text-[16px] text-white/80">
              {points.map((t) => <li key={t} className="flex items-start gap-3"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15"><Check size={12} /></span>{t}</li>)}
            </ul>
          )}
        </div>
      </section>
      <section className="flex justify-center px-5 py-8 md:py-12">
        <div className={cx("w-full", wide ? "max-w-2xl" : "max-w-md")}>
          <div className="mb-8 flex items-center justify-between lg:hidden"><Logo /></div>
          {back && <Link href={back.href} className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={15} /> {back.label}</Link>}
          {children}
        </div>
      </section>
    </div>
  );
}

/** Steps along the top of a multi-step form. */
export function Steps({ steps, at }: { steps: string[]; at: number }) {
  return (
    <ol className="mb-8 flex gap-2" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s} className="flex-1" aria-current={i === at ? "step" : undefined}>
          <span className={cx("block h-1.5 rounded-full transition-colors", i <= at ? "bg-brand" : "bg-line")} />
          <span className={cx("mt-2 hidden text-xs sm:block", i === at ? "font-semibold text-ink" : "text-muted")}>{s}</span>
        </li>
      ))}
    </ol>
  );
}
