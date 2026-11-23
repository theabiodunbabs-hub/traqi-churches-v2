"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Banknote, Check, CornerUpLeft, Download, EyeOff, Paperclip, Plus, Receipt, Send, Settings2, Trash2, Wallet, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge, Button, Empty, Field, PageHeader, Panel, Sheet, Stat, Tabs, Toggle, cx, inputCls, toast } from "@/components/ui";
import { DownloadButton } from "@/components/download";
import { uploadImage } from "@/lib/upload";
import { ago, fullName, money, shortDate } from "@/lib/format";
import {
  DEFAULT_CATEGORIES, ROUTES, actionsFor, balance, budgetUse, firstStage, fundLinesSheet, fundsSheet, insights, isFinance, isFinanceLead, linesTotal,
  paidOf, seesBalance, seesFund, setupOf, stageLabel, stageTone, totalOf, type FundAction,
} from "@/lib/funds";
import { committeeRights } from "@/lib/event-mgmt";
import type { FinanceSetup, FundLine, FundRequest } from "@/lib/types";

type Tab = "mine" | "act" | "all" | "insights" | "setup";

export default function FundsPage() { return <Suspense><Funds /></Suspense>; }

function Funds() {
  const { state, access, me } = useStore();
  const q = useSearchParams();
  const [tab, setTab] = useState<Tab>("mine");
  const [making, setMaking] = useState<null | { refund?: boolean; eventId?: string }>(null);
  const [open, setOpen] = useState<string | null>(q.get("id"));
  useEffect(() => { if (q.has("new")) setMaking({ refund: q.get("new") === "refund", eventId: q.get("event") ?? undefined }); }, [q]);
  if (!access || !me) return null;
  const overseer = access.isPastoral || access.isAdmin || isFinance(access);
  const setupRights = access.isLead || isFinanceLead(access);
  const mine = state.funds.filter((f) => f.byId === me.id && !f.parentId).sort((a, b) => b.at.localeCompare(a.at));
  const act = state.funds.filter((f) => seesFund(state, access, f) && (actionsFor(state, access, f).length > 0)).sort((a, b) => a.at.localeCompare(b.at));
  const all = state.funds.filter((f) => seesFund(state, access, f) && !f.parentId).sort((a, b) => b.at.localeCompare(a.at));
  const tabs = [
    { key: "mine" as Tab, label: "My requests", count: mine.length },
    ...(act.length || overseer ? [{ key: "act" as Tab, label: "Waiting on you", count: act.length }] : []),
    ...(overseer ? [{ key: "all" as Tab, label: "All requests" }, { key: "insights" as Tab, label: "Insights" }] : []),
    ...(setupRights ? [{ key: "setup" as Tab, label: "How it works" }] : []),
  ];
  const shown = tab === "act" ? act : tab === "all" ? all : mine;
  const b = balance(state);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Fund requests" sub="Ask for money with a budget, follow it to payment, then send your spending report."
        actions={<div className="flex flex-wrap gap-2"><Button onClick={() => setMaking({ refund: true })}><Receipt size={16} /> I spent, refund me</Button><Button variant="primary" onClick={() => setMaking({})}><Plus size={16} /> New request</Button></div>} />
      {overseer && seesBalance(state, access) && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat n={money(b.left, "NGN", true)} label="Balance" icon={<Wallet size={17} />} tone="brand" />
          <Stat n={money(b.income, "NGN", true)} label="Money in" />
          <Stat n={money(b.out, "NGN", true)} label="Paid out" />
          <Stat n={act.length} label="Waiting on you" tone={act.length ? "glow" : undefined} />
        </div>
      )}
      {overseer && !seesBalance(state, access) && <p className="mb-4 flex items-center gap-2 text-[13px] text-muted"><EyeOff size={14} /> The pastor has hidden the balance.</p>}
      <div className="mb-4"><Tabs value={tabs.some((t) => t.key === tab) ? tab : "mine"} onChange={setTab} items={tabs} /></div>

      {tab === "insights" ? <Insights /> : tab === "setup" ? <Setup /> : shown.length === 0 ? (
        <Empty title={tab === "act" ? "Nothing waiting on you" : "No requests yet"} body={tab === "mine" ? "When your department needs money, send a request with a simple budget." : "Requests will show here."} icon={<Banknote size={26} />} />
      ) : (
        <ul className="space-y-2.5">{shown.map((f) => <FundRow key={f.id} f={f} onOpen={() => setOpen(f.id)} />)}</ul>
      )}
      {tab === "all" && <div className="mt-4 flex justify-end"><DownloadButton what="fund requests" sheets={() => [fundsSheet(state), fundLinesSheet(state)]} /></div>}
      {making && <FundForm initial={making} onClose={() => setMaking(null)} />}
      {open && state.funds.find((f) => f.id === open) && <FundDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FundRow({ f, onOpen }: { f: FundRequest; onOpen: () => void }) {
  const { state } = useStore();
  const by = state.people.find((p) => p.id === f.byId);
  const g = state.groups.find((x) => x.id === f.groupId);
  const total = totalOf(state, f); const paid = paidOf(f);
  return (
    <li>
      <button type="button" onClick={onOpen} className="card card-hover flex w-full flex-wrap items-center gap-3 p-4 text-left">
        <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-2xl", f.refund ? "bg-glow-soft text-glow-ink" : "bg-brand-soft text-brand")}>{f.refund ? <Receipt size={19} /> : <Banknote size={19} />}</span>
        <span className="min-w-[12rem] flex-1">
          <b className="block truncate font-medium">{f.title}</b>
          <span className="block text-[13px] text-muted">{[g?.name, by && fullName(by), ago(f.at)].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="text-right"><b className="num block">{money(total)}</b>{paid > 0 && paid < total && <span className="text-[12px] text-muted">{money(paid)} paid</span>}</span>
        <Badge tone={stageTone(f)}>{stageLabel(state, f)}</Badge>
      </button>
    </li>
  );
}

const blankLine = (): FundLine => ({ id: Math.random().toString(36).slice(2, 8), item: "", qty: 1, unit: 0 });

/** Line items: what, how many, how much each. Used for budgets and for spending reports. */
function Lines({ lines, onChange, receipts }: { lines: FundLine[]; onChange: (l: FundLine[]) => void; receipts?: boolean }) {
  const file = useRef<HTMLInputElement>(null);
  const [forLine, setForLine] = useState<string | null>(null);
  const up = (id: string, patch: Partial<FundLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <div>
      <div className="mb-1 hidden grid-cols-[1fr_4.5rem_7rem_2.5rem] gap-2 px-1 text-[12px] text-muted sm:grid"><span>Item</span><span>Qty</span><span>Each (₦)</span><span /></div>
      <ul className="space-y-2">{lines.map((l) => (
        <li key={l.id} className="grid grid-cols-[1fr_4.5rem_7rem_2.5rem] gap-2">
          <input className={inputCls} value={l.item} onChange={(e) => up(l.id, { item: e.target.value })} placeholder="What it's for" aria-label="Item" />
          <input className={inputCls} type="number" min={1} inputMode="numeric" value={l.qty || ""} onChange={(e) => up(l.id, { qty: Number(e.target.value) })} aria-label="Quantity" />
          <input className={inputCls} type="number" min={0} inputMode="numeric" value={l.unit || ""} onChange={(e) => up(l.id, { unit: Number(e.target.value) })} aria-label="Cost each" />
          <span className="flex items-center gap-1">
            {receipts && <button type="button" onClick={() => { setForLine(l.id); file.current?.click(); }} className={cx("rounded-lg p-1.5", l.receipt ? "text-good" : "text-muted hover:text-brand")} aria-label={l.receipt ? "Receipt added" : "Add a receipt"}><Paperclip size={16} /></button>}
            {lines.length > 1 && <button type="button" onClick={() => onChange(lines.filter((x) => x.id !== l.id))} className="rounded-lg p-1.5 text-muted hover:text-alert" aria-label="Remove line"><Trash2 size={15} /></button>}
          </span>
        </li>
      ))}</ul>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => onChange([...lines, blankLine()])} className="min-h-10 text-sm font-medium text-brand">+ Add a line</button>
        <b className="num">{money(linesTotal(lines))}</b>
      </div>
      {receipts && <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const x = e.target.files?.[0]; e.target.value = ""; if (!x || !forLine) return;
        try { const url = await uploadImage(x, "flyer", 900); up(forLine, { receipt: url }); toast("Receipt added"); } catch { toast("That picture didn't work"); }
      }} />}
    </div>
  );
}

