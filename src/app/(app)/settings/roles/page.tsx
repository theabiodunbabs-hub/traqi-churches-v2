"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Check, ChevronRight, Clock, Lock, Plus, ShieldCheck, Sparkles, Trash2, UserPlus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { PERMISSIONS, PERMISSION_SAYS, READY_ROLES, SENSITIVE, roleActive, scopeLabel } from "@/lib/access";
import { Avatar, Button, Field, FieldGroup, PageHeader, Panel, PersonLink, Sheet, Tabs, cx, inputCls } from "@/components/ui";
import { fullName } from "@/lib/format";
import type { Role, Scope } from "@/lib/types";

const AREAS = [...new Set(PERMISSIONS.map((p) => p.area))];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const niceDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

type Tab = "people" | "can" | "details";

export default function Roles() {
  const { state, access } = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("people");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    state.assignments.filter((a) => roleActive(a)).forEach((a) => m.set(a.roleId, (m.get(a.roleId) ?? 0) + 1));
    return m;
  }, [state.assignments]);

  if (!access) return null;
  const canManage = access.isPastoral || access.can("roles.manage");
  const role = state.roles.find((r) => r.id === sel);
  const sorted = [...state.roles].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const open = (id: string) => { setSel(id); setTab("people"); window.scrollTo({ top: 0 }); };

  return (
    <div>
      <PageHeader
        title="Roles"
        sub="A role says what someone can do. Where it applies says for which part of the church."
        actions={canManage && <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> New role</Button>}
      />

      <Approvals />

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* On phones the list and the role take turns; on wide screens they sit side by side. */}
        <ul className={cx("space-y-1.5 lg:sticky lg:top-6 lg:block lg:self-start", role && "hidden")} aria-label="Roles">
          {sorted.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => open(r.id)} aria-current={r.id === role?.id}
                className={cx("flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition",
                  r.id === role?.id ? "bg-surface shadow-sm shadow-brand/10 ring-brand" : "bg-surface/60 ring-line hover:bg-surface")}
              >
                <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-semibold",
                  r.level <= 2 ? "bg-j6 text-white" : r.level <= 4 ? "bg-j3 text-on-light" : "bg-j1 text-on-light")}>{r.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block text-[12.5px] text-muted">{plural(counts.get(r.id) ?? 0, "person", "people")} · {plural(r.permissions.length, "ability", "abilities")}</span>
                </span>
                {!r.isDefault && <span className="rounded-md bg-glow-soft px-1.5 text-[11px] font-medium text-glow-ink">Custom</span>}
                <ChevronRight size={16} className="text-muted lg:hidden" />
              </button>
            </li>
          ))}
        </ul>

        {role ? (
          <div className="min-w-0 space-y-5">
            <button onClick={() => setSel(null)} className="flex items-center gap-1.5 text-sm font-medium text-brand lg:hidden"><ArrowLeft size={15} /> All roles</button>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">{role.name}</h2>
              <p className="mt-1 text-ink-soft">{role.description || "No description yet."}</p>
            </div>
            <Tabs value={tab} onChange={setTab} items={[
              { key: "people", label: "People", count: counts.get(role.id) ?? 0 },
              { key: "can", label: "What they can do" },
              { key: "details", label: "Details" },
            ]} />
            {tab === "people" && <PeopleTab role={role} canManage={canManage} />}
            {tab === "can" && <CanTab role={role} canManage={canManage} />}
            {tab === "details" && <DetailsTab role={role} canManage={canManage} onDeleted={() => setSel(null)} />}
          </div>
        ) : (
          <div className="hidden items-center justify-center rounded-3xl border border-dashed border-line p-10 text-center text-muted lg:flex">
            <div>
              <ShieldCheck size={28} className="mx-auto mb-3 text-brand" />
              <p className="font-medium text-ink">Choose a role</p>
              <p className="mt-1 text-sm">See who holds it, what it allows, and change it.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3 rounded-2xl bg-deep p-5 text-white">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-j2" />
        <div className="text-[14.5px] text-white/80">
          <p className="font-medium text-white">Some things sit outside every role.</p>
          <p className="mt-1">Care notes are for the lead pastor, who can share a single note with the pastor looking after that person. Welfare requests stay with the Welfare head and the pastors. Neither can be downloaded.</p>
        </div>
      </div>

      <NewRole open={creating} onClose={() => setCreating(false)} onMade={open} />
    </div>
  );
}

