"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Lock, ScanLine } from "lucide-react";
import { useStore } from "@/lib/store";
import { liveDesk, openLink, storeDesk, type DoorEvent } from "@/lib/checkin";
import { checksIn } from "@/lib/event-mgmt";
import { fullName } from "@/lib/format";
import { CheckinDesk } from "@/components/checkin-desk";
import { doorEvent } from "@/components/event-door";
import { LiveSignIn } from "@/components/auth";
import { Preloader } from "@/components/preloader";

/**
 * The shared check-in link: /door/<token>. Opens straight to the event's check-in screen, nothing else.
 * Only works while the link is current, and only for signed-in people on the check-in team.
 */
export default function Door() {
  const { token } = useParams<{ token: string }>();
  const { mode, authStatus, state, me, access, put, newId, findByPhone } = useStore();
  const [live, setLive] = useState<{ allowed: boolean; event?: DoorEvent; reason?: string } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (mode !== "live" || authStatus !== "ready") return;
    openLink(token).then(setLive).catch((x) => setErr(x instanceof Error ? x.message : "Couldn't open the check-in"));
  }, [mode, authStatus, token]);

  // Demo mode: the event in this browser's data
  const demoEvent = mode === "demo" ? state.events.find((e) => e.checkinLink?.token === token && !e.checkinLink.revoked) : undefined;
  const regsRef = useMemo(() => ({ regs: state.registrations }), []); // eslint-disable-line react-hooks/exhaustive-deps
  regsRef.regs = state.registrations;
  const desk = useMemo(() => {
    if (mode === "live" && live?.allowed && live.event?.churchId) return liveDesk(live.event.churchId, live.event.id);
    if (demoEvent && me) return storeDesk({ e: demoEvent, regs: () => regsRef.regs, meId: me.id, nameOf: (id) => fullName(state.people.find((p) => p.id === id)), save: (r, log) => put("registrations", r, log), newId, personByPhone: (p) => findByPhone(p)?.id, day: () => "", session: () => undefined });
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, live, demoEvent?.id, me?.id]);

  const shell = (body: React.ReactNode, title = "Event check-in", sub?: string) => (
    <main className="min-h-dvh bg-page px-4 pb-10 pt-5">
      <div className="mx-auto max-w-lg">
        <header className="mb-4 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-brand text-white"><ScanLine size={20} /></span>
          <span className="min-w-0"><b className="block truncate font-display text-[19px] font-semibold leading-tight">{title}</b>{sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}</span></header>
        {body}
      </div>
    </main>
  );
  const blocked = (msg: string) => shell(<div className="card p-6 text-center"><Lock size={26} className="mx-auto mb-3 text-muted" /><p className="text-[15px]">{msg}</p><Link href="/today" className="mt-4 inline-block text-sm font-medium text-brand">Go to Traqi</Link></div>);

  if (mode === "live") {
    if (authStatus === "loading") return <Preloader />;
    if (authStatus === "signed-out" || authStatus === "no-church") return shell(<div className="card p-5"><p className="mb-4 text-[14.5px] text-ink-soft">Sign in with your Traqi account to check people in. Only people on this event&apos;s check-in team can use this link.</p><LiveSignIn returnTo={`/door/${token}`} /></div>);
    if (err) return blocked(err);
    if (!live) return <Preloader />;
    if (!live.allowed || !live.event || !desk) return blocked(live.reason ?? "You're not on the check-in team for this event. Ask the Registration Lead to add you.");
    return shell(<CheckinDesk event={live.event} desk={desk} compact />, live.event.title, `${live.event.churchName} · check-in`);
  }
  if (!demoEvent) return blocked("This check-in link isn't current. Ask the Registration Lead for the new one.");
  if (!me || !access) return blocked("Sign in to Traqi first, then open the link again.");
  if (!checksIn(state, demoEvent, access)) return blocked("You're not on the check-in team for this event. Ask the Registration Lead to add you.");
  return shell(desk && <CheckinDesk event={doorEvent(demoEvent, state.church.name)} desk={desk} compact />, demoEvent.title, `${state.church.name} · check-in`);
}
