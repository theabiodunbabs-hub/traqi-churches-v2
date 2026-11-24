"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Monitor, Printer, QrCode } from "lucide-react";
import { useStore } from "@/lib/store";
import { venueCodes } from "@/lib/live";
import { newToken, printedCode, screenCode, venuePath } from "@/lib/event-page";
import { Button, Toggle, toast } from "./ui";
import { QR } from "./public";
import type { ChurchEvent } from "@/lib/types";

/** The codes right now: from the database (live) or worked out here (demo). Screen codes refresh every 20 seconds. */
export function useVenueCodes(e: ChurchEvent | undefined) {
  const { mode } = useStore();
  const [codes, setCodes] = useState<{ printed: string; screen: string } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!e?.venueCheckin?.on) return;
    let stop = false;
    const load = async () => {
      try {
        if (mode === "live") { const c = await venueCodes(e.id); if (!stop) setCodes(c); }
        else setCodes({ printed: printedCode(e.venueCheckin!.secret), screen: screenCode(e.venueCheckin!.secret) });
        setErr("");
      } catch (x) { if (!stop) setErr(x instanceof Error ? x.message : "Couldn't load the codes"); }
    };
    void load();
    const t = setInterval(load, 20000);
    return () => { stop = true; clearInterval(t); };
  }, [e?.id, e?.venueCheckin, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  return { codes, err };
}

/** In the event's Check-in tab: switch on check-in at the venue, and get the printed code or the screen. */
export function VenueCheckinCard({ e, canEdit }: { e: ChurchEvent; canEdit: boolean }) {
  const { put } = useStore();
  const v = e.venueCheckin;
  const set = (patch: Partial<NonNullable<ChurchEvent["venueCheckin"]>>) => {
    const next = { on: false, printed: true, screen: false, secret: v?.secret ?? newToken() + newToken(), ...v, ...patch };
    if (!next.printed && !next.screen) return toast("Keep at least one: the printed code or the screen");
    put("events", { ...e, venueCheckin: next }, `${next.on ? "set up" : "switched off"} check-in at the venue for ${e.title}`);
  };
  return (
    <div className="card mb-5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><QrCode size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-semibold">People check themselves in at the venue</p>
          <p className="text-[13.5px] text-ink-soft">They scan a code, type their phone or email, and tap “Yes, that&apos;s me”. Not registered? They register and are checked in at once. Your check-in team&apos;s tools stay as they are.</p>
        </div>
        {canEdit && <Toggle label="Check-in at the venue" on={!!v?.on} onChange={(on) => set({ on })} />}
      </div>
      {v?.on && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          {canEdit && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line"><span><b className="font-medium">Printed code</b><span className="block text-[12.5px] text-muted">Works only during event hours</span></span><Toggle label="Printed code" on={v.printed} onChange={(printed) => set({ printed })} /></label>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line"><span><b className="font-medium">Code on a screen</b><span className="block text-[12.5px] text-muted">Changes every minute</span></span><Toggle label="Code on a screen" on={v.screen} onChange={(screen) => set({ screen })} /></label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {v.printed && <Link href={`/display/venue?e=${e.id}&print=1`} target="_blank"><Button><Printer size={15} /> Print the code</Button></Link>}
            {v.screen && <Link href={`/display/venue?e=${e.id}`} target="_blank"><Button variant="primary"><Monitor size={15} /> Show on a screen</Button></Link>}
          </div>
          {canEdit && <button type="button" className="text-[13px] font-medium text-alert" onClick={() => { put("events", { ...e, venueCheckin: { ...v, secret: newToken() + newToken() } }, `made new venue check-in codes for ${e.title}`); toast("New codes made. Print the new one: the old printout no longer works."); }}>Make new codes (the old printout stops working)</button>}
        </div>
      )}
    </div>
  );
}

/** The full-screen code for the venue: the screen (changes every minute) or a page to print. */
export function VenueDisplay({ eventId, print }: { eventId: string; print: boolean }) {
  const { ready, state } = useStore();
  const e = state.events.find((x) => x.id === eventId);
  const { codes, err } = useVenueCodes(e);
  const [origin, setOrigin] = useState("");
  const [left, setLeft] = useState(60);
  useEffect(() => { setOrigin(location.origin); const t = setInterval(() => setLeft(60 - new Date().getSeconds()), 1000); return () => clearInterval(t); }, []);
  if (!ready) return null;
  if (!e) return <div className="flex min-h-screen items-center justify-center p-6 text-center"><p className="font-display text-2xl font-semibold">Event not found</p></div>;
  if (!e.venueCheckin?.on) return <div className="flex min-h-screen items-center justify-center p-6 text-center"><p className="font-display text-2xl font-semibold">Switch on check-in at the venue first, in the event&apos;s Check-in tab.</p></div>;
  const code = print ? codes?.printed : codes?.screen;
  const url = code ? `${origin}${venuePath(state.church.slug, e, code)}` : "";
  const color = state.church.profile?.color ?? "#4f46e5";
  return (
    <div className={print ? "min-h-screen bg-white p-10 text-[#111] print:p-0" : "flex min-h-screen flex-col items-center justify-center bg-[#0b0a14] p-8 text-white"} style={print ? undefined : { background: `radial-gradient(900px 600px at 100% 0%, ${color}99, transparent 65%), #0b0a14` }}>
      <div className={print ? "mx-auto flex max-w-xl flex-col items-center text-center" : "flex flex-col items-center text-center"}>
        <p className={print ? "text-[15px] font-semibold uppercase tracking-[.25em] text-[#555]" : "text-[15px] font-semibold uppercase tracking-[.3em] text-white/70"}>{state.church.name}</p>
        <h1 className="mt-3 font-display text-[44px] font-bold leading-tight md:text-[64px]">{e.title}</h1>
        <p className={print ? "mt-2 text-[22px]" : "mt-2 text-[24px] text-white/80"}>Scan to check in</p>
        <div className="mt-8 rounded-[28px] bg-white p-6 shadow-2xl">{url ? <QRBig value={url} /> : <div className="size-[300px] animate-pulse rounded-2xl bg-[#eee]" />}</div>
        {err && <p className="mt-4 text-[#e11d48]">{err}</p>}
        <p className={print ? "mt-6 text-[16px] text-[#555]" : "mt-6 text-[18px] text-white/70"}>Type your phone number or email, then tap “Yes, that&apos;s me”.</p>
        {!print && <p className="mt-3 text-[14px] text-white/50">New code in {left}s</p>}
        {print && <p className="mt-3 text-[13px] text-[#777]">Works only during the event. {code}</p>}
        {print && <button type="button" onClick={() => window.print()} className="mt-8 rounded-xl bg-[#111] px-5 py-3 font-semibold text-white print:hidden"><Printer size={16} className="mr-2 inline" />Print</button>}
      </div>
    </div>
  );
}

function QRBig({ value }: { value: string }) { return <QR value={value} size={300} />; }
