"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Plus, QrCode, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { DownloadButton } from "@/components/download";
import { firstTimersSheet } from "@/lib/exports";
import { useWords } from "@/components/theme";
import { Avatar, Button, PageHeader, cx } from "@/components/ui";
import { ReachOut, ReasonTag, messages } from "@/components/care";
import { AddFirstTimer } from "@/components/shell";
import { FOLLOW_STAGES, ago, fullName, hoursSince } from "@/lib/format";
import type { FollowCase, FollowStage } from "@/lib/types";
import { AssignPicker } from "@/components/assign";
import { cameBack as cohort, escalation } from "@/lib/metrics";

export default function FirstTimers() {
  const w = useWords();
  const { me, access, state, person, moveCase } = useStore();
  const [picking, setPicking] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<FollowStage | null>(null);
  const [mine, setMine] = useState(false);
  const [tab, setTab] = useState<FollowStage>("new");
  if (!me || !access) return null;

  const canAssign = access.can("followup.assign");
  const cases = state.cases.filter((c) => (canAssign && !mine) || c.assigneeId === me.id);
  const unassigned = cases.filter((c) => !c.assigneeId);
  const overdue = cases.filter((c) => c.stage === "new" && c.assigneeId && hoursSince(c.createdAt) > 48);
  const back = cohort(state);

  const clock = (c: FollowCase) => {
    if (c.stage !== "new") return null;
    const h = hoursSince(c.createdAt);
    if (h > 48) return <ReasonTag tone="alert">{Math.floor(h / 24)}d overdue</ReasonTag>;
    return <ReasonTag tone="brand">{Math.ceil(48 - h)}h left</ReasonTag>;
  };

  const nextStage = (s: FollowStage): FollowStage | null => {
    const i = FOLLOW_STAGES.findIndex((x) => x.key === s);
    return i >= 0 && i < FOLLOW_STAGES.length - 1 ? FOLLOW_STAGES[i + 1].key : null;
  };

  return (
    <div>
      <PageHeader
        title={canAssign ? w.firstTimers : "My follow-ups"}
        sub={canAssign ? "Reach every first-timer within 48 hours." : "Reach each person within 48 hours of their first visit."}
        actions={<>
          {canAssign && (
            <div className="flex rounded-xl bg-surface p-1 ring-1 ring-line">
              {[["All", false], ["Assigned to me", true]].map(([l, v]) => (
                <button key={String(l)} onClick={() => setMine(v as boolean)} className={cx("rounded-lg px-3 py-1.5 text-sm", mine === v ? "bg-deep text-white" : "text-ink-soft")}>{l as string}</button>
              ))}
            </div>
          )}
          {canAssign && access && <DownloadButton what={w.firstTimers} sheets={() => [firstTimersSheet(state, access)]} />}
          {canAssign && <Link href="/display/welcome" className="inline-flex h-10 items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-medium ring-1 ring-line hover:ring-ink/20"><QrCode size={16} /> Welcome QR</Link>}
          <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add {w.lower("firstTimer")}</Button>
        </>}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Pill n={overdue.length} label="past 48 hours" tone={overdue.length ? "alert" : undefined} />
        <Pill n={unassigned.length} label="waiting for someone" tone={unassigned.length ? "glow" : undefined} />
        <Pill n={cases.filter((c) => c.stage === "new" && c.assigneeId && hoursSince(c.createdAt) <= 48).length} label="due soon" />
        <Pill n={`${back.pct}%`} label={`came back (${back.back} of ${back.of} from 2–8 weeks ago)`} />
      </div>

      {canAssign && unassigned.length > 0 && (
        <section className="rise mb-6 rounded-2xl bg-glow-soft p-4 ring-1 ring-glow/30 md:p-5">
          <p className="mb-3 font-display text-[17px] font-semibold text-glow-ink">{unassigned.length} first-timer{unassigned.length > 1 ? "s" : ""} waiting for someone</p>
          <ul className="space-y-2">
            {unassigned.map((c) => {
              const p = person(c.personId)!;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3">
                  <Avatar person={p} size={36} />
                  <div className="min-w-0 flex-1"><Link href={`/people/${p.id}`} className="font-medium hover:text-brand">{fullName(p)}</Link><p className="text-[13px] text-muted">{p.location ?? "Area not given"}, first visit {ago(c.createdAt)}</p></div>
                  <Button onClick={() => setPicking(c.id)}>Assign</Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 md:hidden scrollbar-thin" role="tablist" aria-label="Stage">
        {FOLLOW_STAGES.map((s) => {
          const n = cases.filter((c) => c.stage === s.key && c.assigneeId).length;
          return (
            <button key={s.key} role="tab" aria-selected={tab === s.key} onClick={() => setTab(s.key)}
              className={cx("shrink-0 rounded-full px-3.5 py-1.5 text-sm", tab === s.key ? "bg-deep text-white" : "bg-surface text-ink-soft ring-1 ring-line")}>
              {s.label} <span className={tab === s.key ? "text-white/60" : "text-muted"}>{n}</span>
            </button>
          );
        })}
      </div>
      <div className="md:-mx-8 md:overflow-x-auto md:px-8 md:pb-4 scrollbar-thin">
        <div className="md:flex md:min-w-max md:gap-4">
          {FOLLOW_STAGES.map((s, si) => {
            const col = cases.filter((c) => c.stage === s.key && c.assigneeId);
            return (
              <section
                key={s.key}
                onDragOver={(e) => { e.preventDefault(); setOver(s.key); }}
                onDragLeave={() => setOver(null)}
                onDrop={() => { if (dragId) moveCase(dragId, s.key); setDragId(null); setOver(null); }}
                className={cx("shrink-0 rounded-2xl transition-colors md:w-72 md:p-3", tab === s.key ? "block" : "hidden md:block", over === s.key ? "bg-brand-soft ring-2 ring-brand/40" : "md:bg-surface/60 md:ring-1 md:ring-line")}
              >
                <div className="mb-3 hidden items-center gap-2 px-1 md:flex">
                  <span className={cx("size-2.5 rounded-full", ["bg-j1", "bg-j2", "bg-j2", "bg-j3", "bg-j3", "bg-j4"][si])} />
                  <h2 className="font-display text-[15px] font-semibold">{s.label}</h2>
                  <span className="num text-sm text-muted">{col.length}</span>
                </div>
                <ul className="space-y-2.5">
                  {col.map((c) => {
                    const p = person(c.personId)!;
                    const a = person(c.assigneeId);
                    const nx = nextStage(c.stage);
                    return (
                      <li key={c.id} draggable onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)}
                        className={cx("rounded-xl bg-surface p-3.5 ring-1 ring-line transition-shadow hover:shadow-md hover:shadow-ink/5", dragId === c.id && "opacity-50", c.stage === "new" && hoursSince(c.createdAt) > 48 && "ring-alert/40")}>
                        <div className="flex items-start gap-2.5">
                          <Avatar person={p} size={34} />
                          <div className="min-w-0 flex-1">
                            <Link href={`/people/${p.id}`} className="block truncate font-medium hover:text-brand">{fullName(p)}</Link>
                            <p className="truncate text-xs text-muted">First visit {ago(c.createdAt)}</p>
                          </div>
                          {clock(c)}
                        </div>
                        {escalation(state, c).level > 0 && (
                          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-alert-soft px-2.5 py-1.5 text-[12.5px] font-medium text-alert"><TriangleAlert size={13} />{escalation(state, c).label}</p>
                        )}
                        {c.contacts.at(-1) && <p className="mt-2.5 line-clamp-2 rounded-lg bg-page px-2.5 py-1.5 text-[13px] text-ink-soft">{c.contacts.at(-1)!.outcome}</p>}
                        <div className="mt-3 flex items-center gap-2">
                          <button disabled={!canAssign} onClick={() => setPicking(c.id)} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1 text-left text-xs text-muted enabled:hover:text-brand" title={`Assigned to ${fullName(a)}`}>
                            <Avatar person={a} size={20} /><span className="truncate">{a?.id === me.id ? "You" : a?.firstName}</span>
                          </button>
                          {c.stage === "new" && <ReachOut person={p} message={messages.welcome(p, state.church.name)} compact canContact={access.canSeeContacts(p)} />}
                          {nx && c.stage !== "new" && (
                            <button onClick={() => moveCase(c.id, nx)} className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft">
                              {FOLLOW_STAGES.find((x) => x.key === nx)?.label}<ChevronRight size={13} />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {col.length === 0 && <li className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">{s.hint}</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-2 hidden text-sm text-muted md:block">Drag a card to move it between stages.</p>
      <AddFirstTimer open={adding} onClose={() => setAdding(false)} />
      <AssignPicker caseId={picking} open={!!picking} onClose={() => setPicking(null)} />
    </div>
  );
}

function Pill({ n, label, tone }: { n: number | string; label: string; tone?: "alert" | "glow" }) {
  return (
    <span className={cx("inline-flex items-baseline gap-1.5 rounded-full px-3.5 py-1.5 text-sm ring-1",
      tone === "alert" ? "bg-alert-soft text-alert ring-alert/15" : tone === "glow" ? "bg-glow-soft text-glow-ink ring-glow/25" : "bg-surface text-ink-soft ring-line")}>
      <span className="num text-[16px] font-semibold">{n}</span>{label}
    </span>
  );
}
