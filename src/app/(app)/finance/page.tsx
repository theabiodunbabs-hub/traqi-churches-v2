"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownLeft, Banknote, Check, CreditCard, FileCheck2, HandCoins, Landmark, Pencil, Plus, Receipt, ShieldCheck, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { DownloadButton } from "@/components/download";
import { countsSheet, givingSheet } from "@/lib/exports";
import { Avatar, Badge, Button, CountUp, Empty, Field, Panel, Sheet, Tabs, cx, inputCls, toast } from "@/components/ui";
import { StackedBars, BarList } from "@/components/charts";
import { financeByMonth, lineTotal } from "@/lib/domain";
import { dayName, fullName, money, shortDate, todayLagos } from "@/lib/format";
import type { CountLine, Lodgement, ServiceCount, Transfer } from "@/lib/types";

type Tab = "counts" | "lodging" | "transfers" | "reports";
const METHOD = { transfer: { label: "Bank transfer", icon: ArrowDownLeft }, deposit: { label: "Cash deposit", icon: Landmark }, pos: { label: "POS", icon: CreditCard } };

export default function Finance() {
  const { state, access, me } = useStore();
  const [tab, setTab] = useState<Tab>("counts");
  const [counting, setCounting] = useState<ServiceCount | null>(null);
  const [correcting, setCorrecting] = useState<ServiceCount | null>(null);
  const [lodging, setLodging] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const months = useMemo(() => financeByMonth(state), [state]);
  if (!access || !me) return null;
  if (!access.canFinance) return <Empty title="Offerings are private" body="Only the people your lead pastor chooses can see them." icon={<ShieldCheck size={26} />} />;
  const seesTotals = access.can("finance.view") || access.isLead;
  const canCount = access.can("finance.count");
  const canTransfers = access.can("finance.transfers");
  const canApprove = access.can("finance.approve") || access.isLead;
  const counts = state.counts.filter((c) => seesTotals || c.byId === me.id).sort((a, b) => b.at.localeCompare(a.at));
  const effective = (c: ServiceCount) => (c.correction?.status === "approved" ? c.correction.lines : c.lines);
  const lodgedIds = new Set(state.lodgements.flatMap((l) => l.countIds));
  const unlodged = counts.filter((c) => !lodgedIds.has(c.id));
  const thisMonth = months.at(-1); const lastMonth = months.at(-2);
  const total = (m?: (typeof months)[number]) => (m ? m.cash + m.transfer : 0);
  const change = lastMonth && total(lastMonth) ? Math.round(((total(thisMonth) - total(lastMonth)) / total(lastMonth)) * 100) : null;
  const gaps = state.lodgements.map((l) => ({ l, counted: l.countIds.reduce((n, id) => n + lineTotal(effective(state.counts.find((c) => c.id === id) ?? { lines: [] } as never), l.currency), 0) })).filter((x) => x.counted !== x.l.amount);
  const pendingCorrections = state.counts.filter((c) => c.correction?.status === "pending");
  const others = [...new Set(state.counts.flatMap((c) => c.lines.map((l) => l.currency)).filter((x) => x !== "NGN"))];

  const newCount = (): ServiceCount => ({ id: "", meetingId: "", lines: (state.church.profile?.categories ?? ["Offering", "Tithe"]).map((category) => ({ category, amount: 0, currency: "NGN" })), byId: me.id, at: "" });

  return (
    <div className="mx-auto max-w-5xl">
      <section className="hero mb-6 px-6 pb-6 pt-7 md:px-9 md:pt-9">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] text-white/60"><ShieldCheck size={14} /> Private to the people your lead pastor chooses</p>
            <h1 className="mt-2 font-display text-[32px] font-semibold tracking-tight md:text-[40px]">Offerings</h1>
            {seesTotals && thisMonth && <p className="mt-1 text-white/70">This month so far</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {seesTotals && <DownloadButton what="Offerings" sheets={() => [givingSheet(state), countsSheet(state)]} />}
            {canCount && <Button variant="light" onClick={() => setCounting(newCount())}><Plus size={16} /> Record a count</Button>}
            {canTransfers && <button onClick={() => setTransfer(true)} className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium hover:bg-white/15"><ArrowDownLeft size={15} /> Add transfers</button>}
          </div>
        </div>
        {seesTotals && thisMonth && (
          <div className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <div className="glass col-span-2 rounded-2xl px-4 py-3 md:col-span-1"><p className="num text-[30px] font-semibold"><CountUp to={total(thisMonth)} format={(n) => money(n)} /></p><p className="text-[13px] text-white/65">{change !== null ? `${change >= 0 ? "+" : ""}${change}% on last month` : "total"}</p></div>
            <div className="glass rounded-2xl px-4 py-3"><p className="num text-[24px] font-semibold">{money(thisMonth.cash, "NGN", true)}</p><p className="text-[13px] text-white/65">counted in services</p></div>
            <div className="glass rounded-2xl px-4 py-3"><p className="num text-[24px] font-semibold">{money(thisMonth.transfer, "NGN", true)}</p><p className="text-[13px] text-white/65">by transfer</p></div>
            <div className="glass rounded-2xl px-4 py-3"><p className={cx("num text-[24px] font-semibold", unlodged.length ? "text-glow" : "")}>{unlodged.length}</p><p className="text-[13px] text-white/65">counts not lodged yet</p></div>
          </div>
        )}
      </section>

      {(gaps.length > 0 || (canApprove && pendingCorrections.length > 0)) && seesTotals && (
        <div className="mb-5 space-y-2">
          {gaps.map(({ l, counted }) => (
            <div key={l.id} className="flex items-center gap-3 rounded-2xl bg-glow-soft p-4 text-[14px] text-glow-ink">
              <AlertTriangle size={18} className="shrink-0" />
              <span className="flex-1">Lodged {money(l.amount, l.currency)} on {shortDate(l.date)}, but {money(counted, l.currency)} was counted. <b>{money(Math.abs(counted - l.amount), l.currency)} {counted > l.amount ? "short" : "over"}.</b></span>
            </div>
          ))}
          {canApprove && pendingCorrections.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-brand/30">
              <Pencil size={18} className="text-brand" />
              <span className="flex-1 text-[14px]"><b>Correction asked</b> for {meetingName(c.meetingId)}: {money(lineTotal(c.lines))} → {money(lineTotal(c.correction!.lines))}. “{c.correction!.reason}”</span>
              <CorrectionButtons c={c} />
            </div>
          ))}
        </div>
      )}

      <Tabs className="mb-5" value={tab} onChange={setTab} items={[
        { key: "counts", label: "Service counts", count: counts.length },
        ...(seesTotals || canCount ? [{ key: "lodging" as Tab, label: "Lodging", count: unlodged.length || undefined }] : []),
        ...(seesTotals || canTransfers ? [{ key: "transfers" as Tab, label: "Transfers" }] : []),
        ...(seesTotals ? [{ key: "reports" as Tab, label: "Reports" }] : []),
      ]} />

      <div key={tab} className="rise">
        {tab === "counts" && (
          <Panel>
            {counts.length === 0 ? <p className="py-8 text-center text-sm text-muted">No counts yet.</p> : (
              <ul className="divide-y divide-line">{counts.map((c) => {
                const lines = effective(c);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-4 py-3.5">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-good-soft text-good"><HandCoins size={19} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{meetingName(c.meetingId)}</span>
                      <span className="block text-[13px] text-muted">{lines.filter((l) => l.amount).map((l) => `${l.category} ${money(l.amount, l.currency, true)}`).join(" · ")}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted"><Avatar person={state.people.find((p) => p.id === c.byId)} size={16} />{fullName(state.people.find((p) => p.id === c.byId))}{c.witnessId && ` · witnessed by ${fullName(state.people.find((p) => p.id === c.witnessId))}`}</span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-lg font-semibold">{money(lineTotal(lines))}</span>
                      {others.map((cur) => lineTotal(lines, cur) ? <span key={cur} className="block text-[12.5px] text-muted">+ {money(lineTotal(lines, cur), cur)}</span> : null)}
                      <span className="mt-1 flex justify-end gap-1">
                        {lodgedIds.has(c.id) ? <Badge tone="good"><Check size={11} /> Lodged</Badge> : <Badge tone="glow">Not lodged</Badge>}
                        {c.correction?.status === "pending" && <Badge tone="brand">Correction pending</Badge>}
                        {c.correction?.status === "approved" && <Badge tone="neutral">Corrected</Badge>}
                      </span>
                    </span>
                    {(canCount || seesTotals) && !c.correction?.status?.startsWith("pending") && <Button variant="ghost" onClick={() => setCorrecting(c)} aria-label="Ask for a correction"><Pencil size={15} /></Button>}
                  </li>
                );
              })}</ul>
            )}
          </Panel>
        )}

        {tab === "lodging" && (
          <div className="space-y-5">
            <Panel title="Waiting to be lodged" action={unlodged.length > 0 && <Button variant="primary" onClick={() => setLodging(true)}><Landmark size={15} /> Record lodging</Button>}>
              {unlodged.length === 0 ? <p className="flex items-center gap-2 text-sm text-good"><Check size={16} /> Everything counted has been lodged.</p> : (
                <ul className="space-y-1.5">{unlodged.map((c) => <li key={c.id} className="flex justify-between rounded-xl bg-page px-3 py-2 text-[14px]"><span>{meetingName(c.meetingId)}</span><span className="num font-semibold">{money(lineTotal(effective(c)))}</span></li>)}</ul>
              )}
            </Panel>
            <Panel title="Lodged">
              <ul className="divide-y divide-line">{state.lodgements.slice().sort((a, b) => b.date.localeCompare(a.date)).map((l) => { const M = METHOD[l.method]; return (
                <li key={l.id} className="flex items-center gap-3 py-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><M.icon size={17} /></span>
                  <span className="flex-1"><span className="block font-medium">{M.label} · {shortDate(l.date)}</span><span className="text-[13px] text-muted">{l.reference ? `Ref ${l.reference}` : "No reference"} · {l.countIds.length} count{l.countIds.length > 1 ? "s" : ""}</span></span>
                  <span className="num font-semibold">{money(l.amount, l.currency)}</span>
                </li>
              ); })}</ul>
            </Panel>
          </div>
        )}

        {tab === "transfers" && (
          <Panel title="Transfers into the church account" action={canTransfers && <Button onClick={() => setTransfer(true)}><Plus size={15} /> Add</Button>}>
            <ul className="divide-y divide-line">{state.transfers.slice().sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-good-soft text-good"><ArrowDownLeft size={17} /></span>
                <span className="flex-1"><span className="block font-medium">{t.category}</span><span className="text-[13px] text-muted">{dayName(t.date, { weekday: "short", day: "numeric", month: "short" })}{t.reference ? ` · ${t.reference}` : ""}</span></span>
                <span className="num font-semibold">{money(t.amount)}</span>
              </li>
            ))}</ul>
          </Panel>
        )}

        {tab === "reports" && <Reports />}
      </div>

      <Sheet open={!!counting} onClose={() => setCounting(null)} title="Record a count">{counting && <CountForm initial={counting} onDone={() => setCounting(null)} />}</Sheet>
      <Sheet open={!!correcting} onClose={() => setCorrecting(null)} title="Ask for a correction">{correcting && <CorrectionForm c={correcting} onDone={() => setCorrecting(null)} />}</Sheet>
      <Sheet open={lodging} onClose={() => setLodging(false)} title="Record lodging"><LodgeForm counts={unlodged} onDone={() => setLodging(false)} /></Sheet>
      <Sheet open={transfer} onClose={() => setTransfer(false)} title="Add transfers"><TransferForm onDone={() => setTransfer(false)} /></Sheet>
    </div>
  );

  function meetingName(id: string) {
    const m = state.meetings.find((x) => x.id === id);
    return m ? `${m.name} · ${shortDate(m.date)}` : "A service";
  }

  function CorrectionButtons({ c }: { c: ServiceCount }) {
    const { put } = useStore();
    return (
      <span className="flex gap-1.5">
        <Button variant="primary" onClick={() => { put("counts", { ...c, correction: { ...c.correction!, status: "approved" } }, "approved a count correction"); toast("Correction approved"); }}><Check size={15} /> Approve</Button>
        <Button onClick={() => { put("counts", { ...c, correction: { ...c.correction!, status: "declined" } }, "declined a count correction"); toast("Correction declined"); }}><X size={15} /> Decline</Button>
      </span>
    );
  }

  function Reports() {
    const cats = new Map<string, number>();
    state.counts.forEach((c) => effective(c).filter((l) => l.currency === "NGN").forEach((l) => cats.set(l.category, (cats.get(l.category) ?? 0) + l.amount)));
    state.transfers.forEach((t) => cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount));
    const csv = () => {
      const rows = [["Date", "Source", "Category", "Currency", "Amount"], ...state.counts.flatMap((c) => effective(c).map((l) => [state.meetings.find((m) => m.id === c.meetingId)?.date ?? "", meetingName(c.meetingId), l.category, l.currency, l.amount])), ...state.transfers.map((t) => [t.date, "Transfer", t.category, "NGN", t.amount])];
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" })); a.download = `offerings-${todayLagos()}.csv`; a.click();
    };
    return (
      <div className="space-y-5">
        <Panel title="By month" action={<Button onClick={csv}><Receipt size={15} /> Export</Button>}>
          <StackedBars data={months.map((m) => ({ label: dayName(`${m.month}-15`, { month: "short", year: "2-digit" }), values: [m.cash, m.transfer] }))} keys={["cash", "transfer"]} labels={["Counted", "Transfers"]} colors={["#0e9f6e", "var(--color-brand)"]} format={(n) => money(n, "NGN", true)} />
        </Panel>
        <Panel title="By kind of giving"><BarList items={[...cats.entries()].map(([label, n]) => ({ label: `${label} · ${money(n, "NGN", true)}`, n })).sort((a, b) => b.n - a.n)} color="bg-good" /></Panel>
      </div>
    );
  }
}