function FundForm({ initial, onClose, edit }: { initial: { refund?: boolean; eventId?: string }; onClose: () => void; edit?: FundRequest }) {
  const { state, access, me, put, newId } = useStore();
  const set = setupOf(state);
  const cats = set.categories?.length ? set.categories : DEFAULT_CATEGORIES;
  const myGroups = state.groups.filter((g) => access?.leads.has(g.id) || g.assistants?.some((a) => a.personId === me?.id));
  // Events this person can raise a budget for: any event whose committee they sit on, or any open event if they head a department
  const eventChoices = state.events.filter((e) => Date.parse(e.end) > Date.now() && (committeeRights(e, access ?? { personId: "", isPastoral: false, isAdmin: false }).member || myGroups.length > 0) && !!e.committee?.members.length);
  const [forEvent, setForEvent] = useState<"" | "yes" | "no">(initial.eventId || edit?.eventId ? "yes" : edit ? "no" : "");
  const [eventId, setEventId] = useState(initial.eventId ?? edit?.eventId ?? "");
  const ev = forEvent === "yes" && eventId ? state.events.find((e) => e.id === eventId) : undefined;
  const [f, setF] = useState(() => ({
    title: edit?.title ?? "", purpose: edit?.purpose ?? "", category: edit?.category ?? (ev ? "Events" : cats[0]), groupId: edit?.groupId ?? myGroups[0]?.id ?? "",
    lines: edit?.lines ?? [blankLine()], when: edit?.timeline ? "words" : "date", neededBy: edit?.neededBy ?? "", timeline: edit?.timeline ?? "", refund: edit?.refund ?? !!initial.refund,
  }));
  const [err, setErr] = useState("");
  if (!me || !access) return null;
  const send = () => {
    if (!edit && eventChoices.length && !forEvent) return setErr("Say whether this is for an event.");
    if (forEvent === "yes" && !ev) return setErr("Choose the event.");
    if (!f.title.trim()) return setErr("Give the request a short title.");
    const lines = f.lines.filter((l) => l.item.trim() && l.qty > 0 && l.unit > 0);
    if (!lines.length) return setErr("Add at least one line with an amount.");
    const stage = ev ? "committee" : firstStage(state);
    const base: FundRequest = edit ?? { id: newId("fr"), byId: me.id, at: new Date().toISOString(), title: "", purpose: "", category: "", lines: [], stage, history: [], payments: [] };
    put("funds", {
      ...base, title: f.title.trim(), purpose: f.purpose.trim(), category: f.category, groupId: f.groupId || undefined, eventId: ev?.id, lines,
      neededBy: f.when === "date" ? f.neededBy || undefined : undefined, timeline: f.when === "words" ? f.timeline.trim() || undefined : undefined, refund: f.refund,
      stage, returnedFrom: undefined, returnedTo: undefined,
      history: [...base.history, { at: new Date().toISOString(), byId: me.id, action: edit ? "Sent again" : f.refund ? "Asked for a refund" : ev ? `Sent to the ${ev.title} committee` : "Sent" }],
    }, `${edit ? "re-sent" : "sent"} a fund request: ${f.title.trim()}`);
    toast(ev ? "Sent to the committee" : set.route === 1 ? "Sent to the pastor" : "Sent to finance");
    onClose();
  };
  return (
    <Sheet open onClose={onClose} wide title={edit ? "Edit and send again" : f.refund ? "Ask for a refund" : ev ? `Budget for ${ev.title}` : "New fund request"}
      footer={<div className="space-y-2">{err && <p className="text-sm text-alert" role="alert">{err}</p>}<Button variant="primary" className="w-full py-3" onClick={send}><Send size={16} /> {f.refund ? "Ask for refund" : "Send request"}</Button></div>}>
      <div className="space-y-5">
        {f.refund && <p className="rounded-2xl bg-glow-soft px-4 py-3 text-[13.5px] text-glow-ink">For urgent spending you&apos;ve already made from your own pocket. List what you spent; you can add receipts after.</p>}
        {(eventChoices.length > 0 || ev) && (
          <Field label="Is this request for an event?" hint={forEvent === "yes" ? "It goes to the event committee first, then church finance, then the Lead Pastor." : undefined}>
            <div className="flex gap-1.5">{([["yes", "Yes, an event"], ["no", "No"]] as const).map(([k, l]) => <button type="button" key={k} onClick={() => { setForEvent(k); setErr(""); if (k === "yes" && !eventId && eventChoices.length === 1) setEventId(eventChoices[0].id); }} className={cx("min-h-10 flex-1 rounded-xl px-3 text-[14px] ring-1", forEvent === k ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{l}</button>)}</div>
            {forEvent === "yes" && <select className={cx(inputCls, "mt-2")} value={eventId} onChange={(e) => { setEventId(e.target.value); setF((x) => ({ ...x, category: "Events" })); }}><option value="">Choose the event</option>{eventChoices.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>}
          </Field>
        )}
        <Field label="Title"><input autoFocus className={inputCls} value={f.title} onChange={(e) => { setF({ ...f, title: e.target.value }); setErr(""); }} placeholder={f.refund ? "Fuel for the guest minister" : "Two wireless microphones"} /></Field>
        <Field label="What it's for"><textarea className={cx(inputCls, "min-h-20")} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="The pulpit mics keep cutting out during the sermon." /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {myGroups.length > 0 && <Field label="Department"><select className={inputCls} value={f.groupId} onChange={(e) => setF({ ...f, groupId: e.target.value })}>{myGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}<option value="">Not for a department</option></select></Field>}
          <Field label="Category"><select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label={f.refund ? "What you spent" : "Budget"}><Lines lines={f.lines} onChange={(lines) => setF({ ...f, lines })} /></Field>
        {!f.refund && (
          <Field label="When is it needed?">
            <div className="mb-2 flex gap-1.5">{[["date", "Pick a date"], ["words", "Type it"]].map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, when: k })} className={cx("min-h-9 rounded-full px-3 text-[13px] ring-1", f.when === k ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}>{l}</button>)}</div>
            {f.when === "date" ? <input type="date" className={inputCls} value={f.neededBy} onChange={(e) => setF({ ...f, neededBy: e.target.value })} /> : <input className={inputCls} value={f.timeline} onChange={(e) => setF({ ...f, timeline: e.target.value })} placeholder="Before the December retreat" />}
          </Field>
        )}
      </div>
    </Sheet>
  );
}

function FundDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, access, me, put, newId } = useStore();
  const [note, setNote] = useState("");
  const [pay, setPay] = useState("");
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const f = state.funds.find((x) => x.id === id)!;
  if (!access || !me) return null;
  const by = state.people.find((p) => p.id === f.byId);
  const total = totalOf(state, f); const paid = paidOf(f);
  const acts = actionsFor(state, access, f);
  const kids = state.funds.filter((x) => f.childIds?.includes(x.id));
  const parent = f.parentId ? state.funds.find((x) => x.id === f.parentId) : undefined;
  const now = () => new Date().toISOString();
  const step = (patch: Partial<FundRequest>, action: string, log: string) => {
    put("funds", { ...f, ...patch, history: [...f.history, { at: now(), byId: me.id, action, note: note.trim() || undefined }] }, log);
    setNote(""); toast(action);
  };
  const doAct = (a: FundAction) => {
    if ((a === "return" || a === "returnReport" || a === "decline") && !note.trim()) return toast("Add a note saying why");
    if (a === "forward") return step({ stage: "pastor" }, "Sent to the pastor", `sent ${f.title} to the pastor`);
    if (a === "approve") return step({ stage: "approved" }, "Approved", `approved ${f.title}`);
    // Event budgets sent back by finance or the Lead Pastor go to the committee leadership first
    if (a === "return" && f.eventId && !f.refund) return step({ stage: "committee", returnedFrom: f.stage, returnedTo: "committee" }, f.stage === "pastor" ? "Sent back to the committee by the Lead Pastor" : "Sent back to the committee by finance", `sent ${f.title} back to the event committee`);
    if (a === "return") return step({ stage: "returned", returnedFrom: f.stage }, "Sent back", `sent back ${f.title}`);
    if (a === "committeeReturn") { if (!note.trim()) return toast("Add a note saying what needs fixing"); return step({ stage: "returned", returnedFrom: "committee", returnedTo: "initiator" }, "Sent back by the committee", `sent ${f.title} back to ${by ? fullName(by) : "the person who raised it"}`); }
    if (a === "committeeApprove") { const to = firstStage(state); return step({ stage: to, returnedFrom: undefined, returnedTo: undefined }, f.returnedTo === "committee" ? (to === "pastor" ? "Clarified by the committee and sent to the pastor" : "Clarified by the committee and sent again to finance") : to === "pastor" ? "Approved by the committee and sent to the pastor" : "Approved by the committee and sent to church finance", `approved ${f.title} at committee level`); }
    if (a === "decline") return step({ stage: "declined" }, "Declined", `declined ${f.title}`);
    if (a === "acceptReport") return step({ stage: "closed", report: { ...f.report!, reviewedById: me.id, reviewedAt: now() } }, "Report accepted", `accepted the report for ${f.title}`);
    if (a === "returnReport") return step({ report: undefined }, "Report sent back", `sent back the report for ${f.title}`);
    if (a === "pay") {
      const amt = Math.round(Number(pay) || total - paid);
      if (amt <= 0) return toast("Enter the amount paid");
      const left = total - paid - amt;
      const closes = f.refund && left <= 0;
      put("funds", { ...f, stage: closes ? "closed" : "paid", payments: [...f.payments, { id: newId("py"), at: now(), byId: me.id, amount: amt, note: note.trim() || undefined }],
        report: closes ? { at: now(), lines: f.lines, reviewedById: me.id, reviewedAt: now() } : f.report,
        history: [...f.history, { at: now(), byId: me.id, action: `Paid ${money(amt)}${left > 0 ? " (part payment)" : ""}`, note: note.trim() || undefined }] }, `paid ${money(amt)} on ${f.title}`);
      setPay(""); setNote(""); toast(left > 0 ? `${money(left)} still to pay` : "Paid in full");
    }
  };
  const actLabel: Record<FundAction, [string, React.ReactNode]> = {
    forward: ["Send to the pastor", <ArrowRight key="a" size={15} />], approve: ["Approve", <Check key="b" size={15} />], return: ["Send back", <CornerUpLeft key="c" size={15} />],
    decline: ["Decline", <X key="d" size={15} />],
    committeeApprove: [f.returnedTo === "committee" ? "Send to finance again" : "Approve and send to finance", <ArrowRight key="h" size={15} />],
    committeeReturn: [f.returnedTo === "committee" ? "Pass back to the person who raised it" : "Send back to the person who raised it", <CornerUpLeft key="i" size={15} />], pay: ["Record payment", <Banknote key="e" size={15} />], acceptReport: ["Accept report", <Check key="f" size={15} />], returnReport: ["Send report back", <CornerUpLeft key="g" size={15} />],
  };
  return (
    <Sheet open onClose={onClose} wide title={f.title}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={stageTone(f)}>{stageLabel(state, f)}</Badge>{f.refund && <Badge tone="glow">Refund</Badge>}<Badge>{f.category}</Badge>
        <span className="text-[13px] text-muted">{by && fullName(by)} · {state.groups.find((g) => g.id === f.groupId)?.name ?? "No department"} · {shortDate(f.at.slice(0, 10))}</span>
      </div>
      {parent && <p className="mb-3 rounded-xl bg-brand-soft px-3 py-2 text-[13.5px]">Part of <b>{parent.title}</b>, which the committee sent on as one request.</p>}
      {f.purpose && <p className="mb-4 whitespace-pre-line text-[14.5px] text-ink-soft">{f.purpose}</p>}
      {(f.neededBy || f.timeline) && <p className="mb-4 text-[13.5px]"><b>Needed:</b> {f.neededBy ? shortDate(f.neededBy) : f.timeline}</p>}
      <LinesTable lines={f.lines} title="Budget" />
      {kids.length > 0 && <div className="mt-4 space-y-3"><p className="text-sm font-semibold">By department</p>{kids.map((k) => <LinesTable key={k.id} lines={k.lines} title={state.groups.find((g) => g.id === k.groupId)?.name ?? k.title} />)}</div>}
      <div className="mt-3 flex justify-between rounded-xl bg-page px-4 py-3 font-semibold"><span>Total</span><span className="num">{money(total)}</span></div>
      {f.payments.length > 0 && <div className="mt-3 space-y-1 text-[13.5px]">{f.payments.map((p) => <p key={p.id} className="flex justify-between"><span>Paid {shortDate(p.at.slice(0, 10))}{p.note ? ` · ${p.note}` : ""}</span><b className="num">{money(p.amount)}</b></p>)}{paid < total && <p className="flex justify-between text-muted"><span>Still to pay</span><b className="num">{money(total - paid)}</b></p>}</div>}
      {f.report && <div className="mt-4"><LinesTable lines={f.report.lines} title="Spending report" receipts />{(f.report.returned ?? 0) > 0 && <p className="mt-2 text-[13.5px]">Balance returned: <b>{money(f.report.returned!)}</b></p>}{f.report.note && <p className="mt-1 text-[13.5px] text-ink-soft">{f.report.note}</p>}</div>}

      {acts.length > 0 && (
        <div className="mt-5 space-y-2 rounded-2xl bg-page p-4 ring-1 ring-line">
          {acts.includes("pay") && <Field label="Amount paid now" hint="Leave empty to pay it all. Part payments are fine."><input className={inputCls} type="number" inputMode="numeric" value={pay} onChange={(e) => setPay(e.target.value)} placeholder={String(total - paid)} /></Field>}
          <textarea className={cx(inputCls, "min-h-16")} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note (needed when sending back or declining)" />
          <div className="flex flex-wrap gap-2">{acts.map((a) => <Button key={a} variant={a === "approve" || a === "pay" || a === "forward" || a === "acceptReport" ? "primary" : "secondary"} onClick={() => doAct(a)}>{actLabel[a][1]} {actLabel[a][0]}</Button>)}</div>
        </div>
      )}
      {f.byId === me.id && f.stage === "returned" && <Button variant="primary" className="mt-4" onClick={() => setEditing(true)}>Fix and send again</Button>}
      {f.byId === me.id && f.stage === "paid" && !f.report && !f.refund && <Button variant="primary" className="mt-4" onClick={() => setReporting(true)}><Receipt size={15} /> Send spending report</Button>}

      <div className="mt-6"><p className="mb-2 text-sm font-semibold">What happened</p><ol className="space-y-2 border-l-2 border-line pl-4">{f.history.map((h, i) => { const p = state.people.find((x) => x.id === h.byId); return <li key={i} className="text-[13.5px]"><b>{h.action}</b> <span className="text-muted">· {p ? fullName(p) : ""} · {ago(h.at)}</span>{h.note && <span className="block text-ink-soft">“{h.note}”</span>}</li>; })}</ol></div>
      {editing && <FundForm initial={{}} edit={f} onClose={() => setEditing(false)} />}
      {reporting && <ReportForm f={f} onClose={() => setReporting(false)} />}
    </Sheet>
  );
}

