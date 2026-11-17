"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader, Toggle } from "@/components/ui";
import { usesAssistants, usesBranches } from "@/lib/features";
import { settingsPages } from "@/lib/settings-pages";
import { ChurchMark } from "@/components/brand";

export default function SettingsPage() {
  const { access, state, updateChurch } = useStore();
  if (!access) return null;
  const pages = settingsPages.filter((p) => p.show(access) && (p.feature !== "branches" || usesBranches(state)));
  const f = state.church.profile?.features ?? {};
  const canSwitch = access.isLead || access.can("roles.manage");
  const flip = (k: "branches" | "assistants", v: boolean, what: string) => updateChurch({}, { features: { ...f, [k]: v } }, `${v ? "switched on" : "switched off"} ${what}`);
  return (
    <>
      <PageHeader title="Settings" sub={`Everything about how ${state.church.name} uses Traqi, in one place.`} />
      <div className="mb-5 flex items-center gap-4 rounded-3xl bg-surface p-4 ring-1 ring-line">
        <ChurchMark church={state.church} size={52} />
        <div className="min-w-0 flex-1"><p className="truncate font-display text-[18px] font-semibold">{state.church.name}</p><p className="text-[13.5px] text-ink-soft">{state.church.profile?.city ?? state.church.country}</p></div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {pages.map((p) => {
          const I = p.icon;
          return (
            <li key={p.href}>
              <Link href={p.href} className="card card-hover flex h-full items-center gap-4 p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><I size={20} /></span>
                <span className="min-w-0 flex-1"><b className="block font-medium">{p.title}</b><span className="block text-[13.5px] text-ink-soft">{p.body}</span></span>
                <ChevronRight size={17} className="shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
      {canSwitch && (
        <section className="mt-8">
          <h2 className="mb-1 font-display text-[19px] font-semibold">Switch on when you need them</h2>
          <p className="mb-3 text-[14px] text-ink-soft">These stay out of the way until your church is ready for them.</p>
          <ul className="divide-y divide-line rounded-3xl bg-surface px-4 ring-1 ring-line">
            {([["branches", "Branches and regions", "For churches that meet in more than one place", usesBranches(state)], ["assistants", "Department assistants", "Let heads appoint assistants to help run their department", usesAssistants(state)]] as const).map(([k, t, b, on]) => (
              <li key={k} className="flex items-center gap-4 py-4">
                <span className="min-w-0 flex-1"><b className="block font-medium">{t}</b><span className="block text-[13.5px] text-ink-soft">{b}</span></span>
                <Toggle on={on} label={t} onChange={(v) => flip(k, v, t.toLowerCase())} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