function CountForm({ initial, onDone }: { initial: ServiceCount; onDone: () => void }) {
  const { state, me, put, newId } = useStore();
  const meetings = state.meetings.filter((m) => Date.parse(m.start) < Date.now() + 36e5 && !state.counts.some((c) => c.meetingId === m.id)).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 12);
  const [meetingId, setMeeting] = useState(meetings[0]?.id ?? "");
  const [lines, setLines] = useState<CountLine[]>(initial.lines);
  const [witness, setWitness] = useState("");
  const needWitness = state.church.profile?.witness;
  const ushers = state.groups.filter((g) => g.tags?.includes("ushering")).flatMap((g) => [...g.leaderIds, ...g.memberIds]).filter((id) => id !== me!.id).map((id) => state.people.find((p) => p.id === id)).filter(Boolean) as typeof state.people;
  const currencies = state.church.profile?.currencies ?? ["NGN"];
  return (
    <div className="space-y-4">
      <Field label="Service"><select className={inputCls} value={meetingId} onChange={(e) => setMeeting(e.target.value)}>{meetings.map((m) => <option key={m.id} value={m.id}>{m.name} · {shortDate(m.date)}</option>)}</select></Field>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2 rounded-2xl bg-page p-2 pl-3 ring-1 ring-line">
            <input className="min-w-0 flex-1 bg-transparent text-[14.5px] font-medium outline-none" value={l.category} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} aria-label="Category" />
            <select className="rounded-lg bg-surface px-1.5 py-2 text-sm ring-1 ring-line" value={l.currency} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, currency: e.target.value } : x)))} aria-label="Currency">{currencies.map((c) => <option key={c}>{c}</option>)}</select>
            <input inputMode="numeric" className="num w-32 rounded-xl bg-surface px-3 py-2 text-right text-[16px] font-semibold ring-1 ring-line outline-none focus:ring-brand" value={l.amount || ""} placeholder="0" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} aria-label={`${l.category} amount`} />
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={() => setLines([...lines, { category: "Special offering", amount: 0, currency: "NGN" }])} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand"><Plus size={14} /> Add a line</button>
          {currencies.length > 1 && <button onClick={() => setLines([...lines, { category: "Offering", amount: 0, currency: currencies.find((c) => c !== "NGN")! }])} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand"><Banknote size={14} /> Other currency</button>}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-deep px-4 py-3 text-white"><span className="text-white/70">Total</span><span className="num text-2xl font-semibold">{money(lineTotal(lines))}</span></div>
      <Field label={needWitness ? "Witness" : "Witness (optional)"}><select className={inputCls} value={witness} onChange={(e) => setWitness(e.target.value)}><option value="">No witness</option>{ushers.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}</select></Field>
      <Button variant="primary" className="w-full py-3" disabled={!meetingId || lines.every((l) => !l.amount) || (needWitness && !witness)} onClick={() => {
        put("counts", { id: newId("fc"), meetingId, lines: lines.filter((l) => l.amount > 0), byId: me!.id, witnessId: witness || undefined, at: new Date().toISOString() }, "recorded an offering count");
        toast("Count saved. Thank you!"); onDone();
      }}><FileCheck2 size={16} /> Save count</Button>
      <p className="text-center text-[12.5px] text-muted">Once saved, changes need the lead pastor&apos;s approval.</p>
    </div>
  );
}

