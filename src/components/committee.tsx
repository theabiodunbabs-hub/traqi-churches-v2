"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Banknote, CalendarClock, Check, CornerUpLeft, Crown, ExternalLink, Globe, Lightbulb, MapPin, Megaphone, Pencil, Send, Target, UserPlus, Users, Video, X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ago, fullName, money } from "@/lib/format";
import { firstStage, linesTotal, stageLabel, stageTone, totalOf } from "@/lib/funds";
import { COMMITTEE_PERMS, committeeRights, nextCommitteeMeeting, rsvpId, rsvpsFor } from "@/lib/event-mgmt";
import { eventPath } from "@/lib/events";
import type { ChurchEvent, Committee, CommitteeMeeting, CommitteePerm, EventNote } from "@/lib/types";
import { Avatar, Badge, Button, Empty, Field, Panel, Sheet, cx, inputCls, toast } from "./ui";
import { PeopleAdder } from "./people-adder";

export { committeeRights };

const empty = (): Committee => ({ members: [], messages: [] });
const nowISO = () => new Date().toISOString();
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const hhmm12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/**
 * The committee's workspace: everything about the event in one place.
 * A. the brief · B. the next meeting · C. the event page · D. budgets and funds · E. thoughts and suggestions ·
 * then the members, their roles and what each may do, and instructions from the heads.
 */
export function CommitteePanel({ e, onEdit }: { e: ChurchEvent; onEdit?: () => void }) {
  const { access, state } = useStore();
  if (!access) return null;
  const r = committeeRights(e, access);
  const myDept = state.groups.some((g) => access.leads.has(g.id) && g.kind === "department");
  if (!r.sees && !myDept) return null;
  return (
    <div className="space-y-5">
      {r.sees && <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]"><Brief e={e} onEdit={onEdit} /><NextMeeting e={e} /></div>}
      {r.sees && <LandingLink e={e} />}
      <Budgets e={e} />
      {r.sees && <Ideas e={e} />}
      {r.sees && <Members e={e} />}
      {r.sees && <Instructions e={e} />}
    </div>
  );
}

// ---------------- A. The brief ----------------
function Brief({ e, onEdit }: { e: ChurchEvent; onEdit?: () => void }) {
  const { state } = useStore();
  const regs = state.registrations.filter((x) => x.eventId === e.id && x.status === "confirmed").reduce((n, x) => n + 1 + (x.guests ?? 0), 0);
  const target = e.regTarget ?? 0;
  const pct = target ? Math.min(1, regs / target) : 0;
  return (
    <Panel title={<span className="flex items-center gap-2"><Target size={17} className="text-brand" /> Event brief</span>} action={onEdit && <Button onClick={onEdit}><Pencil size={14} /> Edit</Button>}>
      {e.description ? <p className="whitespace-pre-line text-[14.5px] text-ink-soft">{e.description}</p> : <p className="text-[14px] text-muted">No description yet.</p>}
      {e.goals && <div className="mt-4"><p className="mb-1 text-[12.5px] font-semibold uppercase tracking-wider text-muted">Goals</p><p className="text-[14.5px]">{e.goals}</p></div>}
      {!!e.objectives?.length && <div className="mt-4"><p className="mb-1 text-[12.5px] font-semibold uppercase tracking-wider text-muted">Objectives</p><ul className="space-y-1">{e.objectives.map((o, i) => <li key={i} className="flex gap-2 text-[14.5px]"><Check size={15} className="mt-1 shrink-0 text-good" />{o}</li>)}</ul></div>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-page p-3 ring-1 ring-line"><p className="text-[12.5px] text-muted">Target budget</p><p className="num text-[20px] font-semibold">{e.targetBudget ? money(e.targetBudget) : "Not set"}</p></div>
        <div className="rounded-2xl bg-page p-3 ring-1 ring-line"><p className="text-[12.5px] text-muted">Registration target</p><p className="num text-[20px] font-semibold">{target ? target.toLocaleString("en-NG") : "Not set"}</p></div>
      </div>
      {target > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[13.5px]"><span><b className="num">{regs.toLocaleString("en-NG")}</b> registered · <b className="num">{Math.round((regs / target) * 100)}%</b></span><span className="text-muted">{Math.max(0, target - regs).toLocaleString("en-NG")} to go</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-page ring-1 ring-line"><div className="h-full rounded-full bg-gradient-to-r from-brand to-glow transition-all" style={{ width: `${pct * 100}%` }} /></div>
        </div>
      )}
    </Panel>
  );
}

