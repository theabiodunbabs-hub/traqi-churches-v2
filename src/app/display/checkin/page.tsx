"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { QR } from "@/components/public";
import { ChurchMark, LogoMark } from "@/components/brand";
import { CountUp } from "@/components/ui";
import { checkinsFor, nextMeeting, openMeeting } from "@/lib/domain";
import { timeOf } from "@/lib/format";

/** Full-screen check-in for the projector: QR, link, code and a live count. */
export default function CheckinDisplay() {
  const { state } = useStore();
  const [url, setUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setUrl(`${location.origin}/checkin/${state.church.slug || "demo"}`); }, [state.church.slug]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);
  const id = typeof window !== "undefined" ? new URLSearchParams(location.search).get("m") : null;
  const m = state.meetings.find((x) => x.id === id) ?? openMeeting(state.meetings, now) ?? nextMeeting(state.meetings, now);
  const n = m ? checkinsFor(state, m.id).length : 0;
  const color = state.church.profile?.color ?? "#4f46e5";
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-8 py-10 text-white" style={{ background: `radial-gradient(900px 600px at 100% 0%, ${color}aa, transparent 65%), radial-gradient(700px 500px at 0% 100%, #f59e0b40, transparent 70%), var(--color-deep)` }}>
      <Link href="/attendance" className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close"><X size={20} /></Link>
      <header className="flex items-center gap-4">
        <ChurchMark church={state.church} size={56} className="ring-2 ring-white/20" />
        <div><p className="font-display text-2xl font-semibold">{state.church.name}</p>{m && <p className="text-white/65">{m.name} · {timeOf(m.start)}</p>}</div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-14 lg:flex-row">
        <div className="max-w-xl text-center lg:text-left">
          <h1 className="font-display text-[60px] font-semibold leading-[1] tracking-tight md:text-[88px]">Welcome<br />home.</h1>
          <p className="mt-6 text-[24px] text-white/75">Scan to check in. New here? Scan and say hello.</p>
          <div className="mt-10 flex justify-center gap-10 lg:justify-start">
            <div><p className="text-sm uppercase tracking-[.2em] text-white/55">Code</p><p className="num mt-1 text-[72px] font-semibold leading-none tracking-[.15em]">{m?.code ?? "—"}</p></div>
            <div className="w-px bg-white/15" />
            <div><p className="text-sm uppercase tracking-[.2em] text-white/55">Checked in</p><p className="num mt-1 text-[72px] font-semibold leading-none"><CountUp to={n} /></p></div>
          </div>
        </div>
        <div className="rounded-[36px] bg-surface p-7 shadow-2xl">{url && <QR value={url} size={360} />}<p className="mt-3 text-center text-lg font-medium text-ink">{url.replace(/^https?:\/\//, "")}</p></div>
      </div>
      <footer className="flex items-center justify-center gap-2 text-white/50"><LogoMark size={20} /> Traqi for Churches</footer>
    </div>
  );
}