function CorrectionForm({ c, onDone }: { c: ServiceCount; onDone: () => void }) {
  const { me, put } = useStore();
  const [lines, setLines] = useState<CountLine[]>(c.lines.map((l) => ({ ...l })));
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">The lead pastor will see the old and new amounts, and your reason.</p>
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-2 rounded-2xl bg-page p-2 pl-3 ring-1 ring-line">
          <span className="flex-1 text-[14.5px] font-medium">{l.category} <span className="text-muted">({l.currency})</span></span>
          <span className="text-[12.5px] text-muted line-through">{money(c.lines[i].amount, l.currency, true)}</span>
          <input inputMode="numeric" className="num w-32 rounded-xl bg-surface px-3 py-2 text-right font-semibold ring-1 ring-line" value={l.amount || ""} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} />
        </div>
      ))}
      <Field label="Why the change?"><textarea className={cx(inputCls, "min-h-20")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A bundle was counted twice" /></Field>
      <Button variant="primary" className="w-full" disabled={!reason.trim()} onClick={() => { put("counts", { ...c, correction: { lines, reason: reason.trim(), byId: me!.id, at: new Date().toISOString(), status: "pending" } }, "asked for a count correction"); toast("Sent to the lead pastor"); onDone(); }}>Send for approval</Button>
    </div>
  );
}

