"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Plus, QrCode, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { DownloadButton } from "@/components/download";
import { firstTimersSheet } from "@/lib/exports";
import { useWords } from "@/components/theme";
import { Avatar, Button, PageHeader, Tabs, cx } from "@/components/ui";
import { ReachOut, ReasonTag, messages } from "@/components/care";
import { AddFirstTimer } from "@/components/shell";
import { ago, fullName, hoursSince } from "@/lib/format";
import type { FollowCase, FollowStage } from "@/lib/types";
import { AssignPicker } from "@/components/assign";
import { cameBack as cohort, escalation, isFollowLead, pastorMayAssign } from "@/lib/metrics";

export default function FirstTimers() {
  const w = useWords();
  const { me, access, state, person, moveCase } = useStore();
  const [picking, setPicking] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<ColKey | null>(null);
  const [mine, setMine] = useState(false);
  const [tab, setTab] = useState<ColKey>("call");
  if (!me || !access) return null;

  const canAssign = access.can("followup.assign");
  // The follow-up head (and assistants allowed to) assign; pastors step in only when a case has waited too long
  const lead = isFollowLead(state, access);
  const mayAssign = (c: FollowCase) => lead || (access.isPastoral && pastorMayAssign(c));
  const cases = state.cases.filter((c) => (canAssign && !mine && access.seesCase(c)) || c.assigneeId === me.id);
  const unassigned = cases.filter((c) => !c.assigneeId);
  const overdue = cases.filter((c) => c.stage === "new" && c.assigneeId && hoursSince(c.createdAt) > 48);
  const back = cohort(state);

  const clock = (c: FollowCase) => {
    if (c.stage !== "new") return null;
    const h = hoursSince(c.createdAt);
    if (h > 48) return <ReasonTag tone="alert">{Math.floor(h / 24)}d overdue</ReasonTag>;
    return <ReasonTag tone="brand">{Math.ceil(48 - h)}h left</ReasonTag>;
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
                <button type="button" key={String(l)} onClick={() => setMine(v as boolean)} className={cx("rounded-lg px-3 py-1.5 text-sm", mine === v ? "bg-deep text-white" : "text-ink-soft")}>{l as string}</button>
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
          <p className="font-display text-[17px] font-semibold text-glow-ink">{unassigned.length} first-timer{unassigned.length > 1 ? "s" : ""} waiting for someone</p>
          <p className="mb-3 text-[13px] text-ink-soft">{lead ? "Choose someone from your follow-up team for each." : "The follow-up head assigns these. You can step in after 24 hours."}</p>
          <ul className="space-y-2">
            {unassigned.map((c) => {
              const p = person(c.personId)!;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3">
                  <Avatar person={p} size={36} />
                  <div className="min-w-[11rem] flex-1"><Link href={`/people/${p.id}`} className="font-medium hover:text-brand">{fullName(p)}</Link><p className="text-[13px] text-muted">{p.location ?? "Area not given"}, first visit {ago(c.createdAt)}</p></div>
                  {mayAssign(c) ? <Button onClick={() => setPicking(c.id)}>Assign</Button> : <span className="text-[12.5px] text-muted">Waiting for the follow-up head</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mb-3 md:hidden"><Tabs value={tab} onChange={setTab} items={COLS.map((c) => ({ key: c.key, label: c.label, count: cases.filter((x) => c.stages.includes(x.stage) && x.assigneeId).length }))} /></div>
      <div className="md:grid md:grid-cols-3 md:gap-4">
        {COLS.map((col, si) => {
          const list = cases.filter((c) => col.stages.includes(c.stage) && c.assigneeId);
          return (
            <section
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
              onDragLeave={() => setOver(null)}
              onDrop={() => { if (dragId) moveCase(dragId, col.drop); setDragId(null); setOver(null); }}
              className={cx("min-w-0 rounded-2xl transition-colors md:p-3", tab === col.key ? "block" : "hidden md:block", over === col.key ? "bg-brand-soft ring-2 ring-brand/40" : "md:bg-surface/60 md:ring-1 md:ring-line")}
            >
              <div className="mb-3 hidden items-center gap-2 px-1 md:flex">
                <span className={cx("size-2.5 rounded-full", ["bg-j2", "bg-j3", "bg-j5"][si])} />
                <h2 className="font-display text-[15px] font-semibold">{col.label}</h2>
                <span className="num text-sm text-muted">{list.length}</span>
              </div>
              <ul className="space-y-2.5">
                {list.map((c) => {
                  const p = person(c.personId)!;
                  const a = person(c.assigneeId);
                  return (
                    <li key={c.id} draggable onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)}
                      className={cx("rounded-xl bg-surface p-3.5 ring-1 ring-line transition-shadow hover:shadow-md hover:shadow-ink/5", dragId === c.id && "opacity-50", c.stage === "new" && hoursSince(c.createdAt) > 48 && "ring-alert/40")}>
                      <div className="flex items-start gap-2.5">
                        <Avatar person={p} size={34} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/people/${p.id}`} className="block truncate font-medium hover:text-brand">{fullName(p)}</Link>
                          <p className="truncate text-[12.5px] text-muted">First visit {ago(c.createdAt)}{c.stage === "visited" ? " · visited" : c.stage === "in_class" ? " · in class" : c.stage === "member" ? " · member now" : ""}</p>
                        </div>
                        {clock(c)}
                      </div>
                      {escalation(state, c).level > 0 && (
                        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-alert-soft px-2.5 py-1.5 text-[12.5px] font-medium text-alert"><TriangleAlert size={13} />{escalation(state, c).label}</p>
                      )}
                      {c.contacts.at(-1) && <p className="mt-2.5 line-clamp-2 rounded-lg bg-page px-2.5 py-1.5 text-[13px] text-ink-soft">{c.contacts.at(-1)!.outcome}</p>}
                      <div className="mt-3 flex items-center gap-2">
                        <button type="button" disabled={!mayAssign(c)} onClick={() => setPicking(c.id)} className="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg text-left text-[12.5px] text-muted enabled:hover:text-brand" title={`Assigned to ${fullName(a)}`}>
                          <Avatar person={a} size={20} /><span className="truncate">{a?.id === me.id ? "You" : a?.firstName}</span>
                        </button>
                        {c.stage === "new" && <ReachOut person={p} message={messages.welcome(p, state.church.name)} compact canContact={access.canSeeContacts(p)} />}
                        {col.next && (
                          <button type="button" onClick={() => moveCase(c.id, col.next!.to)} className="inline-flex min-h-9 items-center gap-0.5 rounded-lg px-2 text-[12.5px] font-medium text-brand hover:bg-brand-soft">
                            {col.next.label}<ChevronRight size={13} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
                {list.length === 0 && <li className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-muted">{col.hint}</li>}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-2 hidden text-sm text-muted md:block">Drag a card to move it between columns.</p>
      <AddFirstTimer open={adding} onClose={() => setAdding(false)} />
      <AssignPicker caseId={picking} open={!!picking} onClose={() => setPicking(null)} />
    </div>
  );
}

type ColKey = "call" | "touch" | "back";
/** Three columns instead of six stages: who to call, who we're in touch with, who came back. */
const COLS: { key: ColKey; label: string; stages: FollowStage[]; drop: FollowStage; hint: string; next?: { label: string; to: FollowStage } }[] = [
  { key: "call", label: "To call", stages: ["new"], drop: "new", hint: "Nobody waiting for a call", next: { label: "Reached", to: "contacted" } },
  { key: "touch", label: "In touch", stages: ["contacted", "visited"], drop: "contacted", hint: "Called or visited people show here", next: { label: "Came back", to: "returned" } },
  { key: "back", label: "Came back", stages: ["returned", "in_class", "member"], drop: "returned", hint: "People who came again show here" },
];

function Pill({ n, label, tone }: { n: number | string; label: string; tone?: "alert" | "glow" }) {
  return (
    <span className={cx("inline-flex items-baseline gap-1.5 rounded-full px-3.5 py-1.5 text-sm ring-1",
      tone === "alert" ? "bg-alert-soft text-alert ring-alert/15" : tone === "glow" ? "bg-glow-soft text-glow-ink ring-glow/25" : "bg-surface text-ink-soft ring-line")}>
      <span className="num text-[16px] font-semibold">{n}</span>{label}
    </span>
  );
}
