"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy as CopyIcon, Link2, Search, Upload, UserMinus, UserPlus, Users, X } from "lucide-react";
import { JoinersSheet } from "@/components/joiners";
import { isUnconfirmed } from "@/lib/domain";
import { useStore } from "@/lib/store";
import { Avatar, Button, Empty, PageHeader, Sheet, StageChip, cx, inputCls, toast } from "@/components/ui";
import { DownloadButton } from "@/components/download";
import { canDownloadAll, peopleSheet } from "@/lib/exports";
import { QR } from "@/components/public";
import { STAGES_NOW, digits, fullName, shortDate, stageInfo } from "@/lib/format";
import type { Person, Stage } from "@/lib/types";

export default function People() {
  const { access, state, updatePerson, addToGroup, put } = useStore();
  const [showInactive, setShowInactive] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkDept, setBulkDept] = useState(false);
  const [dupes, setDupes] = useState(false);
  const [joiners, setJoiners] = useState(false);
  useEffect(() => { if (new URLSearchParams(location.search).get("joined")) setJoiners(true); }, []);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [dept, setDept] = useState("all");
  const [branch, setBranch] = useState("all");
  const branches = state.church.profile?.branches ?? [];
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [limit, setLimit] = useState(20);

  const everyone = useMemo(() => (access?.visiblePeople() ?? []).filter((p) => !p.isChild), [access]);
  const all = everyone.filter((p) => (showInactive ? p.inactive : !p.inactive));
  const inactiveCount = everyone.filter((p) => p.inactive).length;
  const dupGroups = useMemo(() => {
    const m = new Map<string, Person[]>();
    everyone.filter((p) => !p.inactive && digits(p.phone).length >= 10).forEach((p) => { const k = digits(p.phone).slice(-10); m.set(k, [...(m.get(k) ?? []), p]); });
    return [...m.values()].filter((g) => g.length > 1);
  }, [everyone]);
  const canEditAll = access?.can("people.edit") ?? false;
  const toggle = (id: string) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n); };
  const groupsOf = (id: string) => state.groups.filter((g) => g.kind === "department" && g.memberIds.includes(id));

  const list = all
    .filter((p) => stage === "all" || p.stage === stage)
    .filter((p) => branch === "all" || (branch === "hq" ? !p.branchId : p.branchId === branch))
    .filter((p) => dept === "all" || state.groups.some((g) => (g.id === dept || g.parentId === dept) && g.memberIds.includes(p.id)))
    .filter((p) => !q || `${p.firstName} ${p.lastName} ${p.phone} ${p.location ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.firstName.localeCompare(b.firstName));

  const counts = STAGES_NOW().map((s) => ({ ...s, n: all.filter((p) => p.stage === s.key).length }));
  if (!access) return null;

  return (
    <div>
      <PageHeader
        title="People"
        sub={`${all.length} people ${access.perms.get("people.view") === "church" ? `at ${state.church.name}` : "in your care"}`}
        actions={access.can("people.edit") || canDownloadAll(access) ? (
          <>
            {canDownloadAll(access) && <DownloadButton what="People" sheets={() => [peopleSheet(state, access, list)]} />}
            {access.can("people.edit") && <Button variant="ghost" onClick={() => setSharing(true)}><Link2 size={16} /> Update-details link</Button>}
            {access.can("people.edit") && <Link href="/people/import" className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-ink/5"><Upload size={16} /> Import from Excel</Link>}
          </>
        ) : undefined}
      />

      {/* Journey distribution doubles as the stage filter */}
      <section className="mb-6 rounded-2xl bg-surface p-5 ring-1 ring-line">
        <div className="flex h-4 gap-1 overflow-hidden rounded-full">
          {counts.filter((c) => c.n > 0).map((c) => (
            <button key={c.key} onClick={() => setStage(stage === c.key ? "all" : c.key)} aria-label={`${c.label}: ${c.n}`}
              className={cx("h-full transition-opacity", c.tone, stage !== "all" && stage !== c.key && "opacity-25")} style={{ flexGrow: c.n }} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {counts.map((c) => (
            <button key={c.key} onClick={() => setStage(stage === c.key ? "all" : c.key)} aria-pressed={stage === c.key}
              className={cx("flex items-center gap-2 text-sm", stage === c.key ? "font-semibold text-ink" : "text-ink-soft hover:text-ink")}>
              <span className={cx("size-2.5 rounded-full", c.tone)} />{c.label}<span className="num text-muted">{c.n}</span>
            </button>
          ))}
          {stage !== "all" && <button onClick={() => setStage("all")} className="text-sm font-medium text-brand">Show everyone</button>}
        </div>
      </section>

      {canEditAll && everyone.some(isUnconfirmed) && (
        <button onClick={() => setJoiners(true)} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-left text-[14px] text-brand ring-1 ring-brand/20">
          <UserPlus size={17} /> <span className="flex-1"><b>{everyone.filter(isUnconfirmed).length} new {everyone.filter(isUnconfirmed).length === 1 ? "person" : "people"}</b> joined from Traqi search and {everyone.filter(isUnconfirmed).length === 1 ? "is" : "are"} waiting to be confirmed.</span><span className="font-semibold">Review</span>
        </button>
      )}
      {canEditAll && dupGroups.length > 0 && (
        <button onClick={() => setDupes(true)} className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-glow-soft px-4 py-3 text-left text-[14px] text-glow-ink">
          <CopyIcon size={17} /> <span className="flex-1"><b>{dupGroups.length} possible duplicate{dupGroups.length > 1 ? "s" : ""}</b>: people sharing a phone number. Check and merge.</span><span className="font-semibold">Review</span>
        </button>
      )}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className={cx(inputCls, "bg-surface pl-10")} placeholder="Search by name, phone or area" value={q} onChange={(e) => { setQ(e.target.value); setLimit(20); }} />
        </div>
        {branches.length > 0 && (
          <select className={cx(inputCls, "bg-surface sm:w-52")} value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">
            <option value="all">All branches</option><option value="hq">Headquarters</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select className={cx(inputCls, "bg-surface sm:w-64")} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="all">All departments</option>
          {state.groups.filter((g) => g.kind === "department").map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {inactiveCount > 0 && <button onClick={() => setShowInactive(!showInactive)} className={cx("shrink-0 rounded-xl px-3.5 py-2 text-sm ring-1", showInactive ? "bg-deep text-white ring-deep" : "bg-surface text-ink-soft ring-line")}>{showInactive ? "Showing not active" : `Not active (${inactiveCount})`}</button>}
      </div>

      {list.length === 0 ? (
        <Empty title="No one matches" body="Try a different name, or clear the stage and department filters." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          <table className="w-full text-left text-[14.5px]">
            <thead className="hidden border-b border-line text-[13px] text-muted md:table-header-group">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Journey</th>
                <th className="px-3 py-3 font-medium">Department</th>
                <th className="px-5 py-3 font-medium text-right">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.slice(0, limit).map((p) => {
                const gs = groupsOf(p.id);
                return (
                  <tr key={p.id} className="group hover:bg-page/60">
                    <td className="px-4 py-3 md:px-5">
                      <span className="flex items-center gap-3">
                        {canEditAll && <button onClick={() => toggle(p.id)} aria-label={`Select ${fullName(p)}`} className={cx("hidden size-5 shrink-0 items-center justify-center rounded-md md:flex", picked.has(p.id) ? "bg-brand text-white" : "ring-2 ring-line opacity-0 group-hover:opacity-100", picked.size > 0 && "opacity-100")}>{picked.has(p.id) && <Check size={13} />}</button>}
                        <Link href={`/people/${p.id}`} className="flex min-w-0 items-center gap-3">
                          <Avatar person={p} size={40} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium group-hover:text-brand">{fullName(p)}</span>
                            <span className="flex items-center gap-1.5 truncate text-[13px] text-muted"><span className={cx("size-2 shrink-0 rounded-full md:hidden", stageInfo(p.stage).tone)} />{access.canSeeContacts(p) ? p.phone : p.location}{p.inactive && " · not active"}</span>
                          </span>
                        </Link>
                      </span>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell"><StageChip stage={p.stage} /></td>
                    <td className="hidden max-w-48 truncate px-3 py-3 text-ink-soft md:table-cell">{gs.map((g) => g.name).join(", ") || <span className="text-muted">None yet</span>}</td>
                    <td className={cx("px-4 py-3 text-right text-[13px] md:px-5", p.missedInARow >= 3 ? "font-medium text-alert" : "text-muted")}>
                      {p.lastSeen ? shortDate(p.lastSeen) : "Not yet"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length > limit && (
            <button onClick={() => setLimit(limit + 20)} className="w-full border-t border-line px-5 py-3.5 text-sm font-medium text-brand hover:bg-brand-soft/50">
              Show more <span className="font-normal text-muted">({limit} of {list.length})</span>
            </button>
          )}
        </div>
      )}
      {picked.size > 0 && (
        <div className="toast fixed inset-x-0 bottom-24 z-40 mx-auto flex w-fit items-center gap-2 rounded-2xl bg-deep p-2 pl-4 text-sm text-white shadow-2xl md:bottom-8">
          <span className="font-medium">{picked.size} selected</span>
          <button onClick={() => setBulkDept(true)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 hover:bg-white/20"><Users size={15} /> Add to department</button>
          <button onClick={() => { const ids = [...picked]; const at = new Date().toISOString(); ids.forEach((id) => updatePerson(id, { inactive: { reason: "other", at } })); setPicked(new Set()); toast(`${ids.length} marked not active`, { undo: () => ids.forEach((id) => updatePerson(id, { inactive: undefined })) }); }} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 hover:bg-white/20"><UserMinus size={15} /> Not active</button>
          <button onClick={() => setPicked(new Set())} className="rounded-xl p-1.5 hover:bg-white/10" aria-label="Clear selection"><X size={16} /></button>
        </div>
      )}
      <JoinersSheet open={joiners} onClose={() => setJoiners(false)} />
      <Sheet open={bulkDept} onClose={() => setBulkDept(false)} title={`Add ${picked.size} people to a department`}>
        <div className="grid gap-2">{state.groups.filter((g) => g.kind === "department").map((g) => (
          <button key={g.id} onClick={() => { picked.forEach((id) => addToGroup(g.id, id)); toast(`${picked.size} added to ${g.name}`); setPicked(new Set()); setBulkDept(false); }} className="rounded-2xl bg-surface px-4 py-3 text-left ring-1 ring-line hover:ring-brand"><b className="block font-medium">{g.name}</b><span className="text-[13px] text-muted">{g.memberIds.length} people</span></button>
        ))}</div>
      </Sheet>
      <Sheet open={dupes} onClose={() => setDupes(false)} title="Possible duplicates">
        <p className="mb-4 text-sm text-ink-soft">These people share a phone number. Keep the right one, and Traqi moves the other&apos;s details, departments and attendance across.</p>
        <div className="space-y-4">{dupGroups.map((g) => (
          <div key={g[0].id} className="rounded-2xl p-3 ring-1 ring-line">
            {g.map((keep) => (
              <div key={keep.id} className="flex items-center gap-3 py-1.5">
                <Avatar person={keep} size={34} /><span className="min-w-0 flex-1"><b className="block truncate text-[14px] font-medium">{fullName(keep)}</b><span className="text-[12px] text-muted">{stageInfo(keep.stage).label} · first visit {shortDate(keep.firstVisit)}</span></span>
                <Button onClick={() => {
                  g.filter((x) => x.id !== keep.id).forEach((other) => {
                    const fill: Partial<Person> = {};
                    (["whatsapp", "email", "birthday", "location", "occupation", "householdId", "anniversary", "photo"] as const).forEach((k) => { if (!keep[k] && other[k]) (fill as Record<string, unknown>)[k] = other[k]; });
                    updatePerson(keep.id, fill);
                    state.groups.filter((x) => x.memberIds.includes(other.id)).forEach((x) => addToGroup(x.id, keep.id));
                    state.attendance.filter((a) => a.personId === other.id).forEach((a) => put("attendance", { ...a, personId: keep.id }));
                    updatePerson(other.id, { inactive: { reason: "other", note: `Merged into ${fullName(keep)}`, at: new Date().toISOString() } });
                  });
                  toast(`Merged into ${keep.firstName}`);
                }}>Keep this one</Button>
              </div>
            ))}
          </div>
        ))}</div>
      </Sheet>
      <Sheet open={sharing} onClose={() => setSharing(false)} title="Ask everyone to update their details">
        <p className="text-ink-soft">Post this link in your church WhatsApp groups or show the code on screen. Each person confirms their phone number, then fills in what&apos;s missing.</p>
        <div className="mt-5 flex justify-center rounded-3xl bg-page p-5"><QR value={typeof location !== "undefined" ? `${location.origin}/update` : "/update"} size={200} /></div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-page p-2 pl-3.5 ring-1 ring-line">
          <span className="flex-1 truncate text-sm">{typeof location !== "undefined" ? `${location.origin}/update` : "/update"}</span>
          <Button onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}/update`); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy"}</Button>
        </div>
        <Link href="/update" className="mt-4 inline-block text-sm font-medium text-brand">See what members see</Link>
      </Sheet>
    </div>
  );
}
