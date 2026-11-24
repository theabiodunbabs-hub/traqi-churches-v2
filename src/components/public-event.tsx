"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { eventFeedback, eventGoogle, eventMemberStatus, eventPage, registerEvent, registerEventMember } from "@/lib/live";
import { EventLanding, type MemberFlow, type RegResult } from "./event-landing";
import { useDemoFeedback, useDemoRegister } from "./event-page";
import { eventCounts } from "@/lib/domain";
import { memberReturn, type MemberStatus } from "@/lib/event-join";
import { P } from "@/lib/seed";
import type { ChurchEvent, ChurchProfile } from "@/lib/types";

type Live = { church: { name: string; slug: string; profile: Partial<ChurchProfile> }; event: ChurchEvent; registered: number; recent?: string[] };

/** Pretend Google accounts for the demo: two people already in the church, two new to Traqi. */
const NEW_DEMO = [
  { key: "new:chidi", firstName: "Chidi", lastName: "Okafor", email: "chidi.okafor@gmail.com" },
  { key: "new:amaka", firstName: "Amaka", lastName: "Eze", email: "amaka.eze@gmail.com" },
];

/** How members register (live: real Google; demo: pretend accounts). `back` is where Google returns to. */
export function useMemberFlow(church: string, event: string, back: string): MemberFlow | undefined {
  const { mode, state, me, joinChurch, signIn } = useStore();
  const router = useRouter();
  const demoRegister = useDemoRegister();
  const churchOf = useRef<string | undefined>(undefined);
  const picked = useRef<string | null>(null);
  const liveMember = useMemo<MemberFlow>(() => ({
    status: async () => { const s = await eventMemberStatus(church, event); churchOf.current = s.churchId; return s; },
    google: () => eventGoogle(back),
    register: async (r) => { const x = await registerEventMember(church, event, r); churchOf.current = x.churchId ?? churchOf.current; return x as RegResult; },
    dashboard: () => { if (churchOf.current) { try { localStorage.setItem("traqi-church", churchOf.current); } catch { /* storage unavailable */ } } location.href = "/today"; },
  }), [church, event, back]);
  const e = state.events.find((x) => x.slug === event && x.status === "published");
  const demoMember = useMemo<MemberFlow | undefined>(() => {
    if (!e) return undefined;
    const existing = [P.member, P.worker].map((x) => state.people.find((p) => p.id === x.id)).filter(Boolean) as typeof state.people;
    const mail = (p: (typeof state.people)[number]) => p.email || `${p.firstName}.${p.lastName}@gmail.com`.toLowerCase();
    return {
      accounts: [
        ...existing.map((p) => ({ key: p.id, name: `${p.firstName} ${p.lastName}`, email: mail(p), note: `Already in ${state.church.name}` })),
        ...NEW_DEMO.map((n) => ({ key: n.key, name: `${n.firstName} ${n.lastName}`, email: n.email, note: "New to Traqi" })),
      ],
      pick: (key) => { picked.current = key; },
      google: async () => {},
      status: async (): Promise<MemberStatus> => {
        const key = picked.current ?? (new URLSearchParams(location.search).get("member") ? me?.id ?? null : null);
        if (!key) return { signedIn: false, member: false, tickets: [] };
        const n = NEW_DEMO.find((x) => x.key === key);
        const p = n ? state.people.find((x) => x.email?.toLowerCase() === n.email) : state.people.find((x) => x.id === key);
        if (!p) return { signedIn: true, member: false, email: n!.email, firstName: n!.firstName, lastName: n!.lastName, tickets: [] };
        const tickets = state.registrations.filter((r) => r.eventId === e.id && r.personId === p.id).map((r) => ({ name: r.name, ticket: r.ticket, status: r.status, category: r.category }));
        return { signedIn: true, member: true, email: n?.email ?? mail(p), person: { firstName: p.firstName, lastName: p.lastName, phone: p.phone, birthday: p.birthday, gender: p.gender, email: p.email }, tickets };
      },
      register: async (r) => {
        const key = picked.current ?? me?.id;
        const n = NEW_DEMO.find((x) => x.key === key);
        let pid = n ? state.people.find((x) => x.email?.toLowerCase() === n.email)?.id : key ?? undefined;
        if (!pid) pid = await joinChurch({ church: "heirs", firstName: r.firstName!, lastName: r.lastName!, gender: r.gender, phone: r.phone, birthday: r.birthday, email: r.email });
        const res = await demoRegister(e, r, pid);
        if (pid) signIn(pid);
        return res;
      },
      dashboard: () => { const key = picked.current; if (key && !key.startsWith("new:")) signIn(key); router.push("/today"); },
    };
  }, [e, state, me, joinChurch, signIn, demoRegister, router]);
  return mode === "live" ? liveMember : demoMember;
}

/** The public event page, from the short link (traqi.space/heirs/rise-2026) or the older /e/ link. */
export function PublicEvent({ church, event }: { church: string; event: string }) {
  const { ready, mode, state } = useStore();
  const demoRegister = useDemoRegister();
  const demoFeedback = useDemoFeedback();
  const [live, setLive] = useState<Live | null | undefined>(undefined);
  useEffect(() => { if (mode === "live") eventPage(church, event, new URLSearchParams(location.search).get("t")).then((x) => setLive(x as Live | null)).catch(() => setLive(null)); }, [mode, church, event]);
  const member = useMemberFlow(church, event, memberReturn(`/${church}/${event}`));
  const e = state.events.find((x) => x.slug === event && x.status === "published");

  if (!ready) return <div className="skeleton h-screen rounded-none" />;
  if (mode === "live") {
    if (live === undefined) return <div className="skeleton h-screen rounded-none" />;
    if (!live) return <Missing />;
    return <EventLanding e={live.event} church={live.church} registered={live.registered} recent={live.recent}
      onRegister={async (r) => (await registerEvent(church, event, r)) as RegResult}
      onFeedback={(t, a) => eventFeedback(church, event, t, a)} member={member} />;
  }
  if (!e || (church !== state.church.slug && church !== "demo")) return <Missing />;
  const c = eventCounts(state, e);
  return <EventLanding e={e} church={{ name: state.church.name, slug: state.church.slug, profile: state.church.profile }} registered={c.people}
    recent={c.confirmed.slice(-4).map((r) => r.name)} onRegister={(r) => demoRegister(e, r)} onFeedback={(t, a) => demoFeedback(e, t, a)} member={member} />;
}

function Missing() {
  return <div className="flex min-h-screen items-center justify-center bg-page p-6 text-center"><div><p className="font-display text-2xl font-semibold">This event isn&apos;t available</p><p className="mt-2 text-ink-soft">It may have ended, or the link may be wrong.</p></div></div>;
}