function LinesTable({ lines, title, receipts }: { lines: FundLine[]; title: string; receipts?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-line">
      <p className="bg-page px-4 py-2 text-[12.5px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <table className="w-full text-[13.5px]"><tbody>{lines.map((l) => (
        <tr key={l.id} className="border-t border-line">
          <td className="px-4 py-2">{l.item}{receipts && l.receipt && <a href={l.receipt} target="_blank" rel="noreferrer" download className="ml-2 inline-flex items-center gap-1 text-[12px] font-medium text-brand"><Download size={12} /> Receipt</a>}</td>
          <td className="px-2 py-2 text-right text-muted">{l.qty} × {money(l.unit)}</td>
          <td className="num px-4 py-2 text-right font-medium">{money(l.qty * l.unit)}</td>
        </tr>
      ))}</tbody></table>
    </div>
  );
}

function ReportForm({ f, onClose }: { f: FundRequest; onClose: () => void }) {
  const { me, put } = useStore();
  const [lines, setLines] = useState<FundLine[]>(f.lines.map((l) => ({ ...l, id: `r${l.id}` })));
  const [note, setNote] = useState("");
  if (!me) return null;
  const paid = paidOf(f); const spent = linesTotal(lines);
  const back = Math.max(0, paid - spent);
  return (
    <Sheet open onClose={onClose} wide title="Retirement / spending report" footer={<Button variant="primary" className="w-full py-3" onClick={() => {
      put("funds", { ...f, report: { at: new Date().toISOString(), lines: lines.filter((l) => l.item.trim()), returned: back, note: note.trim() || undefined }, history: [...f.history, { at: new Date().toISOString(), byId: me.id, action: "Sent the spending report" }] }, `sent the spending report for ${f.title}`);
      toast("Report sent to finance"); onClose();
    }}><Send size={16} /> Send report</Button>}>
      <p className="mb-4 text-[14px] text-ink-soft">Change the amounts to what you actually spent. Tap the clip to add a receipt photo (optional); it&apos;s shrunk to a small size.</p>
      <Lines lines={lines} onChange={setLines} receipts />
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[13px]">
        <span className="rounded-xl bg-page p-3">Received<b className="num block text-[15px]">{money(paid)}</b></span>
        <span className="rounded-xl bg-page p-3">Spent<b className="num block text-[15px]">{money(spent)}</b></span>
        <span className={cx("rounded-xl p-3", spent > paid ? "bg-alert-soft" : "bg-good-soft")}>{spent > paid ? "Over by" : "To return"}<b className="num block text-[15px]">{money(Math.abs(paid - spent))}</b></span>
      </div>
      <textarea className={cx(inputCls, "mt-4 min-h-16")} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything finance should know" />
    </Sheet>
  );
}

