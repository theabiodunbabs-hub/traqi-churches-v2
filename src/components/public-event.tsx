"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { eventFeedback, eventPage, registerEvent } from "@/lib/live";
import { EventLanding, type RegResult } from "./event-landing";
import { useDemoFeedback, useDemoRegister } from "./event-page";
import { eventCounts } from "@/lib/domain";
import type { ChurchEvent, ChurchProfile } from "@/lib/types";

type Live = { church: { name: string; slug: string; profile: Partial<ChurchProfile> }; event: ChurchEvent; registered: number; recent?: string[] };

/** The public event page, from the short link (traqi.space/heirs/rise-2026) or the older /e/ link. */
export function PublicEvent({ church, event }: { church: string; event: string }) {
  const { ready, mode, state } = useStore();
  const demoRegister = useDemoRegister();
  const demoFeedback = useDemoFeedback();
  const [live, setLive] = useState<Live | null | undefined>(undefined);
  useEffect(() => { if (mode === "live") eventPage(church, event).then((x) => setLive(x as Live | null)).catch(() => setLive(null)); }, [mode, church, event]);
  if (!ready) return <div className="skeleton h-screen rounded-none" />;
  if (mode === "live") {
    if (live === undefined) return <div className="skeleton h-screen rounded-none" />;
    if (!live) return <Missing />;
    return <EventLanding e={live.event} church={live.church} registered={live.registered} recent={live.recent}
      onRegister={async (r) => (await registerEvent(church, event, r)) as RegResult}
      onFeedback={(t, a) => eventFeedback(church, event, t, a)} />;
  }
  const e = state.events.find((x) => x.slug === event && x.status === "published");
  if (!e || (church !== state.church.slug && church !== "demo")) return <Missing />;
  const c = eventCounts(state, e);
  return <EventLanding e={e} church={{ name: state.church.name, slug: state.church.slug, profile: state.church.profile }} registered={c.people}
    recent={c.confirmed.slice(-4).map((r) => r.name)} onRegister={(r) => demoRegister(e, r)} onFeedback={(t, a) => demoFeedback(e, t, a)} />;
}

function Missing() {
  return <div className="flex min-h-screen items-center justify-center bg-page p-6 text-center"><div><p className="font-display text-2xl font-semibold">This event isn&apos;t available</p><p className="mt-2 text-ink-soft">It may have ended, or the link may be wrong.</p></div></div>;
}
