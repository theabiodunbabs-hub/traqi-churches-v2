"use client";

import { goneQuiet } from "@/lib/metrics";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeft, Pencil, Plus, Search, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Button, Empty, Field, Panel, PersonLink, Sheet, StageChip, cx, inputCls } from "@/components/ui";
import { holdersOf } from "@/lib/metrics";
import { AssistantsPanel, DeptExtras, FollowupPanel } from "@/components/department-extras";
import { DownloadButton } from "@/components/download";
import { canDownloadGroup, departmentDownload } from "@/lib/exports";
import type { Group } from "@/lib/types";
import { ReachOut, ReasonTag, messages } from "@/components/care";
import { daysToBirthday, fullName, shortDate } from "@/lib/format";

export default function Department() {
  const { id } = useParams<{ id: string }>();
  const { state, access, person, addToGroup } = useStore();
  const [filter, setFilter] = useState<"all" | "leaders" | "quiet">("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const g = state.groups.find((x) => x.id === id);
  const data = useMemo(() => {
    if (!g) return null;
    const units = state.groups.filter((u) => u.parentId === g.id);
    const supervised = state.groups.filter((u) => u.supervisorId === g.id);
    const ids = [...new Set([...g.memberIds, ...units.flatMap((u) => u.memberIds)])];
    const members = ids.map((m) => person(m)!).filter(Boolean);
    const unitOf = (pid: string) => units.find((u) => u.memberIds.includes(pid))?.name;
    const birthdays = members.filter((m) => { const d = daysToBirthday(m.birthday); return d !== null && d <= 30; });
    return { units, supervised, members, unitOf, birthdays, quiet: goneQuiet(members) };
  }, [g, state.groups, person]);

  if (!access) return null;
  if (!g || !data) return <Empty title="Department not found" body="It may have been renamed or removed." action={<Link href="/departments" className="text-brand">Back to departments</Link>} />;

  const parent = state.groups.find((x) => x.id === g.parentId);
  const supervisor = state.groups.find((x) => x.id === g.supervisorId);
  const overseer = person(g.overseerId);
  const canManage = access.can("groups.manage", { groupId: g.id });
  const canView = access.can("people.view", { groupId: g.id }) || access.can("people.view");

  const shown = data.members.filter((m) =>
    filter === "all" ? true : filter === "leaders" ? g.leaderIds.includes(m.id) : m.tracked && m.missedInARow >= 3);

  return (
    <div>
      <Link href={parent ? `/departments/${parent.id}` : "/departments"} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ChevronLeft size={16} /> {parent ? parent.name : "All departments"}
      </Link>

      <header className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand">{g.kind === "unit" ? `Unit of ${parent?.name}` : "Department"}</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-tight tracking-tight md:text-[38px]">{g.name}</h1>
          <p className="mt-2 text-[16px] text-ink-soft">{g.purpose}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {g.leaderIds.map((l) => <PersonLink key={l} person={person(l)} sub="Leader" size={32} />)}
            {overseer && <PersonLink person={overseer} sub="Overseeing pastor" size={32} />}
            {supervisor && <span className="text-ink-soft">Supervised by <Link className="font-medium text-ink hover:text-brand" href={`/departments/${supervisor.id}`}>{supervisor.name}</Link></span>}
          </div>
        </div>
        {(canManage || canDownloadGroup(state, access, g.id)) && (
          <div className="flex flex-wrap gap-2">
            {canDownloadGroup(state, access, g.id) && <DownloadButton what={g.name} sheets={() => departmentDownload(state, access, g.id)} />}
            {canManage && <Button onClick={() => setEditing(true)}><Pencil size={15} /> Edit</Button>}
            {canManage && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} /> Add a person</Button>}
          </div>
        )}
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile n={data.members.length} label="people serving" />
        <Tile n={g.leaderIds.length} label={g.leaderIds.length === 1 ? "leader" : "leaders"} />
        <Tile n={data.quiet.length} label="gone quiet" warn={data.quiet.length > 0} />
        <Tile n={data.birthdays.length} label="birthdays in 30 days" glow />
      </div>

      {(data.units.length > 0 || data.supervised.length > 0) && (
        <section className="mb-6">
          <h2 className="mb-3 font-display text-[17px] font-semibold">{data.units.length ? "Units" : "Departments it supervises"}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...data.units, ...data.supervised].map((u) => (
              <Link key={u.id} href={`/departments/${u.id}`} className="group rounded-2xl bg-surface p-4 ring-1 ring-line transition hover:ring-brand/40">
                <div className="flex items-center justify-between">
                  <p className="font-medium group-hover:text-brand">{u.name}</p>
                  <span className="flex items-center gap-1 text-sm text-muted"><Users size={14} />{u.memberIds.length}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-[13px] text-ink-soft">{u.purpose}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Panel
        title="People"
        action={
          <div className="flex gap-1.5">
            {([["all", "Everyone"], ["leaders", "Leaders"], ["quiet", "Gone quiet"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                className={cx("rounded-full px-3 py-1.5 text-sm", filter === k ? "bg-deep text-white" : "bg-page text-ink-soft hover:text-ink")}>{l}</button>
            ))}
          </div>
        }
      >
        {!canView ? (
          <p className="text-sm text-ink-soft">You can see this department&apos;s summary, but not the people in it.</p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No one here.</p>
        ) : (
          <ul className="-mx-2 divide-y divide-line">
            {shown.map((m) => {
              const contacts = access.canSeeContacts(m);
              return (
                <li key={m.id} className="flex items-center gap-3 px-2 py-3">
                  <div className="min-w-0 flex-1">
                    <PersonLink person={m} sub={[data.unitOf(m.id), contacts ? m.phone : null].filter(Boolean).join(" · ") || m.location} />
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    {g.leaderIds.includes(m.id) && <ReasonTag tone="brand">{g.kind === "unit" ? "Unit head" : "Department head"}</ReasonTag>}
                    {m.tracked && m.missedInARow >= 3 && <ReasonTag tone="alert">Missed {m.missedInARow}</ReasonTag>}
                    <StageChip stage={m.stage} />
                  </div>
                  <span className="hidden w-20 text-right text-[13px] text-muted md:block">{m.lastSeen ? shortDate(m.lastSeen) : ""}</span>
                  <ReachOut person={m} compact canContact={contacts} message={m.missedInARow >= 3 ? messages.absent(m, state.church.name) : `Hello ${m.firstName}, `} />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {g.tags?.includes("followup") && <div id="followup" className="lg:col-span-2"><FollowupPanel group={g} /></div>}
        <AssistantsPanel group={g} />
        {g.whatsapp && (
          <a href={g.whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-3 self-start rounded-2xl bg-[#25D366]/12 p-4 ring-1 ring-[#25D366]/40">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#25D366] text-white"><Users size={18} /></span>
            <span><span className="block font-medium">{g.name} WhatsApp group</span><span className="block text-[13px] text-muted">Open the group chat</span></span>
          </a>
        )}
      </div>

      {editing && <EditGroup group={g} members={data.members.map((m) => m.id)} onClose={() => setEditing(false)} />}
      <AddToGroup open={adding} onClose={() => setAdding(false)} groupName={g.name} existing={g.memberIds}
        onPick={(pid) => { addToGroup(g.id, pid); }} />
    </div>
  );
}

function Tile({ n, label, warn, glow }: { n: number; label: string; warn?: boolean; glow?: boolean }) {
  return (
    <div className={cx("rounded-2xl p-4 ring-1", warn ? "bg-alert-soft ring-alert/10" : glow ? "bg-glow-soft ring-glow/20" : "bg-surface ring-line")}>
      <p className={cx("num text-3xl font-semibold", warn && "text-alert", glow && "text-glow-ink")}>{n}</p>
      <p className="mt-0.5 text-[13px] text-ink-soft">{label}</p>
    </div>
  );
}

function AddToGroup({ open, onClose, groupName, existing, onPick }: { open: boolean; onClose: () => void; groupName: string; existing: string[]; onPick: (id: string) => void }) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const list = state.people
    .filter((p) => !p.isChild && !existing.includes(p.id) && !added.includes(p.id))
    .filter((p) => !q || fullName(p).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 30);
  return (
    <Sheet open={open} onClose={() => { onClose(); setQ(""); setAdded([]); }} title={`Add to ${groupName}`}>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input autoFocus className={cx(inputCls, "pl-10")} placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {added.length > 0 && <p className="mb-3 rounded-xl bg-good-soft px-3 py-2 text-sm text-good">Added {added.length} {added.length === 1 ? "person" : "people"}.</p>}
      <ul className="divide-y divide-line">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Avatar person={p} size={34} />
            <span className="flex-1"><span className="block font-medium">{fullName(p)}</span><span className="block text-xs text-muted">{p.location}</span></span>
            <Button onClick={() => { onPick(p.id); setAdded([...added, p.id]); }}>Add</Button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function EditGroup({ group, members, onClose }: { group: Group; members: string[]; onClose: () => void }) {
  const { state, person, updateGroup, addUnit } = useStore();
  const [name, setName] = useState(group.name);
  const [purpose, setPurpose] = useState(group.purpose);
  const [leader, setLeader] = useState(group.leaderIds[0] ?? "");
  const [overseer, setOverseer] = useState(group.overseerId ?? "");
  const [unit, setUnit] = useState("");
  const [unitPurpose, setUnitPurpose] = useState("");
  const [err, setErr] = useState("");
  const pastors = [...holdersOf(state, "pastor"), ...holdersOf(state, "lead")];
  const candidates = [...new Set([...group.leaderIds, ...members])];
  return (
    <Sheet open onClose={onClose} title={`Edit ${group.name}`}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setErr("Give it a name.");
        updateGroup(group.id, { name: name.trim(), purpose: purpose.trim(), leaderIds: leader ? [leader, ...group.leaderIds.filter((x) => x !== leader).slice(1)] : group.leaderIds, overseerId: overseer || undefined });
        onClose();
      }}>
        <Field label="Name"><input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} /></Field>
        <Field label="What it does"><textarea rows={2} className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
        <Field label={group.kind === "unit" ? "Unit head" : "Department head"}>
          <select className={inputCls} value={leader} onChange={(e) => setLeader(e.target.value)}>
            <option value="">No one yet</option>
            {candidates.map((id) => <option key={id} value={id}>{fullName(person(id))}</option>)}
          </select>
        </Field>
        {group.kind === "department" && (
          <Field label="Overseeing pastor">
            <select className={inputCls} value={overseer} onChange={(e) => setOverseer(e.target.value)}>
              <option value="">No one yet</option>
              {[...new Set(pastors)].map((id) => <option key={id} value={id}>Pastor {fullName(person(id))}</option>)}
            </select>
          </Field>
        )}
        {group.kind === "department" && <DeptExtras group={group} onChange={(patch) => updateGroup(group.id, patch)} />}
        {err && <p className="text-sm text-alert" role="alert">{err}</p>}
        <Button variant="primary" type="submit" className="w-full py-3">Save changes</Button>
      </form>

      {group.kind === "department" && (
        <div className="mt-8 border-t border-line pt-6">
          <p className="font-display text-[17px] font-semibold">Add a unit</p>
          <p className="mb-3 text-sm text-ink-soft">Units are smaller teams inside {group.name}, each with its own head.</p>
          <div className="space-y-2">
            <input className={inputCls} placeholder="Drama" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <input className={inputCls} placeholder="What the unit does" value={unitPurpose} onChange={(e) => setUnitPurpose(e.target.value)} />
            <Button className="w-full" onClick={() => { if (unit.trim()) { addUnit(group.id, unit.trim(), unitPurpose.trim()); setUnit(""); setUnitPurpose(""); } }}><Plus size={15} /> Add unit</Button>
          </div>
          {state.groups.filter((x) => x.parentId === group.id).length > 0 && (
            <p className="mt-3 text-sm text-muted">Current units: {state.groups.filter((x) => x.parentId === group.id).map((x) => x.name).join(", ")}</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
