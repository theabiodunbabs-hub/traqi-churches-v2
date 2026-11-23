"use client";

import { useState } from "react";
import { ArrowRightLeft, CalendarDays, Pencil, Plane, Plus, Sparkles, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { followSettings, followTeam, isFollowLead, teamLoad } from "@/lib/metrics";
import { fullName } from "@/lib/format";
import { meetingMode, nextDate, rsvpId, rsvpsFor } from "@/lib/event-mgmt";
import { Avatar, Button, Field, FieldGroup, Panel, Sheet, Toggle, cx, inputCls, toast } from "./ui";
import type { Assistant, AssistantPerm, DeptMeeting, Group } from "@/lib/types";

export const ASSISTANT_PERMS: { key: AssistantPerm; label: string; hint: string; followupOnly?: boolean; only?: string[] }[] = [
  { key: "people.edit", label: "Update people's details", hint: "Edit details of people in this department" },
  { key: "people.manage", label: "Add and remove people", hint: "Manage who is in the department and its units" },
  { key: "rollcall", label: "Take roll call", hint: "Mark who served or attended" },
  { key: "message", label: "Send messages", hint: "Message the department" },
  { key: "followup.assign", label: "Assign first-timers", hint: "Choose who follows up whom", followupOnly: true },
  { key: "followup.reports", label: "See follow-up reports", hint: "Team numbers and who is behind", followupOnly: true },
  { key: "headcount", label: "Take the headcount", hint: "Count men, women and children at services", only: ["ushering"] },
  { key: "checkin", label: "Run check-in", hint: "Check-in codes and the check-in screen", only: ["media", "followup"] },
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
                    <button type="button" onClick={() => setEditing(a)} className="rounded-lg p-2.5 text-muted hover:bg-page hover:text-ink" aria-label={`Edit ${fullName(p)}`}><Pencil size={15} /></button>
                    <button type="button" onClick={() => updateGroup(g.id, { assistants: list.filter((x) => x.personId !== a.personId) })} className="rounded-lg p-2.5 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Remove ${fullName(p)} as assistant`}><Trash2 size={15} /></button>
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
  const canSet = !!me && (isFollowLead(state, { personId: me.id }) || !!access?.isPastoral);
  const set = (patch: Partial<NonNullable<Group["followup"]>>) => updateGroup(g.id, { followup: { auto: false, limit: cfg.limit, sameGender: cfg.sameGender, team: g.followup?.team ?? followTeam(state), ...patch } });
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const teamIds = followTeam(state);
  const candidates = state.people.filter((p) => !p.isChild && !p.inactive && !teamIds.includes(p.id) && (!q.trim() || fullName(p).toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => Number(b.stage === "leader" || b.stage === "worker") - Number(a.stage === "leader" || a.stage === "worker") || fullName(a).localeCompare(fullName(b))).slice(0, 25);
  const full = team.filter((t) => t.full && !t.away).length;
  const free = team.filter((t) => t.ok).length;

  return (
    <Panel title="Follow-up team" action={canSet ? <Button className="py-1.5 text-[13px]" onClick={() => setAdding(true)}><UserPlus size={14} /> Add to team</Button> : <span className="text-xs text-muted">{free} can take more · {full} full</span>}>
      <p className="mb-4 text-[13.5px] text-ink-soft">Only people on this team can be given first-timers to follow up. Nobody is assigned automatically: the follow-up head chooses. {free} can take more · {full} full.</p>
      {canSet && (
        <ul className="mb-5 divide-y divide-line rounded-2xl ring-1 ring-line">
          <li className="flex items-center gap-3 px-4 py-3">
            <Users size={17} className="shrink-0 text-brand" />
            <span className="flex-1"><span className="block text-[15px]">Most open at once, per person</span><span className="block text-[12.5px] text-muted">When everyone reaches this, you&apos;ll be told</span></span>
            <div className="flex items-center gap-1">
              <button type="button" className="size-9 rounded-lg bg-page text-lg ring-1 ring-line disabled:opacity-40" disabled={cfg.limit <= 1} onClick={() => set({ limit: cfg.limit - 1 })} aria-label="Fewer">−</button>
              <span className="w-8 text-center font-display text-lg font-semibold tabular-nums">{cfg.limit}</span>
              <button type="button" className="size-9 rounded-lg bg-page text-lg ring-1 ring-line" onClick={() => set({ limit: cfg.limit + 1 })} aria-label="More">+</button>
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
                <button type="button" onClick={() => updatePerson(t.person.id, { unavailable: !t.away })} className={cx("rounded-lg p-2.5", t.away ? "bg-glow-soft text-glow-ink" : "text-muted hover:bg-page")} aria-label={t.away ? `Mark ${t.person.firstName} back` : `Mark ${t.person.firstName} away`} title={t.away ? "Back" : "Away"}><Plane size={15} /></button>
                {t.open === 0 && <button type="button" onClick={() => set({ team: teamIds.filter((x) => x !== t.person.id) })} className="rounded-lg p-2.5 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Take ${t.person.firstName} off the team`} title="Take off the team"><UserMinus size={16} /></button>}
                {t.open > 0 && <button type="button" onClick={() => setHanding(t.person.id)} className="rounded-lg p-2.5 text-muted hover:bg-page hover:text-ink" aria-label={`Hand over ${t.person.firstName}'s follow-ups`} title="Hand over"><ArrowRightLeft size={15} /></button>}
              </>
            )}
          </li>
        ))}
      </ul>
      <Sheet open={adding} onClose={() => { setAdding(false); setQ(""); }} title="Add to the follow-up team">
        <p className="mb-3 text-[13.5px] text-ink-soft">Anyone in the church can be on the team. Members of Follow-up, Membership Ministry and leaders are good choices.</p>
        <input type="search" className={inputCls} placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        <ul className="mt-3 divide-y divide-line">{candidates.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Avatar person={p} size={34} /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{fullName(p)}</span><span className="block text-[12.5px] text-muted">{p.location ?? ""}</span></span>
            <Button className="py-1.5 text-[13px]" onClick={() => { set({ team: [...teamIds, p.id] }); toast(`${p.firstName} is on the follow-up team`); }}>Add</Button>
          </li>
        ))}</ul>
      </Sheet>
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

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** "Every Saturday, 4:00 PM" or "Sat 23 Nov, 4:00 PM". */
export function meetingWhen(m: DeptMeeting) {
  const t = (() => { const [h, mi] = m.time.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; })();
  if (m.kind === "programme" && m.date) return `${new Date(`${m.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${t}`;
  return `${m.every === "fortnight" ? "Every other" : m.every === "month" ? "Monthly," : "Every"} ${DAYS[m.weekday ?? 6]}, ${t}`;
}
/** Upcoming one-off programmes and regular meetings, soonest first. */
export function upcomingMeetings(g: Group) {
  const today = new Date().toISOString().slice(0, 10);
  return (g.meetings ?? []).filter((m) => m.kind === "regular" || (m.date ?? "") >= today).sort((a, b) => (a.kind === "programme" ? 0 : 1) - (b.kind === "programme" ? 0 : 1) || (a.date ?? "").localeCompare(b.date ?? ""));
}

/** The head or an assistant adds the department's regular meetings and one-off programmes. */
export function DeptMeetings({ group: g, canEdit }: { group: Group; canEdit: boolean }) {
  const { state, me, updateGroup, put } = useStore();
  const [f, setF] = useState<DeptMeeting | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const list = upcomingMeetings(g);
  const inDept = !!me && (g.memberIds.includes(me.id) || g.leaderIds.includes(me.id));
  if (!canEdit && !list.length) return null;
  const save = () => {
    if (!f || f.title.trim().length < 2) return;
    const rest = (g.meetings ?? []).filter((m) => m.id !== f.id);
    // Stamping the change tells every member again (their notice and "Will you be there?" come back)
    updateGroup(g.id, { meetings: [...rest, { ...f, title: f.title.trim(), mode: f.mode ?? meetingMode(f), updatedAt: new Date().toISOString(), byId: me?.id }] });
    setF(null); toast("Saved. Everyone in the department has been notified.");
  };
  const nameOf = (id: string) => { const p = state.people.find((x) => x.id === id); return p ? `${p.firstName} ${p.lastName}` : ""; };
  return (
    <Panel title={<span id="meetings">Meetings and programmes</span>} action={canEdit && <Button onClick={() => setF({ id: `dm${Date.now().toString(36)}`, title: "", kind: "regular", weekday: 6, every: "week", time: "16:00", mode: "physical" })}><Plus size={15} /> Add</Button>}>
      {list.length === 0 ? <p className="text-sm text-muted">Add your regular meeting, a one-off programme or an impromptu meeting. Everyone in {g.name} is notified and can say whether they&apos;ll be there.</p> : (
        <ul className="divide-y divide-line">{list.map((m) => {
          const date = nextDate(m);
          const ans = date ? rsvpsFor(state, "dept", m.id, date) : null;
          const mine = date && me ? state.rsvps.find((r) => r.id === rsvpId("dept", m.id, date, me.id)) : undefined;
          const mode = meetingMode(m);
          return (
            <li key={m.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl", m.kind === "programme" ? "bg-glow-soft text-glow-ink" : "bg-brand-soft text-brand")}><CalendarDays size={18} /></span>
                <span className="min-w-[10rem] flex-1"><b className="block font-medium">{m.title}</b><span className="text-[13px] text-muted">{meetingWhen(m)} · {mode === "virtual" ? "Online" : mode === "hybrid" ? "In person and online" : "In person"}{m.venue && mode !== "virtual" ? ` · ${m.venue}` : ""}</span>
                  {m.link && mode !== "physical" && <a href={m.link} target="_blank" rel="noreferrer" className="block text-[13px] font-medium text-brand">Join online</a>}
                  {m.notes && <span className="block text-[13px] text-ink-soft">{m.notes}</span>}</span>
                {canEdit && <><Button className="py-1.5 text-[13px]" onClick={() => setF(m)}>Edit</Button><button type="button" onClick={() => updateGroup(g.id, { meetings: (g.meetings ?? []).filter((x) => x.id !== m.id) })} className="rounded-lg p-2 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Remove ${m.title}`}><Trash2 size={15} /></button></>}
              </div>
              {date && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-13">
                  {inDept && me && (["yes", "no"] as const).map((a) => <button type="button" key={a} onClick={() => put("rsvps", { id: rsvpId("dept", m.id, date, me.id), personId: me.id, kind: "dept", refId: g.id, meetingId: m.id, date, answer: a, at: new Date().toISOString() })}
                    className={cx("min-h-9 rounded-full px-3 text-[13px] ring-1", mine?.answer === a ? (a === "yes" ? "bg-good text-white ring-good" : "bg-alert text-white ring-alert") : "bg-page ring-line")}>{a === "yes" ? "I'll be there" : "Can't make it"}</button>)}
                  {ans && (canEdit ? <button type="button" onClick={() => setWho(who === m.id ? null : m.id)} className="text-[12.5px] font-medium text-brand">{ans.yes.length} coming · {ans.no.length} can&apos;t · {Math.max(0, new Set([...g.memberIds, ...g.leaderIds]).size - ans.list.length)} not answered</button>
                    : <span className="text-[12.5px] text-muted">{ans.yes.length} coming</span>)}
                </div>
              )}
              {canEdit && who === m.id && ans && (
                <div className="mt-2 grid gap-2 pl-13 text-[13px] sm:grid-cols-2">
                  <p><b className="text-good">Coming:</b> {ans.yes.map((r) => nameOf(r.personId)).join(", ") || "nobody yet"}</p>
                  <p><b className="text-alert">Can&apos;t:</b> {ans.no.map((r) => nameOf(r.personId)).join(", ") || "nobody"}</p>
                </div>
              )}
            </li>
          );
        })}</ul>
      )}
      <Sheet open={!!f} onClose={() => setF(null)} title={f?.title ? "Edit" : "Add a meeting or programme"} footer={<Button variant="primary" className="w-full py-3" disabled={!f?.title.trim()} onClick={save}>Save and notify the department</Button>}>
        {f && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5">{([["regular", "Regular meeting"], ["programme", "One-off or impromptu"]] as const).map(([k, l]) => (
            <button type="button" key={k} onClick={() => setF({ ...f, kind: k, date: k === "programme" ? f.date ?? new Date().toISOString().slice(0, 10) : undefined })} className={cx("min-h-11 rounded-xl text-sm ring-1", f.kind === k ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{l}</button>
          ))}</div>
          <Field label="Title"><input autoFocus className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={f.kind === "regular" ? "Choir rehearsal" : "Media training day"} /></Field>
          {f.kind === "regular" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Day"><select className={inputCls} value={f.weekday} onChange={(e) => setF({ ...f, weekday: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
              <Field label="How often"><select className={inputCls} value={f.every} onChange={(e) => setF({ ...f, every: e.target.value as DeptMeeting["every"] })}><option value="week">Every week</option><option value="fortnight">Every two weeks</option><option value="month">Once a month</option></select></Field>
            </div>
          ) : <Field label="Date"><input type="date" className={inputCls} value={f.date ?? ""} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>}
          <Field label="Time"><input type="time" className={inputCls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
          <Field label="Format"><div className="grid grid-cols-3 gap-1.5">{([["physical", "In person"], ["virtual", "Online"], ["hybrid", "Both"]] as const).map(([k, l]) => (
            <button type="button" key={k} onClick={() => setF({ ...f, mode: k })} className={cx("min-h-10 rounded-xl text-[13.5px] ring-1", (f.mode ?? meetingMode(f)) === k ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{l}</button>
          ))}</div></Field>
          {(f.mode ?? meetingMode(f)) !== "virtual" && <Field label="Venue"><input className={inputCls} value={f.venue ?? ""} onChange={(e) => setF({ ...f, venue: e.target.value || undefined })} placeholder="Choir room" /></Field>}
          {(f.mode ?? meetingMode(f)) !== "physical" && <Field label="Meeting link"><input className={inputCls} inputMode="url" value={f.link ?? ""} onChange={(e) => setF({ ...f, link: e.target.value || undefined })} placeholder="https://meet.google.com/…" /></Field>}
          <Field label="Other details (optional)"><textarea rows={2} className={inputCls} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value || undefined })} placeholder="Agenda, what to bring…" /></Field>
        </div>}
      </Sheet>
    </Panel>
  );
}