// ---------------- B. Meetings ----------------
function NextMeeting({ e }: { e: ChurchEvent }) {
  const { state, access, me, put } = useStore();
  const [edit, setEdit] = useState<CommitteeMeeting | null>(null);
  if (!access || !me) return null;
  const r = committeeRights(e, access);
  const c = e.committee ?? empty();
  const next = nextCommitteeMeeting(e);
  const later = (c.meetings ?? []).filter((m) => !m.cancelled && m.id !== next?.id && `${m.date}${m.time}` > `${next?.date ?? ""}${next?.time ?? ""}`).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const saveMeeting = (m: CommitteeMeeting, log: string) => put("events", { ...e, committee: { ...c, meetings: [...(c.meetings ?? []).filter((x) => x.id !== m.id), m] } }, log);
  const answers = next ? rsvpsFor(state, "committee", next.id, next.date) : null;
  const mine = next ? state.rsvps.find((x) => x.id === rsvpId("committee", next.id, next.date, me.id)) : undefined;
  return (
    <Panel title={<span className="flex items-center gap-2"><CalendarClock size={17} className="text-brand" /> Next committee meeting</span>}
      action={r.can("meetings") && <Button onClick={() => setEdit({ id: `cmt${Date.now().toString(36)}`, date: "", time: "18:00", mode: "physical", byId: me.id, at: nowISO() })}>Schedule</Button>}>
      {!next ? <p className="text-[14px] text-muted">{r.can("meetings") ? "No meeting scheduled. Members are notified as soon as you set one." : "No meeting scheduled yet."}</p> : (
        <div>
          <p className="font-display text-[20px] font-semibold">{dayLabel(next.date)}</p>
          <p className="text-[15px]">{hhmm12(next.time)} · {next.mode === "virtual" ? "Online" : next.mode === "hybrid" ? "In person and online" : "In person"}</p>
          {next.venue && next.mode !== "virtual" && <p className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-soft"><MapPin size={14} />{next.venue}</p>}
          {next.link && next.mode !== "physical" && <a href={next.link} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1.5 text-[14px] font-medium text-brand"><Video size={14} />Join the meeting</a>}
          {next.agenda && <p className="mt-2 rounded-xl bg-page px-3 py-2 text-[13.5px] text-ink-soft">{next.agenda}</p>}
          {next.updatedAt && <p className="mt-2 text-[12.5px] text-glow-ink">Changed {ago(next.updatedAt)}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["yes", "no"] as const).map((a) => <button type="button" key={a} onClick={() => put("rsvps", { id: rsvpId("committee", next.id, next.date, me.id), personId: me.id, kind: "committee", refId: e.id, meetingId: next.id, date: next.date, answer: a, at: nowISO() })}
              className={cx("min-h-9 rounded-full px-3.5 text-[13.5px] ring-1", mine?.answer === a ? (a === "yes" ? "bg-good text-white ring-good" : "bg-alert text-white ring-alert") : "bg-page ring-line")}>{a === "yes" ? "I'll be there" : "Can't make it"}</button>)}
            {answers && (answers.yes.length + answers.no.length > 0) && <span className="text-[12.5px] text-muted">{answers.yes.length} coming · {answers.no.length} can&apos;t</span>}
          </div>
          {r.can("meetings") && <div className="mt-3 flex gap-2"><Button className="py-1.5 text-[13px]" onClick={() => setEdit(next)}>Change</Button><Button variant="ghost" className="py-1.5 text-[13px] text-alert" onClick={() => saveMeeting({ ...next, cancelled: true, updatedAt: nowISO() }, `cancelled the ${e.title} committee meeting`)}>Cancel meeting</Button></div>}
        </div>
      )}
      {later.length > 0 && <ul className="mt-4 space-y-1 border-t border-line pt-3 text-[13.5px]">{later.map((m) => <li key={m.id} className="flex justify-between"><span>{dayLabel(m.date)}</span><span className="text-muted">{hhmm12(m.time)}</span></li>)}</ul>}
      {edit && <MeetingSheet m={edit} onClose={() => setEdit(null)} onSave={(m) => { const isNew = !(c.meetings ?? []).some((x) => x.id === m.id); saveMeeting(isNew ? m : { ...m, updatedAt: nowISO() }, `${isNew ? "scheduled" : "changed"} the ${e.title} committee meeting for ${m.date}`); toast(isNew ? "Scheduled. The committee has been notified." : "Changed. The committee has been told."); setEdit(null); }} />}
    </Panel>
  );
}

export function MeetingSheet({ m: init, onClose, onSave }: { m: CommitteeMeeting; onClose: () => void; onSave: (m: CommitteeMeeting) => void }) {
  const [m, setM] = useState(init);
  const ok = !!m.date && !!m.time && (m.mode === "physical" ? !!m.venue?.trim() : m.mode === "virtual" ? !!m.link?.trim() : !!m.venue?.trim() && !!m.link?.trim());
  return (
    <Sheet open onClose={onClose} title={init.date ? "Change the meeting" : "Schedule a meeting"} footer={<Button variant="primary" className="w-full py-3" disabled={!ok} onClick={() => onSave(m)}>Save and notify the committee</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className={inputCls} value={m.date} onChange={(x) => setM({ ...m, date: x.target.value })} /></Field>
          <Field label="Time"><input type="time" className={inputCls} value={m.time} onChange={(x) => setM({ ...m, time: x.target.value })} /></Field>
        </div>
        <Field label="Format"><div className="grid grid-cols-3 gap-1.5">{([["physical", "In person"], ["virtual", "Online"], ["hybrid", "Both"]] as const).map(([k, l]) => <button type="button" key={k} onClick={() => setM({ ...m, mode: k })} className={cx("min-h-10 rounded-xl text-[13.5px] ring-1", m.mode === k ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{l}</button>)}</div></Field>
        {m.mode !== "virtual" && <Field label="Venue"><input className={inputCls} value={m.venue ?? ""} onChange={(x) => setM({ ...m, venue: x.target.value })} placeholder="Youth hall, after second service" /></Field>}
        {m.mode !== "physical" && <Field label="Meeting link"><input className={inputCls} inputMode="url" value={m.link ?? ""} onChange={(x) => setM({ ...m, link: x.target.value })} placeholder="https://meet.google.com/…" /></Field>}
        <Field label="Agenda (optional)"><textarea className={cx(inputCls, "min-h-20")} value={m.agenda ?? ""} onChange={(x) => setM({ ...m, agenda: x.target.value })} /></Field>
      </div>
    </Sheet>
  );
}

// ---------------- C. The event page ----------------
function LandingLink({ e }: { e: ChurchEvent }) {
  const { state, access } = useStore();
  if (!access) return null;
  const path = eventPath(state.church.slug, e);
  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Globe size={19} /></span>
      <span className="min-w-[12rem] flex-1"><b className="block font-medium">Event page and registration</b><span className="text-[13px] text-muted">{e.status === "published" ? path : "Not public yet: a pastor publishes it."}</span></span>
      {e.status === "published" && <a href={path} target="_blank" rel="noreferrer"><Button><ExternalLink size={15} /> View page</Button></a>}
    </div>
  );
}

// ---------------- D. Budgets and requests for funds ----------------
function Budgets({ e }: { e: ChurchEvent }) {
  const { state, access, me, put, putMany, newId } = useStore();
  const [note, setNote] = useState("");
  if (!access || !me) return null;
  const r = committeeRights(e, access);
  // Committee-level reviewers: head, assistant, Finance Lead, or a member given the budget right (not the pastorate, who review later)
  const reviews = r.heads || r.financeLead || !!e.committee?.members.find((m) => m.personId === me.id)?.perms?.includes("budget");
  const nameOf = (id?: string) => fullName(state.people.find((x) => x.id === id));
  const all = state.funds.filter((f) => f.eventId === e.id);
  const mine = all.filter((f) => f.byId === me.id);
  const shown = reviews || r.picks ? all.filter((f) => !f.childIds?.length) : mine;
  const combined = all.filter((f) => f.childIds?.length);
  const waiting = shown.filter((f) => f.stage === "committee" && !f.parentId);
  const acked = waiting.filter((f) => f.history.some((h) => h.action === "Acknowledged by the committee"));
  const canRaise = r.member || state.groups.some((g) => (access.leads.has(g.id) || g.assistants?.some((a) => a.personId === me.id)) && g.kind === "department");
  const step = (f: (typeof all)[number], patch: Partial<(typeof all)[number]>, action: string, log: string) => { put("funds", { ...f, ...patch, history: [...f.history, { at: nowISO(), byId: me.id, action, note: note.trim() || undefined }] }, log); setNote(""); toast(action); };
  return (
    <Panel title={<span className="flex items-center gap-2"><Banknote size={17} className="text-brand" /> Budgets and requests for funds</span>}
      action={canRaise && <Link href={`/funds?new=1&event=${e.id}`}><Button variant="primary"><Banknote size={15} /> Raise a budget</Button></Link>}>
      <p className="mb-3 text-[13.5px] text-ink-soft">Every request for this event comes to the committee first ({[e.committee?.headId, e.committee?.assistantId, e.committee?.financeLeadId].filter(Boolean).map(nameOf).join(", ") || "the head and assistant"}), then church finance, then the Lead Pastor.</p>
      {combined.map((f) => <Link key={f.id} href={`/funds?id=${f.id}`} className="mb-2 flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3 text-[14px]"><span>{f.title} · <b className="num">{money(totalOf(state, f))}</b></span><Badge tone={stageTone(f)}>{stageLabel(state, f)}</Badge></Link>)}
      {shown.length === 0 ? <p className="text-sm text-muted">No budgets yet.</p> : (
        <ul className="divide-y divide-line">{shown.map((f) => {
          const ok = f.history.some((h) => h.action === "Acknowledged by the committee");
          const atCommittee = f.stage === "committee" && !f.parentId;
          return (
            <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <Link href={`/funds?id=${f.id}`} className="min-w-[10rem] flex-1"><b className="block text-[14px] font-medium">{f.title}</b><span className="text-[12.5px] text-muted">{state.groups.find((g) => g.id === f.groupId)?.name ?? "Committee"} · {nameOf(f.byId)}</span></Link>
              <b className="num">{money(linesTotal(f.lines))}</b>
              {f.parentId ? <Badge tone="good">Combined</Badge> : <Badge tone={stageTone(f)}>{stageLabel(state, f)}</Badge>}
              {reviews && atCommittee && (
                <span className="flex flex-wrap gap-1">
                  <Button variant="primary" className="py-1.5 text-[13px]" onClick={() => step(f, { stage: firstStage(state), returnedFrom: undefined, returnedTo: undefined }, f.returnedTo === "committee" ? "Clarified by the committee and sent again to finance" : "Approved by the committee and sent to church finance", `approved ${f.title} at committee level`)}><Send size={13} /> {f.returnedTo === "committee" ? "Resend" : "Approve"}</Button>
                  {!f.returnedTo && !ok && <Button className="py-1.5 text-[13px]" onClick={() => step(f, {}, "Acknowledged by the committee", `acknowledged the ${f.title} budget`)}><Check size={13} /> Hold to combine</Button>}
                  <Button className="py-1.5 text-[13px]" aria-label="Send back to the person who raised it" onClick={() => { if (!note.trim()) return toast("Write a note below first"); step(f, { stage: "returned", returnedFrom: "committee", returnedTo: "initiator" }, "Sent back by the committee", `sent back the ${f.title} budget`); }}><CornerUpLeft size={13} /></Button>
                </span>
              )}
            </li>
          );
        })}</ul>
      )}
      {reviews && waiting.length > 0 && <input className={cx(inputCls, "mt-3")} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Comment: what needs correcting, or extra justification for finance" />}
      {reviews && acked.length > 1 && (
        <Button className="mt-3" onClick={() => {
          const pid = newId("fr");
          const total = acked.reduce((t, f) => t + linesTotal(f.lines), 0);
          putMany("funds", [
            { id: pid, byId: me.id, at: nowISO(), title: `${e.title}: event budget`, purpose: `Combined budget from ${acked.length} requests.`, category: "Events", eventId: e.id, lines: [], childIds: acked.map((f) => f.id),
              stage: firstStage(state), history: [{ at: nowISO(), byId: me.id, action: `Approved and combined by the committee (${money(total)})` }], payments: [] },
            ...acked.map((f) => ({ ...f, parentId: pid, history: [...f.history, { at: nowISO(), byId: me.id, action: "Combined and sent to finance" }] })),
          ], `sent the ${e.title} budget to finance`);
          toast("Sent to finance as one request");
        }}><Send size={15} /> Combine {acked.length} held budgets and send to finance ({money(acked.reduce((t, f) => t + linesTotal(f.lines), 0))})</Button>
      )}
    </Panel>
  );
}

// ---------------- E. Thoughts and suggestions ----------------
const KIND: Record<EventNote["kind"], string> = { thought: "Thought", suggestion: "Suggestion", concern: "Concern" };
function Ideas({ e }: { e: ChurchEvent }) {
  const { state, access, me, put, newId } = useStore();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<EventNote["kind"]>("suggestion");
  const [reply, setReply] = useState<Record<string, string>>({});
  if (!access || !me) return null;
  const r = committeeRights(e, access);
  const notes = state.eventNotes.filter((n) => n.eventId === e.id).sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Panel title={<span className="flex items-center gap-2"><Lightbulb size={17} className="text-brand" /> Thoughts and suggestions</span>}>
      {r.member || r.picks ? (
        <div className="mb-4 space-y-2">
          <div className="flex gap-1.5">{(Object.keys(KIND) as EventNote["kind"][]).map((k) => <button type="button" key={k} onClick={() => setKind(k)} className={cx("min-h-9 rounded-full px-3 text-[13px] ring-1", kind === k ? "bg-deep text-white ring-deep" : "bg-page ring-line")}>{KIND[k]}</button>)}</div>
          <textarea className={cx(inputCls, "min-h-20")} value={text} onChange={(x) => setText(x.target.value)} placeholder="An idea, an observation, a recommendation…" />
          <Button variant="primary" disabled={text.trim().length < 3} onClick={() => { put("eventNotes", { id: newId("en"), eventId: e.id, byId: me.id, at: nowISO(), kind, text: text.trim(), status: "open" }, `shared a ${KIND[kind].toLowerCase()} on ${e.title}`); setText(""); toast("Shared with the committee"); }}><Send size={15} /> Share</Button>
        </div>
      ) : null}
      {notes.length === 0 ? <p className="text-sm text-muted">Nothing yet. Every idea helps.</p> : (
        <ul className="space-y-3">{notes.map((n) => {
          const p = state.people.find((x) => x.id === n.byId);
          return (
            <li key={n.id} className="rounded-2xl bg-page p-3.5 ring-1 ring-line">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted"><Avatar person={p} size={22} /><b className="text-ink">{fullName(p)}</b> · {KIND[n.kind]} · {ago(n.at)}
                {n.status && n.status !== "open" && <Badge tone={n.status === "adopted" ? "good" : "neutral"}>{n.status === "adopted" ? "Adopted" : "Parked"}</Badge>}</div>
              <p className="whitespace-pre-line text-[14.5px]">{n.text}</p>
              {n.reply && <p className="mt-2 border-l-2 border-brand pl-3 text-[13.5px] text-ink-soft"><b>{fullName(state.people.find((x) => x.id === n.reply!.byId))}:</b> {n.reply.text}</p>}
              {r.heads && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <input className={cx(inputCls, "min-w-[12rem] flex-1 py-1.5 text-[13.5px]")} value={reply[n.id] ?? ""} onChange={(x) => setReply({ ...reply, [n.id]: x.target.value })} placeholder="Reply" />
                  {(["adopted", "parked"] as const).map((s) => <Button key={s} className="py-1.5 text-[13px]" onClick={() => { put("eventNotes", { ...n, status: s, reply: reply[n.id]?.trim() ? { byId: me.id, at: nowISO(), text: reply[n.id].trim() } : n.reply }, `${s === "adopted" ? "adopted" : "parked"} a suggestion on ${e.title}`); setReply({ ...reply, [n.id]: "" }); }}>{s === "adopted" ? "Adopt" : "Park"}</Button>)}
                  {reply[n.id]?.trim() && <Button variant="primary" className="py-1.5 text-[13px]" onClick={() => { put("eventNotes", { ...n, reply: { byId: me.id, at: nowISO(), text: reply[n.id].trim() } }); setReply({ ...reply, [n.id]: "" }); }}>Reply</Button>}
                </div>
              )}
            </li>
          );
        })}</ul>
      )}
    </Panel>
  );
}

// ---------------- Members, roles, responsibilities and rights ----------------
function Members({ e }: { e: ChurchEvent }) {
  const { state, access, me, put } = useStore();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  if (!access || !me) return null;
  const c = e.committee ?? empty();
  const r = committeeRights(e, access);
  const team = r.can("team");
  const save = (next: Committee, log: string) => put("events", { ...e, committee: next }, log);
  const setMember = (pid: string, patch: Partial<Committee["members"][number]>, log: string) => save({ ...c, members: c.members.map((x) => (x.personId === pid ? { ...x, ...patch } : x)) }, log);
  return (
    <Panel title={<span className="flex items-center gap-2"><Users size={17} className="text-brand" /> Committee members</span>} action={team && <Button onClick={() => setAdding(true)}><UserPlus size={15} /> Add members</Button>}>
      {c.members.length === 0 ? <Empty title="No committee yet" body={r.picks ? "Add the people planning this event, then pick the head and assistant. They're notified straight away." : "The admin or pastorate will appoint one."} icon={<Users size={24} />} /> : (
        <ul className="divide-y divide-line">{c.members.map((m) => {
          const p = state.people.find((x) => x.id === m.personId); if (!p) return null;
          const head = c.headId === p.id, asst = c.assistantId === p.id, fin = c.financeLeadId === p.id;
          const tag = head ? "Committee head" : asst ? "Assistant head" : fin ? "Finance Lead" : "";
          return (
            <li key={p.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar person={p} size={36} />
                <span className="min-w-[9rem] flex-1"><b className="block text-[14.5px] font-medium">{fullName(p)}</b>
                  <span className="text-[12.5px]">{tag && <span className="font-medium text-brand">{tag}</span>}{tag && m.role ? " · " : ""}{m.role && <span className="text-ink-soft">{m.role}</span>}</span>
                  {m.duties && <span className="block text-[12.5px] text-muted">{m.duties}</span>}
                </span>
                {!!m.perms?.length && <span className="flex flex-wrap gap-1">{m.perms.map((k) => <Badge key={k}>{COMMITTEE_PERMS.find((x) => x.k === k)?.label}</Badge>)}</span>}
                {team && <Button className="py-1.5 text-[13px]" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? "Done" : "Manage"}</Button>}
              </div>
              {team && open === p.id && (
                <div className="mt-3 space-y-3 rounded-2xl bg-page p-3.5 ring-1 ring-line">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Role"><input className={inputCls} value={m.role ?? ""} placeholder="e.g. Logistics, Publicity" onChange={(ev) => setMember(p.id, { role: ev.target.value }, `gave ${fullName(p)} a role on the ${e.title} committee`)} /></Field>
                    <Field label="Responsibilities"><input className={inputCls} value={m.duties ?? ""} placeholder="What they're responsible for" onChange={(ev) => setMember(p.id, { duties: ev.target.value }, `set ${fullName(p)}'s responsibilities on the ${e.title} committee`)} /></Field>
                  </div>
                  {!head && !asst && (
                    <Field label="Can also" hint="The head and assistant can do all of these.">
                      <div className="flex flex-wrap gap-1.5">{COMMITTEE_PERMS.map((x) => { const on = !!m.perms?.includes(x.k); return (
                        <button type="button" key={x.k} title={x.says} aria-pressed={on} onClick={() => setMember(p.id, { perms: on ? (m.perms ?? []).filter((k) => k !== x.k) : [...(m.perms ?? []), x.k] as CommitteePerm[] }, `${on ? "removed" : "gave"} ${fullName(p)} ${on ? "from" : "the"} ${x.label.toLowerCase()} right on the ${e.title} committee`)}
                          className={cx("min-h-9 rounded-full px-3 text-[13px] ring-1", on ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-surface ring-line")}>{on && <Check size={12} className="mr-1 inline" />}{x.label}</button>
                      ); })}</div>
                    </Field>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {r.picks && <button type="button" onClick={() => save({ ...c, headId: head ? undefined : p.id, assistantId: asst ? undefined : c.assistantId }, `made ${fullName(p)} head of the ${e.title} committee`)} className={cx("min-h-9 rounded-lg px-2.5 text-[12.5px] ring-1", head ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}><Crown size={12} className="inline" /> Head</button>}
                    {(r.picks || c.headId === me.id) && <button type="button" onClick={() => save({ ...c, assistantId: asst ? undefined : p.id, headId: head ? undefined : c.headId }, `made ${fullName(p)} assistant head of the ${e.title} committee`)} className={cx("min-h-9 rounded-lg px-2.5 text-[12.5px] ring-1", asst ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}>Assistant head</button>}
                    <button type="button" onClick={() => save({ ...c, financeLeadId: fin ? undefined : p.id }, `made ${fullName(p)} Finance Lead of the ${e.title} committee`)} className={cx("min-h-9 rounded-lg px-2.5 text-[12.5px] ring-1", fin ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}><Banknote size={12} className="inline" /> Finance Lead</button>
                    {(!head || r.picks) && <button type="button" onClick={() => save({ ...c, members: c.members.filter((x) => x.personId !== p.id), headId: head ? undefined : c.headId, assistantId: asst ? undefined : c.assistantId, financeLeadId: fin ? undefined : c.financeLeadId }, `removed ${fullName(p)} from the ${e.title} committee`)} className="min-h-9 rounded-lg px-2.5 text-[12.5px] text-alert ring-1 ring-line"><X size={12} className="inline" /> Remove</button>}
                  </div>
                </div>
              )}
            </li>
          );
        })}</ul>
      )}
      <PeopleAdder open={adding} onClose={() => setAdding(false)} title="Add to the committee" exclude={c.members.map((m) => m.personId)} onAdd={(ids, what) => {
        const add = ids.filter((id) => !c.members.some((m) => m.personId === id));
        save({ ...c, members: [...c.members, ...add.map((personId) => ({ personId, addedById: me.id, addedAt: nowISO() }))] }, `appointed ${what} to the ${e.title} committee`); toast(`${add.length} added. They've been notified.`);
      }} />
    </Panel>
  );
}

// ---------------- Instructions ----------------
function Instructions({ e }: { e: ChurchEvent }) {
  const { state, access, me, put, newId } = useStore();
  const [msg, setMsg] = useState("");
  if (!access || !me) return null;
  const c = e.committee ?? empty();
  const r = committeeRights(e, access);
  if (!c.members.length) return null;
  const visible = c.messages.filter((m) => r.picks || r.heads || m.to === "all");
  return (
    <Panel title={<span className="flex items-center gap-2"><Megaphone size={17} className="text-brand" /> Instructions</span>}>
      {visible.length === 0 && <p className="mb-3 text-sm text-muted">{r.heads ? "Send instructions to everyone on the committee." : r.picks ? "Write to the committee head and assistant." : "Instructions from the committee head will show here."}</p>}
      <ul className="mb-3 space-y-2">{visible.map((m) => (
        <li key={m.id} className={cx("rounded-2xl p-3 text-[14px]", m.to === "heads" ? "bg-glow-soft" : "bg-page")}>
          <span className="mb-1 block text-[12px] text-muted">{fullName(state.people.find((x) => x.id === m.byId))} · {m.to === "heads" ? "to the heads" : "to everyone"} · {ago(m.at)}</span>{m.text}
        </li>
      ))}</ul>
      {(r.heads || r.picks) && (
        <div className="flex gap-2">
          <input className={inputCls} value={msg} onChange={(ev) => setMsg(ev.target.value)} placeholder={r.heads ? "Instruction for everyone" : "Message for the head and assistant"} />
          <Button variant="primary" disabled={!msg.trim()} onClick={() => { put("events", { ...e, committee: { ...c, messages: [...c.messages, { id: newId("cm"), byId: me.id, at: nowISO(), to: r.heads ? "all" : "heads", text: msg.trim() }] } }, `sent an instruction to the ${e.title} committee`); setMsg(""); toast("Sent"); }}><Send size={15} /></Button>
        </div>
      )}
    </Panel>
  );
}