/** Role changes waiting for the pastor. Pastors approve here; everyone else sees what's waiting. */
function Approvals() {
  const { state, access, approveRoleChange, person } = useStore();
  const waiting = state.assignments.filter((a) => a.pending);
  if (!waiting.length || !access) return null;
  return (
    <Panel className="mb-6 ring-glow/40" title={<span className="flex items-center gap-2"><Clock size={17} className="text-glow-ink" /> Waiting for the pastor ({waiting.length})</span>}>
      <ul className="-mx-2 divide-y divide-line">
        {waiting.map((a) => {
          const role = state.roles.find((r) => r.id === a.roleId);
          const by = person(a.pending!.byId);
          const give = a.pending!.action === "give";
          return (
            <li key={a.personId + a.roleId} className="flex flex-wrap items-center gap-3 px-2 py-3">
              <Avatar person={person(a.personId)} size={36} />
              <div className="min-w-0 flex-1 text-[14.5px]">
                <p><span className="font-medium">{give ? "Give" : "Remove"} {role?.name}</span> {give ? "to" : "from"} {fullName(person(a.personId))}</p>
                <p className="text-[12.5px] text-muted">{scopeLabel(state, a.scope)}{a.until ? ` · until ${niceDate(a.until)}` : ""} · asked by {by ? fullName(by) : "an admin"}</p>
              </div>
              {access.isPastoral ? (
                <div className="flex gap-2">
                  <Button onClick={() => approveRoleChange(a.personId, a.roleId, false)}><X size={15} /> Decline</Button>
                  <Button variant="primary" onClick={() => approveRoleChange(a.personId, a.roleId, true)}><Check size={15} /> Approve</Button>
                </div>
              ) : <span className="rounded-full bg-glow-soft px-2.5 py-1 text-xs font-medium text-glow-ink">Waiting</span>}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function PeopleTab({ role, canManage }: { role: Role; canManage: boolean }) {
  const { state, person, removeAssignment } = useStore();
  const [giving, setGiving] = useState(false);
  const holders = state.assignments.filter((a) => a.roleId === role.id);
  const locked = role.key === "lead";
  const now = Date.now();
  return (
    <Panel title={`Who holds this role`} action={canManage && !locked && <Button variant="primary" onClick={() => setGiving(true)}><UserPlus size={15} /> Give this role</Button>}>
      {holders.length === 0 ? <p className="text-sm text-muted">No one yet.</p> : (
        <ul className="-mx-2 divide-y divide-line">
          {holders.map((a) => {
            const p = person(a.personId);
            const ended = !!a.until && Date.parse(a.until) <= now;
            return (
              <li key={a.personId} className={cx("flex items-center gap-3 px-2 py-3", ended && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <PersonLink person={p} sub={<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {scopeLabel(state, a.scope)}
                    {a.until && <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 text-[11px] font-medium", ended ? "bg-line text-muted" : "bg-j1 text-on-light")}><CalendarClock size={11} />{ended ? "Ended" : "Until"} {niceDate(a.until)}</span>}
                    {a.pending && <span className="rounded-md bg-glow-soft px-1.5 text-[11px] font-medium text-glow-ink">{a.pending.action === "give" ? "Waiting for approval" : "Removal waiting"}</span>}
                  </span>} />
                </div>
                {canManage && !locked && (
                  <button onClick={() => removeAssignment(a.personId, a.roleId)} className="rounded-lg p-2.5 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Remove role from ${fullName(p)}`}>
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <GiveRole open={giving} onClose={() => setGiving(false)} role={role} />
    </Panel>
  );
}

function CanTab({ role, canManage }: { role: Role; canManage: boolean }) {
  const { access, togglePermission } = useStore();
  const locked = role.key === "lead";
  return (
    <Panel>
      {locked && <p className="mb-5 flex items-center gap-2 rounded-xl bg-page px-3 py-2 text-sm text-ink-soft ring-1 ring-line"><Lock size={14} /> The lead pastor can always do everything.</p>}
      <div className="space-y-6">
        {AREAS.map((area) => (
          <fieldset key={area}>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{area}</legend>
            <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
              {PERMISSIONS.filter((p) => p.area === area).map((p) => {
                const on = locked || role.permissions.includes(p.key);
                const sensitive = SENSITIVE.includes(p.key);
                const blocked = !canManage || locked || (sensitive && !access?.isLead);
                return (
                  <li key={p.key} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px]">{p.label}</span>
                      <span className="mt-0.5 block text-[12.5px] text-muted">Can {PERMISSION_SAYS[p.key]}{sensitive && <> · <Lock size={10} className="inline" /> only the lead pastor changes this</>}</span>
                    </span>
                    <Switch on={on} disabled={blocked} label={p.label} onChange={() => togglePermission(role.id, p.key)} />
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </Panel>
  );
}

function DetailsTab({ role, canManage, onDeleted }: { role: Role; canManage: boolean; onDeleted: () => void }) {
  const { state, updateRole, deleteRole } = useStore();
  const [name, setName] = useState(role.name);
  const [desc, setDesc] = useState(role.description);
  const [moveTo, setMoveTo] = useState("");
  const [confirm, setConfirm] = useState(false);
  const holders = state.assignments.filter((a) => a.roleId === role.id).length;
  const changed = name.trim() !== role.name || desc.trim() !== role.description;
  return (
    <div className="space-y-5">
      <Panel>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) updateRole(role.id, { name: name.trim(), description: desc.trim() }); }}>
          <Field label="Name" hint={role.isDefault ? "You can rename built-in roles to match your church, e.g. Resident Pastor." : undefined}>
            <input className={inputCls} value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="What it's for"><textarea rows={3} className={inputCls} value={desc} disabled={!canManage} onChange={(e) => setDesc(e.target.value)} /></Field>
          {canManage && <Button variant="primary" type="submit" disabled={!changed || !name.trim()}>Save</Button>}
        </form>
      </Panel>
      {canManage && (role.isDefault ? (
        <p className="flex items-center gap-2 px-1 text-sm text-muted"><Lock size={14} /> Built-in roles can be renamed and adjusted, but not deleted.</p>
      ) : (
        <Panel title="Delete this role">
          {holders > 0 && (
            <FieldGroup label={`Move the ${plural(holders, "person", "people")} who hold it to`}>
              <select className={inputCls} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">Nobody, just remove it</option>
                {state.roles.filter((r) => r.id !== role.id && r.key !== "lead").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </FieldGroup>
          )}
          {confirm ? (
            <div className="mt-4 flex gap-2">
              <Button onClick={() => setConfirm(false)}>Keep it</Button>
              <Button className="bg-alert text-white ring-0" onClick={() => { deleteRole(role.id, moveTo || undefined); onDeleted(); }}><Trash2 size={15} /> Yes, delete</Button>
            </div>
          ) : <Button className="mt-4 text-alert" onClick={() => setConfirm(true)}><Trash2 size={15} /> Delete role</Button>}
        </Panel>
      ))}
    </div>
  );
}

function Switch({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => !disabled && onChange()}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-brand" : "bg-line", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}
    >
      <span className={cx("absolute top-0.5 size-6 rounded-full bg-surface shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

function NewRole({ open, onClose, onMade }: { open: boolean; onClose: () => void; onMade: (id: string) => void }) {
  const { state, addRole } = useStore();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");
  const close = () => { setName(""); setDesc(""); setErr(""); onClose(); };
  const have = new Set(state.roles.map((r) => r.name.toLowerCase()));
  const ready = READY_ROLES.filter((r) => !have.has(r.name.toLowerCase()));
  const make = () => {
    if (!name.trim()) return setErr("Give the role a name.");
    if (have.has(name.trim().toLowerCase())) return setErr("There's already a role with that name.");
    onMade(addRole(name.trim(), desc.trim())); close();
  };
  return (
    <Sheet open={open} onClose={close} title="New role" footer={<Button variant="primary" className="w-full py-3" onClick={make}>Create role</Button>}>
      <div className="space-y-4">
        {ready.length > 0 && (
          <FieldGroup label="Start from a ready-made role">
            <div className="grid gap-2">
              {ready.map((r) => (
                <button key={r.name} type="button" onClick={() => { onMade(addRole(r.name, r.description, r.permissions, r.level)); close(); }}
                  className="flex items-start gap-3 rounded-xl bg-page px-3.5 py-3 text-left ring-1 ring-line transition hover:ring-brand/50">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-brand" />
                  <span><span className="block text-[14.5px] font-medium">{r.name}</span><span className="block text-[12.5px] text-muted">{r.description}</span></span>
                </button>
              ))}
            </div>
          </FieldGroup>
        )}
        <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted">Or make your own</p>
        <Field label="Role name"><input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Head of protocol" /></Field>
        <Field label="What it's for" hint="You'll choose what it can do next."><textarea rows={3} className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Leads protocol on Sundays and at special programmes" /></Field>
        {err && <p className="text-sm text-alert" role="alert">{err}</p>}
      </div>
    </Sheet>
  );
}

type Where = "church" | "groups" | "branch" | "region";

/** Give a role to one or more people. Built for phones: big targets, buttons pinned to the bottom. */
function GiveRole({ open, onClose, role }: { open: boolean; onClose: () => void; role: Role }) {
  const { state, access, assignRole } = useStore();
  const [q, setQ] = useState("");
  const [who, setWho] = useState<string[]>([]);
  const [where, setWhere] = useState<Where>("church");
  const [groups, setGroups] = useState<string[]>([]);
  const [place, setPlace] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [until, setUntil] = useState("");
  const [err, setErr] = useState("");
  const close = () => { setQ(""); setWho([]); setWhere("church"); setGroups([]); setPlace(""); setTemporary(false); setUntil(""); setErr(""); onClose(); };

  const has = new Set(state.assignments.filter((a) => a.roleId === role.id).map((a) => a.personId));
  const ql = q.trim().toLowerCase();
  const people = state.people.filter((p) => !p.isChild && !p.inactive && !has.has(p.id) && (!ql || fullName(p).toLowerCase().includes(ql)))
    .sort((a, b) => Number(b.isLeader ?? false) - Number(a.isLeader ?? false) || fullName(a).localeCompare(fullName(b))).slice(0, 30);
  const branches = state.church.profile?.branches ?? [];
  const regions = state.church.profile?.regions ?? [];
  const options: { key: Where; label: string }[] = [
    { key: "church", label: "Whole church" },
    { key: "groups", label: "Chosen departments" },
    ...(branches.length ? [{ key: "branch" as const, label: "One branch" }] : []),
    ...(regions.length ? [{ key: "region" as const, label: "One region" }] : []),
  ];
  const toggle = (id: string) => { setWho(who.includes(id) ? who.filter((x) => x !== id) : [...who, id]); setErr(""); };

  const submit = () => {
    if (!who.length) return setErr("Choose at least one person.");
    if (where === "groups" && !groups.length) return setErr("Choose at least one department.");
    if ((where === "branch" || where === "region") && !place) return setErr(`Choose the ${where}.`);
    if (temporary && !until) return setErr("Choose when the role ends.");
    const scope: Scope = where === "church" ? { type: "church" } : where === "groups" ? { type: "groups", groupIds: groups }
      : where === "branch" ? { type: "branch", branchId: place } : { type: "region", regionId: place };
    who.forEach((id) => assignRole(id, role.id, scope, temporary ? until : undefined));
    close();
  };

  return (
    <Sheet open={open} onClose={close} title={`Give the ${role.name} role`} footer={
      <div className="space-y-2">
        {err && <p className="text-sm text-alert" role="alert">{err}</p>}
        {!access?.isPastoral && <p className="text-xs text-muted">The pastor will be asked to approve this.</p>}
        <Button variant="primary" className="w-full py-3" onClick={submit}>{who.length > 1 ? `Give to ${who.length} people` : "Give role"}</Button>
      </div>
    }>
      <div className="space-y-6">
        <FieldGroup label={who.length ? `People (${who.length} chosen)` : "People"}>
          {who.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {who.map((id) => { const p = state.people.find((x) => x.id === id); return (
                <button key={id} type="button" onClick={() => toggle(id)} className="flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pl-1 pr-2.5 text-sm font-medium text-brand">
                  <Avatar person={p} size={22} />{p?.firstName}<X size={13} />
                </button>
              ); })}
            </div>
          )}
          <input type="search" className={inputCls} placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
          <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl ring-1 ring-line">
            {people.length === 0 && <li className="px-3 py-3 text-sm text-muted">No one matches.</li>}
            {people.map((p) => {
              const on = who.includes(p.id);
              return (
                <li key={p.id}>
                  <button type="button" className={cx("flex w-full items-center gap-3 px-3 py-2.5 text-left", on ? "bg-brand-soft" : "hover:bg-page")} onClick={() => toggle(p.id)} aria-pressed={on}>
                    <Avatar person={p} size={30} /><span className="flex-1 text-sm font-medium">{fullName(p)}</span>
                    <span className={cx("flex size-5 items-center justify-center rounded-md ring-1", on ? "bg-brand text-white ring-brand" : "ring-line")}>{on && <Check size={13} />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </FieldGroup>

        <FieldGroup label="Where it applies">
          <div className="grid grid-cols-2 gap-2">
            {options.map((o) => (
              <button key={o.key} type="button" onClick={() => { setWhere(o.key); setPlace(""); setErr(""); }}
                className={cx("rounded-xl px-2 py-3 text-sm ring-1", where === o.key ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{o.label}</button>
            ))}
          </div>
        </FieldGroup>

        {where === "groups" && (
          <div className="flex flex-wrap gap-1.5">
            {state.groups.filter((g) => g.kind === "department").map((g) => {
              const on = groups.includes(g.id);
              return (
                <button key={g.id} type="button" onClick={() => { setGroups(on ? groups.filter((x) => x !== g.id) : [...groups, g.id]); setErr(""); }}
                  className={cx("rounded-full px-3 py-2 text-sm ring-1", on ? "bg-deep text-white ring-deep" : "bg-surface text-ink-soft ring-line")}>{g.name}</button>
              );
            })}
          </div>
        )}
        {(where === "branch" || where === "region") && (
          <select className={inputCls} value={place} onChange={(e) => { setPlace(e.target.value); setErr(""); }} aria-label={`Choose the ${where}`}>
            <option value="">Choose…</option>
            {(where === "branch" ? branches : regions).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        <div className="rounded-2xl bg-page p-4 ring-1 ring-line">
          <div className="flex items-center gap-3">
            <span className="flex-1"><span className="block text-[15px] font-medium">For a set time</span><span className="block text-[12.5px] text-muted">For example, acting head while someone travels. It ends on its own.</span></span>
            <Switch on={temporary} label="For a set time" onChange={() => setTemporary(!temporary)} />
          </div>
          {temporary && <Field label="Ends on"><input type="date" className={cx(inputCls, "mt-3")} value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setUntil(e.target.value); setErr(""); }} /></Field>}
        </div>
      </div>
    </Sheet>
  );
}

