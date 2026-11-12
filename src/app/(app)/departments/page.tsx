"use client";

import { goneQuiet } from "@/lib/metrics";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { useWords } from "@/components/theme";
import { Avatar, PageHeader, cx, inputCls } from "@/components/ui";
import { fullName } from "@/lib/format";
import type { Group } from "@/lib/types";

const TAG_LABEL: Record<string, string> = {
  followup: "First-timers", membership: "Placement", training: "Classes", ushering: "Cash counts",
  media: "Check-in codes", welfare: "Welfare requests", children: "Children's records",
};

export default function Departments() {
  const w = useWords();
  const { state, access, person } = useStore();
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("all");
  const branches = state.church.profile?.branches ?? [];

  const rows = useMemo(() => {
    const depts = state.groups.filter((g) => g.kind === "department");
    return depts
      .filter((d) => branch === "all" || (branch === "hq" ? !d.branchId : d.branchId === branch))
      .filter((d) => !q || `${d.name} ${d.purpose}`.toLowerCase().includes(q.toLowerCase()))
      .map((d) => {
        const units = state.groups.filter((u) => u.parentId === d.id);
        const people = new Set([...d.memberIds, ...units.flatMap((u) => u.memberIds)]);
        const quiet = goneQuiet([...people].map((id) => person(id)!).filter(Boolean)).length;
        return { d, units, size: people.size, quiet, supervisor: state.groups.find((g) => g.id === d.supervisorId) };
      });
  }, [state.groups, q, person, branch]);

  if (!access) return null;
  const mine = (g: Group) => access.scopedGroups.has(g.id);
  const total = new Set(state.groups.flatMap((g) => g.memberIds)).size;

  return (
    <div>
      <PageHeader
        title={w.departments}
        sub={`${rows.length} departments and ${state.groups.filter((g) => g.kind === "unit").length} units, with ${total} people serving.`}
      />
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className={cx(inputCls, "pl-10")} placeholder="Find a department" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {branches.length > 0 && (
          <select className={cx(inputCls, "sm:w-56")} value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">
            <option value="all">All branches</option><option value="hq">Headquarters</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ d, units, size, quiet, supervisor }, i) => {
          const overseer = person(d.overseerId);
          const leaders = d.leaderIds.map((id) => person(id)).filter(Boolean);
          return (
            <Link
              key={d.id}
              href={`/departments/${d.id}`}
              style={{ animationDelay: `${i * 30}ms` }}
              className={cx("rise group flex flex-col rounded-2xl bg-surface p-5 ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-brand/40 hover:shadow-lg hover:shadow-brand/5",
                mine(d) && "ring-brand/30")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-[18px] font-semibold leading-snug tracking-tight group-hover:text-brand">{d.name}</h2>
                  <p className="mt-1 line-clamp-2 text-[13.5px] text-ink-soft">{d.purpose}</p>
                </div>
                <ArrowUpRight size={16} className="mt-1 shrink-0 text-muted transition group-hover:text-brand" />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {d.tags?.map((t) => <span key={t} className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[11.5px] font-medium text-brand">{TAG_LABEL[t]}</span>)}
                {supervisor && <span className="rounded-md bg-page px-1.5 py-0.5 text-[11.5px] text-ink-soft ring-1 ring-line">Under {supervisor.name}</span>}
                {units.length > 0 && <span className="rounded-md bg-page px-1.5 py-0.5 text-[11.5px] text-ink-soft ring-1 ring-line">{units.length} units</span>}
              </div>

              <div className="mt-auto pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-1">
                    {[...new Set([...d.leaderIds, ...d.memberIds])].slice(0, 4).map((id) => (
                      <span key={id} className="rounded-full ring-[2.5px] ring-surface"><Avatar person={person(id)} size={30} /></span>
                    ))}
                    {size > 4 && <span className="flex size-[30px] items-center justify-center rounded-full bg-page text-[11px] font-semibold text-ink-soft ring-[2.5px] ring-surface">+{size - 4}</span>}
                  </div>
                  <p className="flex items-center gap-2 text-sm">
                    <span><span className="num font-semibold">{size}</span> <span className="text-muted">people</span></span>
                    {quiet > 0 ? <span className="rounded-md bg-alert-soft px-1.5 py-0.5 text-[12px] font-medium text-alert">{quiet} gone quiet</span>
                      : <span className="rounded-md bg-good-soft px-1.5 py-0.5 text-[12px] font-medium text-good">All present</span>}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[13px]">
                  <span className="truncate text-ink-soft">Led by <span className="font-medium text-ink">{leaders[0] ? fullName(leaders[0]) : "no one yet"}</span></span>
                  {overseer && <span className="shrink-0 text-muted">Pastor {overseer.firstName}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