function LodgeForm({ counts, onDone }: { counts: ServiceCount[]; onDone: () => void }) {
  const { me, put, newId } = useStore();
  const [ids, setIds] = useState<Set<string>>(new Set(counts.map((c) => c.id)));
  const [method, setMethod] = useState<Lodgement["method"]>("transfer");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(todayLagos());
  const counted = counts.filter((c) => ids.has(c.id)).reduce((n, c) => n + lineTotal(c.correction?.status === "approved" ? c.correction.lines : c.lines), 0);
  const diff = Number(amount) ? Number(amount) - counted : 0;
  return (
    <div className="space-y-4">
      <div><span className="mb-1.5 block text-sm font-medium">Which counts?</span>
        <ul className="space-y-1">{counts.map((c) => (
          <li key={c.id}><label className="flex items-center gap-3 rounded-xl bg-page px-3 py-2 text-[14px]"><input type="checkbox" className="size-4 accent-brand" checked={ids.has(c.id)} onChange={() => { const n = new Set(ids); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); setIds(n); }} /><span className="flex-1">{shortDate(c.at)}</span><span className="num font-semibold">{money(lineTotal(c.lines))}</span></label></li>
        ))}</ul>
      </div>
      <div><span className="mb-1.5 block text-sm font-medium">How</span>
        <div className="grid grid-cols-3 gap-1.5">{(Object.keys(METHOD) as Lodgement["method"][]).map((k) => { const M = METHOD[k]; return <button key={k} onClick={() => setMethod(k)} className={cx("flex flex-col items-center gap-1 rounded-xl py-2.5 text-[13px] ring-1", method === k ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}><M.icon size={17} />{M.label}</button>; })}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Amount lodged"><input inputMode="numeric" className={cx(inputCls, "num font-semibold")} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder={String(counted)} /></Field>
        <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Field label={method === "pos" ? "POS receipt number" : method === "deposit" ? "Teller number" : "Transfer reference"}><input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
      {diff !== 0 && <p className="flex items-center gap-2 rounded-xl bg-glow-soft px-3 py-2.5 text-[13.5px] text-glow-ink"><AlertTriangle size={16} /> {money(Math.abs(diff))} {diff < 0 ? "less" : "more"} than counted. It will be flagged for the lead pastor.</p>}
      <Button variant="primary" className="w-full py-3" disabled={!ids.size} onClick={() => {
        put("lodgements", { id: newId("lg"), countIds: [...ids], amount: Number(amount) || counted, currency: "NGN", method, reference: ref || undefined, byId: me!.id, date }, "recorded a lodgement");
        toast("Lodging recorded"); onDone();
      }}>Save</Button>
    </div>
  );
}

