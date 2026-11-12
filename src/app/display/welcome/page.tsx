"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { QR } from "@/components/public";

/** Full-screen welcome QR for the projector during service. */
export default function WelcomeDisplay() {
  const { state } = useStore();
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(`${location.origin}/welcome${state.church.slug ? `?church=${state.church.slug}` : ""}`); }, [state.church.slug]);
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-deep px-6 py-12 text-white">
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 size-[640px] rounded-full bg-brand/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-52 -right-40 size-[600px] rounded-full bg-j4/30 blur-3xl" />
      <Link href="/first-timers" className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close"><X size={20} /></Link>
      <div className="relative flex flex-col items-center gap-12 text-center lg:flex-row lg:text-left">
        <div className="max-w-xl">
          <p className="text-xl text-white/70">{state.church.name}</p>
          <h1 className="mt-3 font-display text-[52px] font-semibold leading-[1.02] tracking-tight md:text-[76px]">New here?<br />Say hello.</h1>
          <p className="mt-5 text-[22px] text-white/75">Point your phone camera at the code. It takes one minute, and we&apos;d love to know you.</p>
        </div>
        <div className="rounded-[32px] bg-surface p-6 shadow-2xl">
          {url && <QR value={url} size={340} />}
        </div>
      </div>
      <p className="relative mt-12 text-lg text-white/60">{url.replace(/^https?:\/\//, "")}</p>
    </div>
  );
}
