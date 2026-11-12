"use client";

import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { cx } from "./ui";

/** Frame for pages people outside the church staff see: welcome form, update link. */
export function PublicFrame({ church, children }: { church: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <div className="relative overflow-hidden bg-deep px-5 pb-24 pt-8 text-white">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 size-[360px] rounded-full bg-brand/50 blur-3xl" />
        <div className="relative mx-auto flex max-w-lg items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-surface font-display text-lg font-bold text-ink">{church[0]}</span>
          <span className="font-display text-lg font-semibold">{church}</span>
        </div>
      </div>
      <main className="relative mx-auto -mt-16 max-w-lg px-4 pb-16">{children}</main>
      <p className="pb-8 text-center text-xs text-muted">Powered by Traqi for Churches</p>
    </div>
  );
}

export function Consent({ church, checked, onChange }: { church: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex gap-3 rounded-2xl bg-page p-4 text-[13.5px] leading-relaxed text-ink-soft ring-1 ring-line">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brand" />
      <span>I agree that {church} may keep these details and contact me by phone, WhatsApp or email. I can ask for them to be changed or removed at any time.</span>
    </label>
  );
}

export function QR({ value, size = 280, className }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1e1b4b", light: "#ffffff" } })
      .then(setSvg).catch(() => setSvg(""));
  }, [value]);
  return <div role="img" aria-label={`QR code for ${value}`} className={cx("[&>svg]:h-full [&>svg]:w-full", className)} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