function TransferForm({ onDone }: { onDone: () => void }) {
  const { state, me, putMany, newId } = useStore();
  const cats = state.church.profile?.categories ?? ["Offering", "Tithe"];
  const [rows, setRows] = useState<Omit<Transfer, "id" | "byId">[]>([{ date: todayLagos(), category: cats[1] ?? cats[0], amount: 0 }]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">Totals from the bank statement, by kind. No names needed.</p>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr] gap-2 rounded-2xl bg-page p-3 ring-1 ring-line">
          <input type="date" className={inputCls} value={r.date} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
          <select className={inputCls} value={r.category} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}>{cats.map((c) => <option key={c}>{c}</option>)}</select>
          <input inputMode="numeric" className={cx(inputCls, "num font-semibold")} placeholder="Amount ₦" value={r.amount || ""} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} />
          <input className={inputCls} placeholder="Reference (optional)" value={r.reference ?? ""} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} />
        </div>
      ))}
      <button onClick={() => setRows([...rows, { date: rows.at(-1)!.date, category: cats[0], amount: 0 }])} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand"><Plus size={14} /> Another line</button>
      <Button variant="primary" className="w-full py-3" disabled={!rows.some((r) => r.amount)} onClick={() => { putMany("transfers", rows.filter((r) => r.amount).map((r) => ({ ...r, id: newId("tr"), byId: me!.id })), "added transfers"); toast("Transfers saved"); onDone(); }}>Save transfers</Button>
    </div>
  );
}
