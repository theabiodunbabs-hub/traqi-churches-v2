"use client";

import { useState } from "react";
import { ArrowRightLeft, Pencil, Plane, Sparkles, Trash2, UserPlus, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { followSettings, teamLoad } from "@/lib/metrics";
import { fullName } from "@/lib/format";
import { Avatar, Button, Field, FieldGroup, Panel, Sheet, Toggle, cx, inputCls, toast } from "./ui";
import type { Assistant, AssistantPerm, Group } from "@/lib/types";

export const ASSISTANT_PERMS: { key: AssistantPerm; label: string; hint: string; followupOnly?: boolean }[] = [
  { key: "people.edit", label: "Update people's details", hint: "Edit details of people in this department" },
  { key: "people.manage", label: "Add and remove people", hint: "Manage who is in the department and its units" },
  { key: "rollcall", label: "Take roll call", hint: "Mark who served or attended" },
  { key: "message", label: "Send messages", hint: "Message the department" },
  { key: "followup.assign", label: "Assign first-timers", hint: "Choose who follows up whom", followupOnly: true },
  { key: "followup.reports", label: "See follow-up reports", hint: "Team numbers and who is behind", followupOnly: true },
];

const TITLE_IDEAS: Record<string, string[]> = {
  media: ["Live stream", "Photography", "Projection", "Social media"],
  followup: ["Assignments", "Reports", "Calls", "Visits"],
  ushering: ["Seating", "Offering", "Protocol"],
  welfare: ["Visits", "Requests"],
  children: ["Check-in", "Teachers"],
};

/** Who can appoint assistants: the department's head, or pastors and staff who manage departments church-wide. */
export function useCanAppoint(g: Group) {
  const { me, access } = useStore();
  if (!me || !access) return false;
  return g.leaderIds.includes(me.id) || access.isPastoral || access.perms.get("groups.manage") === "church";
}

export function AssistantsPanel({ group: g }: { group: Group }) {
  const { person, updateGroup } = useStore();
  const canAppoint = useCanAppoint(g);
  const [editing, setEditing] = useState<Assistant | "new" | null>(null);
  const list = g.assistants ?? [];
  if (!canAppoint && list.length === 0) return null;
  return (
    <Panel title={`Assistants${list.length ? ` (${list.length})` : ""}`} action={canAppoint && <Button onClick={() => setEditing("new")}><UserPlus size={15} /> Add assistant</Button>}>
      {list.length === 0 ? (
        <p className="text-sm text-ink-soft">Assistants help the head run {g.name}. Give each one a title, like &ldquo;{g.name} assistant: {(TITLE_IDEAS[g.tags?.[0] ?? ""] ?? ["Rotas"])[0]}&rdquo;, and choose what they can do.</p>
      ) : (
        <ul className="-mx-2 divide-y divide-line">
          {list.map((a) => {
            const p = person(a.personId);
            return (
              <li key={a.personId} className="flex items-center gap-3 px-2 py-3">
                <Avatar person={p} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{fullName(p)}</p>
                  <p className="truncate text-[12.5px] text-muted">{a.title || "Assistant"} · {a.perms.length ? a.perms.map((k) => ASSISTANT_PERMS.find((x) => x.key === k)?.label.toLowerCase()).join(", ") : "view only"}</p>
                </div>
                {canAppoint && (
                  <>
                    <button onClick={() => setEditing(a)} className="rounded-lg p-2.5 text-muted hover:bg-page hover:text-ink" aria-label={`Edit ${fullName(p)}`}><Pencil size={15} /></button>
                    <button onClick={() => updateGroup(g.id, { assistants: list.filter((x) => x.personId !== a.personId) })} className="rounded-lg p-2.5 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Remove ${fullName(p)} as assistant`}><Trash2 size={15} /></button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editing && <AssistantSheet group={g} current={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function AssistantSheet({ group: g, current, onClose }: { group: Group; current?: Assistant; onClose: () => void }) {
  const { state, person, updateGroup } = useStore();
  const [who, setWho] = useState(current?.personId ?? "");
  const [title, setTitle] = useState(current?.title ?? `${g.name} assistant: `);
  const [perms, setPerms] = useState<AssistantPerm[]>(current?.perms ?? ["rollcall"]);
  const [err, setErr] = useState("");
  const isFollow = !!g.tags?.includes("followup");
  const units = state.groups.filter((u) => u.parentId === g.id);
  const pool = [...new Set([...g.memberIds, ...units.flatMap((u) => u.memberIds)])].filter((id) => !g.leaderIds.includes(id) && !(g.assistants ?? []).some((a) => a.personId === id && a.personId !== current?.personId));
  const ideas = TITLE_IDEAS[g.tags?.[0] ?? ""] ?? [];
  const save = () => {
    if (!who) return setErr("Choose someone from the department.");
    const t = title.trim().replace(/:\s*$/, "");
    const next = [...(g.assistants ?? []).filter((a) => a.personId !== (current?.personId ?? who)), { personId: who, title: t, perms }];
    updateGroup(g.id, { assistants: next });
    toast(`${person(who)?.firstName} is now ${t || "an assistant"}`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={current ? "Edit assistant" : "Add an assistant"} footer={<div className="space-y-2">{err && <p className="text-sm text-alert" role="alert">{err}</p>}<Button variant="primary" className="w-full py-3" onClick={save}>Save</Button></div>}>
      <div className="space-y-5">
        <Field label="Who" hint={pool.length ? undefined : `Add people to ${g.name} first.`}>
          <select className={inputCls} value={who} disabled={!!current} onChange={(e) => { setWho(e.target.value); setErr(""); }}>
            <option value="">Choose…</option>
            {pool.map((id) => <option key={id} value={id}>{fullName(person(id))}</option>)}
          </select>
        </Field>
        <Field label="Title" hint="Shown on their profile and home page.">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {ideas.length > 0 && (
          <div className="-mt-3 flex flex-wrap gap-1.5">
            {ideas.map((i) => <button key={i} type="button" onClick={() => setTitle(`${g.name} assistant: ${i}`)} className="rounded-full bg-page px-2.5 py-1 text-[12.5px] text-ink-soft ring-1 ring-line hover:text-ink">{i}</button>)}
          </div>
        )}
        <FieldGroup label="What they can do">
          <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
            {ASSISTANT_PERMS.filter((x) => !x.followupOnly || isFollow).map((x) => (
              <li key={x.key} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1"><span className="block text-[15px]">{x.label}</span><span className="block text-[12.5px] text-muted">{x.hint}</span></span>
                <Toggle label={x.label} on={perms.includes(x.key)} onChange={(v) => setPerms(v ? [...perms, x.key] : perms.filter((k) => k !== x.key))} />
              </li>
            ))}
          </ul>
        </FieldGroup>
      </div>
    </Sheet>
  );
}

/** Follow-up team settings and load: auto-assign, the limit, same-gender matching, who's away, handover. */
export function FollowupPanel({ group: g }: { group: Group }) {
  const { state, me, access, updateGroup, updatePerson, handOver } = useStore();
  const cfg = followSettings(state);
  const team = teamLoad(state);
  const [handing, setHanding] = useState<string | null>(null);
  const canSet = !!me && (g.leaderIds.includes(me.id) || !!access?.isPastoral);
  const set = (patch: Partial<NonNullable<Group["followup"]>>) => updateGroup(g.id, { followup: { auto: cfg.auto, limit: cfg.limit, sameGender: cfg.sameGender, ...patch } });
  const full = team.filter((t) => t.full && !t.away).length;
  const free = team.filter((t) => t.ok).length;

  return (
    <Panel title="Follow-up team" action={<span className="text-xs text-muted">{free} can take more · {full} full</span>}>
      {canSet && (
        <ul className="mb-5 divide-y divide-line rounded-2xl ring-1 ring-line">
          <li className="flex items-center gap-3 px-4 py-3">
            <Sparkles size={17} className="shrink-0 text-brand" />
            <span className="flex-1"><span className="block text-[15px]">Assign first-timers automatically</span><span className="block text-[12.5px] text-muted">To whoever has the fewest open, nearest area first</span></span>
            <Toggle label="Assign automatically" on={cfg.auto} onChange={(v) => set({ auto: v })} />
          </li>
          <li className="flex items-center gap-3 px-4 py-3">
            <Users size={17} className="shrink-0 text-brand" />
            <span className="flex-1"><span className="block text-[15px]">Most open at once, per person</span><span className="block text-[12.5px] text-muted">When everyone reaches this, you&apos;ll be told</span></span>
            <div className="flex items-center gap-1">
              <button className="size-9 rounded-lg bg-page text-lg ring-1 ring-line disabled:opacity-40" disabled={cfg.limit <= 1} onClick={() => set({ limit: cfg.limit - 1 })} aria-label="Fewer">−</button>
              <span className="w-8 text-center font-display text-lg font-semibold tabular-nums">{cfg.limit}</span>
              <button className="size-9 rounded-lg bg-page text-lg ring-1 ring-line" onClick={() => set({ limit: cfg.limit + 1 })} aria-label="More">+</button>
            </div>
          </li>
          <li className="flex items-center gap-3 px-4 py-3">
            <Users size={17} className="shrink-0 text-brand" />
            <span className="flex-1"><span className="block text-[15px]">Match men with men, women with women</span><span className="block text-[12.5px] text-muted">When someone of the same gender is free</span></span>
            <Toggle label="Same-gender matching" on={cfg.sameGender} onChange={(v) => set({ sameGender: v })} />
          </li>
        </ul>
      )}
      <ul className="-mx-2 divide-y divide-line">
        {team.map((t) => (
          <li key={t.person.id} className={cx("flex items-center gap-3 px-2 py-2.5", t.away && "opacity-60")}>
            <Avatar person={t.person} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium">{fullName(t.person)}</p>
              <p className="text-[12.5px] text-muted">{t.away ? "Away, not getting new first-timers" : t.full ? `Full (${t.open} of ${cfg.limit})` : `${t.open} of ${cfg.limit} open`}{t.person.location ? ` · ${t.person.location}` : ""}</p>
            </div>
            <span className="hidden gap-0.5 sm:flex" aria-hidden>
              {Array.from({ length: cfg.limit }).map((_, i) => <span key={i} className={cx("h-5 w-1.5 rounded-full", i < t.open ? (t.full ? "bg-alert" : "bg-j4") : "bg-line")} />)}
            </span>
            {canSet && (
              <>
                <button onClick={() => updatePerson(t.person.id, { unavailable: !t.away })} className={cx("rounded-lg p-2.5", t.away ? "bg-glow-soft text-glow-ink" : "text-muted hover:bg-page")} aria-label={t.away ? `Mark ${t.person.firstName} back` : `Mark ${t.person.firstName} away`} title={t.away ? "Back" : "Away"}><Plane size={15} /></button>
                {t.open > 0 && <button onClick={() => setHanding(t.person.id)} className="rounded-lg p-2.5 text-muted hover:bg-page hover:text-ink" aria-label={`Hand over ${t.person.firstName}'s follow-ups`} title="Hand over"><ArrowRightLeft size={15} /></button>}
              </>
            )}
          </li>
        ))}
      </ul>
      {handing && <HandOver fromId={handing} onClose={() => setHanding(null)} onDone={(n) => { toast(`${n} follow-up${n === 1 ? "" : "s"} handed over`); setHanding(null); }} handOver={handOver} />}
    </Panel>
  );
}

function HandOver({ fromId, onClose, onDone, handOver }: { fromId: string; onClose: () => void; onDone: (n: number) => void; handOver: (from: string, to?: string) => number }) {
  const { state, person } = useStore();
  const [to, setTo] = useState("");
  const from = person(fromId);
  const open = state.cases.filter((c) => c.assigneeId === fromId && ["new", "contacted", "visited"].includes(c.stage)).length;
  const others = teamLoad(state).filter((t) => t.person.id !== fromId && !t.away);
  return (
    <Sheet open onClose={onClose} title={`Hand over ${from?.firstName}'s follow-ups`} footer={<Button variant="primary" className="w-full py-3" onClick={() => onDone((handOver(fromId, to || undefined), open))}>Hand over {open}</Button>}>
      <p className="mb-4 text-sm text-ink-soft">{from?.firstName} has {open} open. They&apos;ll be marked away so they don&apos;t get new ones.</p>
      <Field label="Give them to">
        <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Share them out automatically</option>
          {others.map((t) => <option key={t.person.id} value={t.person.id}>{fullName(t.person)} ({t.open} open)</option>)}
        </select>
      </Field>
    </Sheet>
  );
}

/** Extra department settings: WhatsApp group and joining requirements. */
export function DeptExtras({ group: g, onChange }: { group: Group; onChange: (patch: Partial<Group>) => void }) {
  const { state } = useStore();
  const programmes = state.programmes ?? [];
  return (
    <div className="space-y-4">
      <Field label="WhatsApp group link" hint="Members of this department see a Join button.">
        <input className={inputCls} inputMode="url" placeholder="https://chat.whatsapp.com/…" defaultValue={g.whatsapp ?? ""} onBlur={(e) => onChange({ whatsapp: e.target.value.trim() || undefined })} />
      </Field>
      <Field label="Before joining, people must have finished" hint="Optional. People who haven't can still ask, and you decide.">
        <select className={inputCls} defaultValue={g.requiresClassId ?? ""} onChange={(e) => onChange({ requiresClassId: e.target.value || undefined })}>
          <option value="">Nothing in particular</option>
          {programmes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
    </div>
  );
}
