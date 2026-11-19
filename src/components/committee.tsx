"use client";

import Link from "next/link";
import { useState } from "react";
import { Banknote, Check, CornerUpLeft, Crown, Megaphone, Send, UserPlus, Users, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { ago, fullName, money } from "@/lib/format";
import { firstStage, linesTotal, stageLabel, stageTone } from "@/lib/funds";
import type { ChurchEvent, Committee } from "@/lib/types";
import { Avatar, Badge, Button, Empty, Panel, cx, inputCls, toast } from "./ui";
import { PeopleAdder } from "./people-adder";

const empty = (): Committee => ({ members: [], messages: [] });

/** Who can do what on an event's planning committee. */
export function committeeRights(e: ChurchEvent, a: { isPastoral: boolean; isAdmin: boolean; personId: string; leads: Set<string> }) {
  const c = e.committee;
  const picks = a.isPastoral || a.isAdmin;
  const heads = !!c && (c.headId === a.personId || c.assistantId === a.personId);
  const member = !!c?.members.some((m) => m.personId === a.personId);
  return { picks, heads, member, sees: picks || heads || member };
}

/**
 * An event's planning committee. The admin or pastorate picks the members, the head and the assistant.
 * The heads give roles and instructions; the pastorate and admin write to the heads.
 * Department heads send their event budgets here; the heads acknowledge or send back, then send one combined request to finance.
 */
export function CommitteePanel({ e }: { e: ChurchEvent }) {
  const { state, access, me, put, putMany, newId } = useStore();
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  if (!access || !me) return null;
  const c = e.committee ?? empty();
  const r = committeeRights(e, access);
  const save = (next: Committee, log: string) => put("events", { ...e, committee: next }, log);
  const nameOf = (id?: string) => { const p = state.people.find((x) => x.id === id); return p ? fullName(p) : ""; };
  const now = () => new Date().toISOString();

  // Budgets sent to this committee by department heads
  const budgets = state.funds.filter((f) => f.eventId === e.id && !f.childIds?.length);
  const combined = state.funds.find((f) => f.eventId === e.id && f.childIds?.length);
  const waiting = budgets.filter((f) => f.stage === "committee" && !f.parentId);
  const acked = waiting.filter((f) => f.history.some((h) => h.action === "Acknowledged by the committee"));
  const myDept = state.groups.find((g) => access.leads.has(g.id) && g.kind === "department");
  const visibleMessages = c.messages.filter((m) => r.picks || r.heads || m.to === "all");

  if (!r.sees && !myDept) return null;
  return (
    <div className="space-y-5">
      <Panel title={<span className="flex items-center gap-2"><Users size={17} className="text-brand" /> Planning committee</span>} action={r.picks && <Button onClick={() => setAdding(true)}><UserPlus size={15} /> Add members</Button>}>
        {c.members.length === 0 ? <Empty title="No committee yet" body={r.picks ? "Add the people planning this event, then pick the head and assistant." : "The admin or pastorate will set one up."} icon={<Users size={24} />} /> : (
          <ul className="divide-y divide-line">{c.members.map((m) => {
            const p = state.people.find((x) => x.id === m.personId); if (!p) return null;
            const head = c.headId === p.id; const asst = c.assistantId === p.id;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Avatar person={p} size={34} />
                <span className="min-w-[9rem] flex-1"><b className="block text-[14.5px] font-medium">{fullName(p)}</b>{(head || asst) && <span className="text-[12.5px] font-medium text-brand">{head ? "Committee head" : "Assistant head"}</span>}</span>
                {r.picks || r.heads ? <input className={cx(inputCls, "max-w-[12rem] py-1.5 text-[13.5px]")} value={m.role ?? ""} placeholder="Role, e.g. Logistics" onChange={(ev) => save({ ...c, members: c.members.map((x) => (x.personId === p.id ? { ...x, role: ev.target.value } : x)) }, `gave ${fullName(p)} a role on the ${e.title} committee`)} aria-label={`Role for ${fullName(p)}`} />
                  : m.role && <Badge>{m.role}</Badge>}
                {r.picks && (
                  <span className="flex gap-1">
                    <button type="button" onClick={() => save({ ...c, headId: head ? undefined : p.id, assistantId: asst ? undefined : c.assistantId }, `made ${fullName(p)} head of the ${e.title} committee`)} className={cx("rounded-lg px-2 py-1 text-[12px] ring-1", head ? "bg-deep text-white ring-deep" : "ring-line")}><Crown size={12} className="inline" /> Head</button>
                    <button type="button" onClick={() => save({ ...c, assistantId: asst ? undefined : p.id, headId: head ? undefined : c.headId }, `made ${fullName(p)} assistant head of the ${e.title} committee`)} className={cx("rounded-lg px-2 py-1 text-[12px] ring-1", asst ? "bg-deep text-white ring-deep" : "ring-line")}>Assistant</button>
                    <button type="button" onClick={() => save({ ...c, members: c.members.filter((x) => x.personId !== p.id), headId: head ? undefined : c.headId, assistantId: asst ? undefined : c.assistantId }, `removed ${fullName(p)} from the ${e.title} committee`)} className="rounded-lg p-1 text-muted hover:text-alert" aria-label={`Remove ${fullName(p)}`}><X size={15} /></button>
                  </span>
                )}
              </li>
            );
          })}</ul>
        )}
        <PeopleAdder open={adding} onClose={() => setAdding(false)} title="Add to the committee" exclude={c.members.map((m) => m.personId)} onAdd={(ids, what) => {
          const add = ids.filter((id) => !c.members.some((m) => m.personId === id));
          save({ ...c, members: [...c.members, ...add.map((personId) => ({ personId }))] }, `added ${what} to the ${e.title} committee`); toast(`${add.length} added`);
        }} />
      </Panel>

      {(r.sees) && c.members.length > 0 && (
        <Panel title={<span className="flex items-center gap-2"><Megaphone size={17} className="text-brand" /> Instructions</span>}>
          {visibleMessages.length === 0 && <p className="mb-3 text-sm text-muted">{r.heads ? "Send instructions to everyone on the committee." : r.picks ? "Write to the committee head and assistant." : "Instructions from the committee head will show here."}</p>}
          <ul className="mb-3 space-y-2">{visibleMessages.map((m) => (
            <li key={m.id} className={cx("rounded-2xl p-3 text-[14px]", m.to === "heads" ? "bg-glow-soft" : "bg-page")}>
              <span className="mb-1 block text-[12px] text-muted">{nameOf(m.byId)} · {m.to === "heads" ? "to the heads" : "to everyone"} · {ago(m.at)}</span>{m.text}
            </li>
          ))}</ul>
          {(r.heads || r.picks) && (
            <div className="flex gap-2">
              <input className={inputCls} value={msg} onChange={(ev) => setMsg(ev.target.value)} placeholder={r.heads ? "Instruction for everyone" : "Message for the head and assistant"} />
              <Button variant="primary" disabled={!msg.trim()} onClick={() => { save({ ...c, messages: [...c.messages, { id: newId("cm"), byId: me.id, at: now(), to: r.heads ? "all" : "heads", text: msg.trim() }] }, `sent an instruction to the ${e.title} committee`); setMsg(""); toast("Sent"); }}><Send size={15} /></Button>
            </div>
          )}
        </Panel>
      )}

      <Panel title={<span className="flex items-center gap-2"><Banknote size={17} className="text-brand" /> Event budget</span>} action={myDept && <Link href={`/funds?new=1&event=${e.id}`} className="text-sm font-medium text-brand">+ {myDept.name} budget</Link>}>
        {combined && <Link href={`/funds?id=${combined.id}`} className="mb-3 flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3 text-[14px]"><span>Sent to finance as one request</span><Badge tone={stageTone(combined)}>{stageLabel(state, combined)}</Badge></Link>}
        {budgets.length === 0 ? <p className="text-sm text-muted">Department heads send their budgets for this event here. The committee head combines them for finance.</p> : (
          <ul className="divide-y divide-line">{budgets.map((f) => {
            const ok = f.history.some((h) => h.action === "Acknowledged by the committee");
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-[10rem] flex-1"><b className="block text-[14px] font-medium">{state.groups.find((g) => g.id === f.groupId)?.name ?? f.title}</b><span className="text-[12.5px] text-muted">{f.title} · {nameOf(f.byId)}</span></span>
                <b className="num">{money(linesTotal(f.lines))}</b>
                {f.parentId ? <Badge tone="good">Combined</Badge> : f.stage === "returned" ? <Badge tone="alert">Sent back</Badge> : ok ? <Badge tone="good">Acknowledged</Badge> : <Badge tone="glow">New</Badge>}
                {r.heads && f.stage === "committee" && !f.parentId && !ok && (
                  <span className="flex gap-1">
                    <Button className="py-1.5 text-[13px]" onClick={() => put("funds", { ...f, history: [...f.history, { at: now(), byId: me.id, action: "Acknowledged by the committee" }] }, `acknowledged the ${f.title} budget`)}><Check size={14} /> Acknowledge</Button>
                    <Button className="py-1.5 text-[13px]" onClick={() => { if (!note.trim()) return toast("Write a note below first"); put("funds", { ...f, stage: "returned", returnedFrom: "committee", history: [...f.history, { at: now(), byId: me.id, action: "Sent back by the committee", note: note.trim() }] }, `sent back the ${f.title} budget`); setNote(""); }}><CornerUpLeft size={14} /></Button>
                  </span>
                )}
              </li>
            );
          })}</ul>
        )}
        {r.heads && waiting.length > 0 && <input className={cx(inputCls, "mt-3")} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Note for sending a budget back" />}
        {r.heads && acked.length > 0 && (
          <Button variant="primary" className="mt-3" onClick={() => {
            const pid = newId("fr");
            const total = acked.reduce((t, f) => t + linesTotal(f.lines), 0);
            putMany("funds", [
              { id: pid, byId: me.id, at: now(), title: `${e.title}: event budget`, purpose: `Combined budget from ${acked.length} department${acked.length > 1 ? "s" : ""}.`, category: "Events", eventId: e.id, lines: [], childIds: acked.map((f) => f.id),
                stage: firstStage(state), history: [{ at: now(), byId: me.id, action: `Combined by the committee (${money(total)})` }], payments: [] },
              ...acked.map((f) => ({ ...f, parentId: pid, history: [...f.history, { at: now(), byId: me.id, action: "Combined and sent to finance" }] })),
            ], `sent the ${e.title} budget to finance`);
            toast("Sent to finance as one request");
          }}><Send size={15} /> Combine {acked.length} and send to finance ({money(acked.reduce((t, f) => t + linesTotal(f.lines), 0))})</Button>
        )}
      </Panel>
    </div>
  );
}
