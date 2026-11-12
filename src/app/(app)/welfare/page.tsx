"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, HandHeart, HeartHandshake, Lock, MessageSquareText, Plus, Send, ShieldCheck, Undo2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useWords } from "@/components/theme";
import { Avatar, Badge, Button, Empty, Field, Panel, Sheet, Tabs, Toggle, cx, inputCls, toast } from "@/components/ui";
import { BarList } from "@/components/charts";
import { WELFARE_KINDS, WELFARE_STAGE, firstStage, nextStage, welfareAction, welfareRoute, welfareStaff, welfareVisible } from "@/lib/domain";
import { ago, fullName, money, shortDate } from "@/lib/format";
import type { WelfareRequest } from "@/lib/types";

const LOG = "updated a welfare request";
const STEP_LABEL = { dept: "Department head", welfare: "Welfare head", pastorate: "Pastorate", lead: "Lead pastor" };

export default function WelfarePage() {
  const w = useWords();
  const { state, access, me } = useStore();
  const [tab, setTab] = useState<"mine" | "needs" | "open" | "done">("needs");
  const [openId, setOpenId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const visible = useMemo(() => (access ? state.welfare.filter((w) => welfareVisible(access, w)) : []), [state.welfare, access]);
  if (!access || !me) return null;
  const staffish = visible.some((w) => welfareStaff(access, w));
  const mine = visible.filter((w) => w.personId === me.id || w.raisedById === me.id);
  const staffList = visible.filter((w) => welfareStaff(access, w));
  const needs = staffList.filter((w) => welfareAction(state, access, w));
  const done = staffList.filter((w) => ["given", "closed", "declined"].includes(w.stage));
  const open = staffList.filter((w) => !done.includes(w));
  const list = !staffish ? mine : tab === "mine" ? mine : tab === "needs" ? needs : tab === "open" ? open : done;
  const current = state.welfare.find((w) => w.id === openId);

  return (
    <div className="mx-auto max-w-5xl">
      <section className="hero mb-6 px-6 pb-6 pt-7 md:px-9 md:pt-9">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-xl">
            <span className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-white/80"><Lock size={12} /> Private. Never sent to Google Sheets.</span>
            <h1 className="mt-3 font-display text-[32px] font-semibold leading-tight tracking-tight md:text-[40px]">{w.welfare}</h1>
            <p className="mt-1 text-white/70">{staffish ? "Caring for one another, with every request minuted and decided in the open." : "Ask for help privately. Only the Welfare head and the pastors will see it."}</p>
          </div>
          <Button variant="light" onClick={() => setAsking(true)}><Plus size={16} /> Ask for support</Button>
        </div>
        {staffish && (
          <div className="mt-7 grid grid-cols-3 gap-2.5">
            {[[needs.length, "need you"], [open.length, "in progress"], [done.filter((w) => w.stage === "given" && (w.givenAt ?? "") > new Date(Date.now() - 30 * 864e5).toISOString()).length, "helped this month"]].map(([n, l]) => (
              <div key={l} className="glass rounded-2xl px-4 py-3"><p className="num text-[28px] font-semibold">{n}</p><p className="text-[13px] text-white/65">{l}</p></div>
            ))}
          </div>
        )}
      </section>

      {staffish && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={tab} onChange={setTab} items={[
            { key: "needs", label: "Needs you", count: needs.length }, { key: "open", label: "In progress", count: open.length },
            { key: "done", label: "Finished", count: done.length }, ...(mine.length ? [{ key: "mine" as const, label: "My requests", count: mine.length }] : []),
          ]} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-3">
          {list.length === 0 ? (
            <Empty title={tab === "needs" && staffish ? "Nothing waiting on you" : "No requests here"} body={tab === "needs" && staffish ? "When a request needs your minute or decision, it shows up here." : "If you're going through something, you don't have to carry it alone."} icon={<HeartHandshake size={26} />} />
          ) : list.map((w) => <RequestCard key={w.id} w={w} onOpen={() => setOpenId(w.id)} />)}
        </div>
        {staffish && (access.isPastoral || access.isLead) && <MonthlySummary />}
      </div>

      <Sheet open={!!current} onClose={() => setOpenId(null)} title="Welfare request">{current && <RequestDetail w={current} onDone={() => setOpenId(null)} />}</Sheet>
      <Sheet open={asking} onClose={() => setAsking(false)} title="Ask for support"><NewRequest onDone={() => setAsking(false)} /></Sheet>
    </div>
  );
}

function RequestCard({ w, onOpen }: { w: WelfareRequest; onOpen: () => void }) {
  const { state, access } = useStore();
  const p = state.people.find((x) => x.id === w.personId);
  const staff = welfareStaff(access!, w);
  const act = welfareAction(state, access!, w);
  const st = WELFARE_STAGE[w.stage];
  return (
    <button onClick={onOpen} className="card card-hover flex w-full items-center gap-4 p-4 text-left md:p-5">
      <Avatar person={p} size={46} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{p ? fullName(p) : "Someone"}</span>
          <Badge tone="neutral">{w.kind}</Badge>
          {w.urgent && <Badge tone="alert">Urgent</Badge>}
          {w.private && <Badge tone="dark"><Lock size={11} /> Private</Badge>}
        </span>
        <span className="mt-1 block truncate text-[13.5px] text-ink-soft">{staff ? w.details : "Your request is being looked after."}</span>
        <Track w={w} />
      </span>
      <span className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
        <Badge tone={st.tone}>{st.label}</Badge>
        {act && <span className="text-[12px] font-semibold text-brand">{act === "minute" ? "Add your minute" : act === "decide" ? "Decide" : act === "assign" ? "Assign" : "Mark as given"} →</span>}
        <span className="text-[11.5px] text-muted">{ago(w.createdAt)}</span>
      </span>
      <ChevronRight size={18} className="text-muted sm:hidden" />
    </button>
  );
}

/** The route as a row of steps, filled in as each one is done. */
function Track({ w }: { w: WelfareRequest }) {
  const route = w.private ? w.route.filter((r) => r !== "dept") : w.route;
  const finished = ["approved", "declined", "delivering", "given", "closed"].includes(w.stage);
  const idx = finished ? route.length : route.indexOf(w.stage as never);
  return (
    <span className="mt-2.5 flex flex-wrap items-center gap-1">
      {route.map((r, i) => (
        <span key={r} className="flex items-center gap-1">
          <span className={cx("flex h-5 items-center gap-1 rounded-full px-2 text-[10.5px] font-medium", i < idx ? "bg-good-soft text-good" : i === idx ? "bg-brand text-white" : "bg-page text-muted ring-1 ring-line")}>
            {i < idx && <Check size={10} />}{STEP_LABEL[r]}
          </span>
          {i < route.length - 1 && <span className="h-px w-2 bg-line" />}
        </span>
      ))}
      <span className="h-px w-2 bg-line" />
      <span className={cx("h-5 rounded-full px-2 text-[10.5px] font-medium leading-5", w.stage === "given" ? "bg-good text-white" : w.stage === "declined" ? "bg-deep-2 text-white" : "bg-page text-muted ring-1 ring-line")}>{w.stage === "declined" ? "Declined" : "Given"}</span>
    </span>
  );
}

function RequestDetail({ w, onDone }: { w: WelfareRequest; onDone: () => void }) {
  const { state, access, me, put } = useStore();
  const p = state.people.find((x) => x.id === w.personId);
  const staff = welfareStaff(access!, w);
  const act = welfareAction(state, access!, w);
  const limit = state.church.profile?.approvalLimit ?? 100000;
  const ask = Math.max(0, ...w.minutes.map((m) => m.amount ?? 0));
  const [text, setText] = useState("");
  const [support, setSupport] = useState("");
  const [amount, setAmount] = useState(ask ? String(ask) : "");
  const [involve, setInvolve] = useState(true);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"approve" | "decline" | "back" | null>(null);
  const [assignee, setAssignee] = useState("");
  const now = new Date().toISOString();
  const roleLabel = w.stage === "dept" ? "Department head" : w.stage === "welfare" ? "Welfare head" : access!.isLead ? "Lead pastor" : "Pastor";
  const save = (next: WelfareRequest, msg: string) => { put("welfare", next, LOG); toast(msg); onDone(); };
  const team = state.groups.filter((g) => g.tags?.includes("welfare")).flatMap((g) => g.memberIds).map((id) => state.people.find((x) => x.id === id)).filter(Boolean) as typeof state.people;

  if (!staff) return (
    <div>
      <p className="text-sm text-muted">Requested {shortDate(w.createdAt)}</p>
      <p className="mt-1 font-display text-xl font-semibold">{w.kind}</p>
      <div className="mt-4"><Badge tone={WELFARE_STAGE[w.stage].tone}>{WELFARE_STAGE[w.stage].label}</Badge></div>
      <Track w={w} />
      <p className="mt-6 rounded-2xl bg-page p-4 text-[14px] text-ink-soft">The people looking after this can see what you shared. You&apos;ll be told here when there&apos;s news.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar person={p} size={48} />
        <div className="min-w-0 flex-1"><p className="font-display text-lg font-semibold">{fullName(p)}</p><p className="text-[13px] text-muted">{w.kind} · raised {ago(w.createdAt)}{w.raisedById !== w.personId ? ` by ${fullName(state.people.find((x) => x.id === w.raisedById))}` : ""}</p></div>
      </div>
      <div className="flex flex-wrap gap-1.5">{w.urgent && <Badge tone="alert">Urgent</Badge>}{w.private && <Badge tone="dark"><Lock size={11} /> Private</Badge>}<Badge tone={WELFARE_STAGE[w.stage].tone}>{WELFARE_STAGE[w.stage].label}</Badge></div>
      <p className="rounded-2xl bg-page p-4 text-[14.5px] leading-relaxed">{w.details}</p>

      <div>
        <p className="mb-2 text-sm font-semibold">Minutes</p>
        {w.minutes.length === 0 ? <p className="text-sm text-muted">No minutes yet.</p> : (
          <ol className="relative space-y-4 border-l-2 border-line pl-5">
            {w.minutes.map((m, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[27px] top-1 size-3 rounded-full bg-brand ring-4 ring-surface" />
                <p className="text-[13px] text-muted"><b className="font-semibold text-ink">{fullName(state.people.find((x) => x.id === m.byId))}</b> · {m.role} · {ago(m.at)}</p>
                <p className="mt-1 text-[14.5px]">{m.text}</p>
                {(m.suggested || m.amount) && <p className="mt-1 text-[13px] text-ink-soft">Suggests: {m.suggested}{m.amount ? ` · ${money(m.amount)}` : ""}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      {w.decision && (
        <div className={cx("rounded-2xl p-4", w.decision.approved ? "bg-good-soft" : "bg-page")}>
          <p className="font-semibold">{w.decision.approved ? `Approved${w.decision.amount ? `: ${money(w.decision.amount)}` : ""}` : "Not approved"}</p>
          <p className="text-[13.5px] text-ink-soft">{w.decision.approved ? w.decision.support : w.decision.reason} · {fullName(state.people.find((x) => x.id === w.decision!.byId))}</p>
          {w.assigneeId && <p className="mt-1 text-[13px] text-ink-soft">Being delivered by {fullName(state.people.find((x) => x.id === w.assigneeId))}</p>}
          {w.givenNote && <p className="mt-1 text-[13px] text-good">Given: {w.givenNote}</p>}
        </div>
      )}

      {act === "minute" && (
        <div className="space-y-3 rounded-2xl p-4 ring-1 ring-brand/30">
          <p className="flex items-center gap-2 font-semibold"><MessageSquareText size={17} className="text-brand" /> Your minute</p>
          <textarea className={cx(inputCls, "min-h-24")} value={text} onChange={(e) => setText(e.target.value)} placeholder="What you know about the situation and what you recommend" />
          <div className="grid grid-cols-[1fr_140px] gap-2">
            <input className={inputCls} value={support} onChange={(e) => setSupport(e.target.value)} placeholder="Suggested support" />
            <input className={inputCls} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="Amount ₦" />
          </div>
          <Button variant="primary" className="w-full" disabled={!text.trim()} onClick={() => save({ ...w, stage: nextStage(w), minutes: [...w.minutes, { byId: me!.id, role: roleLabel, text: text.trim(), suggested: support || undefined, amount: Number(amount) || undefined, at: now }] }, "Minute added and passed on")}>
            <Send size={15} /> Add minute and pass to {nextStage(w) === "pastorate" ? "the pastorate" : STEP_LABEL[nextStage(w) as keyof typeof STEP_LABEL]}
          </Button>
        </div>
      )}

      {act === "decide" && (
        <div className="space-y-3 rounded-2xl p-4 ring-1 ring-brand/30">
          <p className="flex items-center gap-2 font-semibold"><ShieldCheck size={17} className="text-brand" /> Your decision</p>
          {ask > limit && !access!.isLead && <p className="text-[13px] text-glow-ink">Above {money(limit)}, so the lead pastor decides.</p>}
          <div className="grid grid-cols-3 gap-1.5">
            {([["approve", "Approve", Check], ["decline", "Decline", X], ["back", "Send back", Undo2]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => setMode(k)} className={cx("flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm ring-1", mode === k ? "bg-deep text-white ring-deep" : "bg-page ring-line")}><I size={15} />{l}</button>
            ))}
          </div>
          {mode === "approve" && <>
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <input className={inputCls} value={support} onChange={(e) => setSupport(e.target.value)} placeholder="Support to give, e.g. Rent support" />
              <input className={inputCls} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="Amount ₦" />
            </div>
            {Number(amount) > limit && !access!.isLead && <p className="text-[13px] text-glow-ink">This is above your approval limit of {money(limit)}. It will go to the lead pastor.</p>}
            <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line">Involve the Welfare team in delivering it <Toggle label="Involve welfare" on={involve} onChange={setInvolve} /></label>
            <Button variant="primary" className="w-full" disabled={!support.trim()} onClick={() => {
              if (Number(amount) > limit && !access!.isLead) return save({ ...w, stage: "lead", minutes: [...w.minutes, { byId: me!.id, role: "Pastor", text: `Recommends approval: ${support}`, amount: Number(amount) || undefined, at: now }] }, "Sent to the lead pastor");
              save({ ...w, stage: "approved", involveWelfare: involve, decision: { byId: me!.id, approved: true, amount: Number(amount) || undefined, support: support.trim(), at: now } }, "Approved");
            }}>Approve</Button>
          </>}
          {(mode === "decline" || mode === "back") && <>
            <textarea className={cx(inputCls, "min-h-20")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === "decline" ? "Reason (shared with the people who minuted it)" : "What should they look into?"} />
            <Button variant="primary" className="w-full" disabled={!reason.trim()} onClick={() => mode === "decline"
              ? save({ ...w, stage: "declined", decision: { byId: me!.id, approved: false, reason: reason.trim(), at: now } }, "Request declined")
              : save({ ...w, stage: firstStage(w.route, w.private), minutes: [...w.minutes, { byId: me!.id, role: "Pastor", text: `Sent back: ${reason.trim()}`, at: now }] }, "Sent back for more information")}>
              {mode === "decline" ? "Decline request" : "Send back"}
            </Button>
          </>}
        </div>
      )}

      {act === "assign" && (
        <div className="space-y-3 rounded-2xl p-4 ring-1 ring-brand/30">
          <p className="font-semibold">Who will deliver it?</p>
          <select className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Choose a Welfare team member</option>{team.map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}</select>
          <Button variant="primary" className="w-full" disabled={!assignee} onClick={() => save({ ...w, stage: "delivering", assigneeId: assignee }, "Assigned")}>Assign</Button>
        </div>
      )}

      {act === "deliver" && (
        <div className="space-y-3 rounded-2xl p-4 ring-1 ring-good/30">
          <p className="flex items-center gap-2 font-semibold"><HandHeart size={17} className="text-good" /> Mark as given</p>
          <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="What was given and when" />
          <Button variant="primary" className="w-full bg-good hover:bg-good/90" disabled={!text.trim()} onClick={() => save({ ...w, stage: "given", givenNote: text.trim(), givenAt: now }, "Marked as given. Thank you for caring.")}>Support given</Button>
        </div>
      )}
    </div>
  );
}

function NewRequest({ onDone }: { onDone: () => void }) {
  const { state, access, me, put, newId } = useStore();
  const canRaiseForOthers = !access!.isMemberOnly;
  const people = canRaiseForOthers ? access!.visiblePeople().filter((p) => !p.isChild) : [];
  const [forId, setFor] = useState(me!.id);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [priv, setPriv] = useState(false);
  const route = welfareRoute(state, forId);
  const routeText = (priv ? route.route.filter((r) => r !== "dept") : route.route).map((r) => STEP_LABEL[r]).join(" → ");
  const matches = q.length > 1 ? people.filter((p) => fullName(p).toLowerCase().includes(q.toLowerCase())).slice(0, 5) : [];
  const forP = state.people.find((p) => p.id === forId);
  return (
    <div className="space-y-4">
      {canRaiseForOthers && (
        <Field label="Who is it for?">
          <div className="flex items-center gap-2 rounded-xl bg-page p-2 ring-1 ring-line"><Avatar person={forP} size={30} /><span className="flex-1 text-sm font-medium">{forId === me!.id ? "Me" : fullName(forP)}</span>{forId !== me!.id && <button onClick={() => setFor(me!.id)} className="text-[13px] text-brand">Change to me</button>}</div>
          <input className={cx(inputCls, "mt-2")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Or search for someone in your care" />
          {matches.map((p) => <button key={p.id} onClick={() => { setFor(p.id); setQ(""); }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-page"><Avatar person={p} size={26} />{fullName(p)}</button>)}
        </Field>
      )}
      <Field label="What kind of support?">
        <div className="flex flex-wrap gap-1.5">{WELFARE_KINDS.map((k) => <button key={k} onClick={() => setKind(k)} className={cx("rounded-full px-3 py-2 text-sm ring-1", kind === k ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}>{k}</button>)}</div>
      </Field>
      <Field label="Tell us what's happening"><textarea className={cx(inputCls, "min-h-28")} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
      <Field label="Amount needed, if any"><input className={inputCls} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="₦" /></Field>
      <label className="flex items-center justify-between rounded-xl bg-page p-3 text-sm ring-1 ring-line">It&apos;s urgent <Toggle label="Urgent" on={urgent} onChange={setUrgent} /></label>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line"><span><b className="font-semibold">Keep it private</b><br /><span className="text-muted">Only the Welfare head and the pastors see it.</span></span><Toggle label="Private" on={priv} onChange={setPriv} /></label>
      <p className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-[13px] text-brand"><ArrowLeft size={14} className="rotate-180" /> Goes to: {routeText}</p>
      <Button variant="primary" className="w-full py-3" disabled={!kind || !details.trim()} onClick={() => {
        put("welfare", {
          id: newId("w"), personId: forId, raisedById: me!.id, kind, details: details.trim(), urgent, private: priv,
          route: route.route, deptGroupId: route.deptGroupId, stage: firstStage(route.route, priv),
          minutes: amount ? [{ byId: me!.id, role: forId === me!.id ? "Request" : "Raised by", text: "Amount requested", amount: Number(amount), at: new Date().toISOString() }] : [],
          createdAt: new Date().toISOString(),
        }, LOG);
        toast("Request sent. You're not alone in this."); onDone();
      }}>Send request</Button>
    </div>
  );
}

function MonthlySummary() {
  const { state } = useStore();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const month = state.welfare.filter((w) => w.createdAt >= since);
  const approved = state.welfare.filter((w) => w.decision?.approved && w.decision.at >= since);
  const total = approved.reduce((n, w) => n + (w.decision?.amount ?? 0), 0);
  const kinds = new Map<string, number>();
  month.forEach((w) => kinds.set(w.kind, (kinds.get(w.kind) ?? 0) + 1));
  return (
    <Panel title="This month" className="h-fit">
      <div className="grid grid-cols-2 gap-3">
        <div><p className="num text-[26px] font-semibold">{month.length}</p><p className="text-[12.5px] text-muted">requests</p></div>
        <div><p className="num text-[26px] font-semibold text-good">{money(total, "NGN", true)}</p><p className="text-[12.5px] text-muted">approved</p></div>
      </div>
      <div className="mt-5"><BarList items={[...kinds.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n)} color="bg-j3" /></div>
    </Panel>
  );
}