function Insights() {
  const { state } = useStore();
  const i = insights(state);
  const budgets = budgetUse(state);
  const max = Math.max(1, ...i.byDept.map((x) => x[1]));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat n={money(i.asked, "NGN", true)} label="Asked this year" />
        <Stat n={money(i.paid, "NGN", true)} label="Paid this year" tone="good" />
        <Stat n={i.waiting.length} label="Being reviewed" tone={i.waiting.length ? "glow" : undefined} />
        <Stat n={i.reportsDue.length} label="Reports due" tone={i.reportsDue.length ? "alert" : undefined} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Paid by department">{i.byDept.length ? <ul className="space-y-2.5">{i.byDept.map(([n, v]) => <li key={n}><div className="mb-1 flex justify-between text-[13.5px]"><span>{n}</span><b className="num">{money(v)}</b></div><div className="h-2 rounded-full bg-page"><div className="h-2 rounded-full bg-brand" style={{ width: `${(v / max) * 100}%` }} /></div></li>)}</ul> : <p className="text-sm text-muted">Nothing paid yet this year.</p>}</Panel>
        <Panel title="Paid by category">{i.byCat.length ? <ul className="divide-y divide-line">{i.byCat.map(([n, v]) => <li key={n} className="flex justify-between py-2 text-[14px]"><span>{n}</span><b className="num">{money(v)}</b></li>)}</ul> : <p className="text-sm text-muted">Nothing paid yet this year.</p>}</Panel>
      </div>
      {budgets.length > 0 && <Panel title="Department budgets"><ul className="space-y-3">{budgets.map((b) => { const pct = Math.min(100, (b.used / b.amount) * 100); return <li key={b.groupId}><div className="mb-1 flex justify-between text-[13.5px]"><span>{b.name} <span className="text-muted">({b.period === "year" ? "this year" : "this quarter"})</span></span><span className="num">{money(b.used)} of {money(b.amount)}</span></div><div className="h-2 rounded-full bg-page"><div className={cx("h-2 rounded-full", pct > 90 ? "bg-alert" : "bg-good")} style={{ width: `${pct}%` }} /></div></li>; })}</ul></Panel>}
      {i.reportsDue.length > 0 && <Panel title="Waiting for spending reports"><ul className="divide-y divide-line">{i.reportsDue.map((f) => { const p = state.people.find((x) => x.id === f.byId); return <li key={f.id} className="flex justify-between py-2 text-[14px]"><span>{f.title}<span className="block text-[12.5px] text-muted">{p && fullName(p)}</span></span><b className="num">{money(paidOf(f))}</b></li>; })}</ul></Panel>}
      <div className="flex justify-end"><DownloadButton what="fund requests" label="Download (Excel or CSV)" sheets={() => [fundsSheet(state), fundLinesSheet(state)]} /></div>
    </div>
  );
}

