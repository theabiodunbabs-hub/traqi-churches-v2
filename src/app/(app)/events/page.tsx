"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Badge, Button, Empty, PageHeader, Tabs } from "@/components/ui";
import { COVERS } from "@/components/brand";
import { eventWhen } from "@/components/event-page";
import { STATE_BADGE, canCreateEvents, eventCounts, eventState } from "@/lib/domain";
import { addDays, at } from "@/lib/seed-more";
import { dayName, todayLagos } from "@/lib/format";
import type { ChurchEvent } from "@/lib/types";
import { themeOf } from "@/lib/events";

export default function Events() {
  const { state, access, me, put, newId } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "drafts" | "past">("upcoming");
  if (!access || !me) return null;
  const creator = canCreateEvents(access);
  const coOrg = (e: ChurchEvent) => e.coOrganisers.some((c) => c.status === "approved" && access.leads.has(c.groupId));
  const mine = (e: ChurchEvent) => creator || e.createdById === me.id || coOrg(e) || access.isPastoral;
  const all = state.events.filter((e) => e.status === "published" || mine(e)).sort((a, b) => a.start.localeCompare(b.start));
  const list = all.filter((e) => { const s = eventState(e); return tab === "drafts" ? s === "draft" || s === "pending" : tab === "past" ? s === "past" : s === "upcoming" || s === "live"; });

  const create = () => {
    const d = addDays(todayLagos(), 21);
    const e: ChurchEvent = {
      id: newId("ev"), slug: `event-${Date.now().toString(36).slice(-4)}`, title: "Untitled event", tagline: "", theme: "", description: "", cover: state.events.length % COVERS.length,
      start: at(d, "10:00"), end: at(d, "14:00"), days: [d], dayPlan: [{ date: d, start: "10:00", end: "14:00" }], mode: "physical", template: "flyer", regTypes: ["individual", "group"],
      venue: state.church.profile?.address, venues: state.church.profile?.address ? [{ id: "v1", name: "Main auditorium", address: state.church.profile.address, directions: state.church.profile.directions }] : [], people: [], speakers: [], schedule: [],
      contact: { name: `${state.church.name} guest services` },
      groupReg: false, needsApproval: false, followup: true, questions: [], status: "draft", createdById: me.id, coOrganisers: [], createdAt: new Date().toISOString(),
    };
    put("events", e, "started a new event");
    router.push(`/events/${e.id}?edit=1`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Events" sub="Conferences, retreats and special services, each with its own page and registration." actions={creator && <Button variant="primary" onClick={create}><Plus size={16} /> New event</Button>} />
      <Tabs className="mb-5" value={tab} onChange={setTab} items={[
        { key: "upcoming", label: "Coming up", count: all.filter((e) => ["upcoming", "live"].includes(eventState(e))).length },
        ...(creator || access.isPastoral ? [{ key: "drafts" as const, label: "Drafts and approvals", count: all.filter((e) => ["draft", "pending"].includes(eventState(e))).length }] : []),
        { key: "past", label: "Past" },
      ]} />
      {list.length === 0 ? (
        <Empty title={tab === "upcoming" ? "No events coming up" : "Nothing here"} body="When an event is approved, it shows up here with its own page to share." icon={<CalendarDays size={26} />} action={creator && tab !== "past" && <Button variant="primary" onClick={create}>Create an event</Button>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {list.map((e) => {
            const s = eventState(e); const b = STATE_BADGE[s]; const c = eventCounts(state, e);
            return (
              <Link key={e.id} href={`/events/${e.id}`} className="card card-hover group overflow-hidden">
                <div className="relative h-40 p-5 text-white" style={{ background: e.flyer ? `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.7)), url(${e.flyer}) center/cover` : COVERS[e.cover % COVERS.length] }}>
                  <div className="absolute left-5 top-5 rounded-2xl bg-white/95 px-3 py-2 text-center text-on-light shadow-lg">
                    <p className="text-[11px] font-bold uppercase text-alert">{dayName(e.start, { month: "short" })}</p>
                    <p className="num text-2xl font-semibold leading-none">{dayName(e.start, { day: "numeric" })}</p>
                  </div>
                  <div className="absolute right-4 top-4"><Badge tone={b.tone}>{b.label}</Badge></div>
                  <p className="absolute bottom-4 left-5 right-5 font-display text-[26px] font-semibold leading-tight tracking-tight">{e.title}</p>
                </div>
                <div className="p-5">
                  <p className="line-clamp-1 text-[14.5px] text-ink-soft">{themeOf(e) || "No theme yet"}</p>
                  <div className="mt-3 flex items-center justify-between text-[13px] text-muted">
                    <span>{eventWhen(e)}{e.days.length > 1 ? ` · ${e.days.length} days` : ""}</span>
                    {e.status === "published" && <span className="flex items-center gap-1.5 font-medium text-ink"><Users size={14} /> {c.people}{e.capacity ? ` / ${e.capacity}` : ""}</span>}
                  </div>
                  {e.capacity && e.status === "published" && <div className="mt-3 h-1.5 rounded-full bg-page"><div className="h-full rounded-full bg-gradient-to-r from-brand to-glow" style={{ width: `${Math.min(100, (c.people / e.capacity) * 100)}%` }} /></div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {!creator && access.leads.size > 0 && <p className="mt-6 text-center text-[13px] text-muted">Want your department to help run an event? Open it and request to co-organise.</p>}
    </div>
  );
}