function Setup() {
  const { state, access, updateChurch } = useStore();
  const [f, setF] = useState<FinanceSetup>(() => ({ ...setupOf(state), categories: setupOf(state).categories ?? DEFAULT_CATEGORIES }));
  const financePeople = state.people.filter((p) => state.assignments.some((a) => a.personId === p.id && ["finance", "financelead"].includes(state.roles.find((r) => r.id === a.roleId)?.key ?? "")));
  const [cat, setCat] = useState("");
  if (!access) return null;
  const save = () => { updateChurch({}, { finance: f }, "updated how fund requests work"); toast("Saved"); };
  return (
    <div className="space-y-5">
      <Panel title="Which way do requests go?">
        <div className="grid gap-2 md:grid-cols-3">{ROUTES.map((r) => (
          <button type="button" key={r.n} onClick={() => setF({ ...f, route: r.n })} className={cx("rounded-2xl p-4 text-left ring-1", f.route === r.n ? "bg-brand-soft ring-brand" : "bg-page ring-line")}>
            <b className="block">{r.title}</b><span className="text-[13px] text-ink-soft">{r.body}</span>
          </button>
        ))}</div>
        {f.route === 3 && <div className="mt-3 max-w-xs"><Field label="Finance can approve up to (₦)"><input className={inputCls} type="number" inputMode="numeric" value={f.limit ?? ""} onChange={(e) => setF({ ...f, limit: Number(e.target.value) })} placeholder="50000" /></Field></div>}
      </Panel>
      <Panel title="Who reviews requests in finance">
        {financePeople.length === 0 ? <p className="text-sm text-muted">Give people the Finance team or Finance lead role under Settings › Roles first.</p> : (
          <div className="flex flex-wrap gap-1.5">{financePeople.map((p) => { const on = !f.reviewerIds?.length || f.reviewerIds.includes(p.id); return <button type="button" key={p.id} onClick={() => { const cur = f.reviewerIds?.length ? f.reviewerIds : financePeople.map((x) => x.id); setF({ ...f, reviewerIds: on ? cur.filter((x) => x !== p.id) : [...cur, p.id] }); }} className={cx("min-h-10 rounded-full px-3.5 text-[13.5px] ring-1", on ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}>{fullName(p)}</button>; })}</div>
        )}
      </Panel>
      {access.isLead && <Panel title="Balance"><label className="flex items-center gap-3"><span className="flex-1 text-[14px]">Hide the balance from the finance team<span className="block text-[12.5px] text-muted">The finance lead and pastors still see it.</span></span><Toggle label="Hide balance" on={!!f.hideBalance} onChange={(v) => setF({ ...f, hideBalance: v })} /></label></Panel>}
      <Panel title="Categories">
        <div className="flex flex-wrap gap-1.5">{(f.categories ?? []).map((c) => <span key={c} className="flex items-center gap-1 rounded-full bg-page px-3 py-1.5 text-[13.5px] ring-1 ring-line">{c}<button type="button" onClick={() => setF({ ...f, categories: f.categories!.filter((x) => x !== c) })} aria-label={`Remove ${c}`} className="text-muted hover:text-alert"><X size={13} /></button></span>)}</div>
        <div className="mt-2 flex gap-2"><input className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Add a category" /><Button onClick={() => { if (cat.trim()) { setF({ ...f, categories: [...(f.categories ?? []), cat.trim()] }); setCat(""); } }}>Add</Button></div>
      </Panel>
      <Panel title="Department budgets (optional)">
        <ul className="space-y-2">{(f.budgets ?? []).map((b, i) => (
          <li key={i} className="grid grid-cols-[1fr_7rem_8rem_2rem] gap-2">
            <select className={inputCls} value={b.groupId} onChange={(e) => setF({ ...f, budgets: f.budgets!.map((x, j) => (j === i ? { ...x, groupId: e.target.value } : x)) })}>{state.groups.filter((g) => g.kind === "department").map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            <select className={inputCls} value={b.period} onChange={(e) => setF({ ...f, budgets: f.budgets!.map((x, j) => (j === i ? { ...x, period: e.target.value as "year" | "quarter" } : x)) })}><option value="year">Yearly</option><option value="quarter">Quarterly</option></select>
            <input className={inputCls} type="number" inputMode="numeric" value={b.amount || ""} onChange={(e) => setF({ ...f, budgets: f.budgets!.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)) })} placeholder="Amount" />
            <button type="button" onClick={() => setF({ ...f, budgets: f.budgets!.filter((_, j) => j !== i) })} className="text-muted hover:text-alert" aria-label="Remove budget"><Trash2 size={15} /></button>
          </li>
        ))}</ul>
        <button type="button" onClick={() => setF({ ...f, budgets: [...(f.budgets ?? []), { groupId: state.groups.find((g) => g.kind === "department")?.id ?? "", period: "year", amount: 0 }] })} className="mt-2 min-h-10 text-sm font-medium text-brand">+ Add a budget</button>
      </Panel>
      <div className="flex justify-end"><Button variant="primary" onClick={save}><Settings2 size={15} /> Save</Button></div>
    </div>
  );
}
