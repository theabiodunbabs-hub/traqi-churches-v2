"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, CalendarCheck, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, Forward, Lock, MapPin, MessageCircleHeart, Send, Settings2, Shuffle, Video, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { SeedState } from "@/lib/seed";
import type { Access } from "@/lib/access";
import { Avatar, Badge, Button, Empty, Field, PageHeader, Sheet, Tabs, cx, inputCls, toast } from "@/components/ui";
import { saveBlob } from "@/lib/download";
import { ago, fullName, shortDate, todayLagos } from "@/lib/format";
import type { CounselDelegate, CounselRequest, CounselSetup, Person } from "@/lib/types";

const URGENCY: { key: CounselRequest["urgency"]; label: string; sub: string }[] = [
  { key: "urgent", label: "Urgent", sub: "Within 48 hours" },
  { key: "soon", label: "Soon", sub: "In 1 to 2 weeks" },
  { key: "convenient", label: "When convenient", sub: "A month or more" },
];
const TAGS = ["Marriage", "Pre-marital", "Family", "Children", "Grief", "Career", "Finances", "Health", "Spiritual growth", "Relationships", "Other"];
const PERMS: { key: CounselDelegate["perms"][number]; label: string; sub: string }[] = [
  { key: "manage", label: "See and manage", sub: "Sees the requests and the schedule" },
  { key: "approve", label: "Book sessions", sub: "Approves and sets the date, time and place" },
  { key: "reply", label: "Reply", sub: "Adds notes and replies to the member" },
  { key: "reassign", label: "Refer on", sub: "Sends a request to someone better placed" },
];
const RECEIVED = "Kindly keep checking your dashboard for a response from the pastorate.";
const REFERRED = "Your counselling request has been directed to the appropriate quarters. You will be contacted soon.";
const t12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/** The pastor who handles a request: the branch pastor for branch members, otherwise the lead pastor. */
function pastorFor(s: SeedState, r: Pick<CounselRequest, "branchId">): string | undefined {
  const roleKey = (id: string) => s.roles.find((x) => x.id === id)?.key;
  if (r.branchId) { const b = s.assignments.find((a) => roleKey(a.roleId) === "pastor" && a.scope.type === "branch" && a.scope.branchId === r.branchId); if (b) return b.personId; }
  return s.assignments.find((a) => roleKey(a.roleId) === "lead")?.personId;
}
const setupOf = (s: SeedState): CounselSetup => s.church.profile?.counselling ?? { step: 0, delegates: [] };
const delegateOf = (s: SeedState, id: string) => setupOf(s).delegates.find((d) => d.personId === id);

/** What this person can do with this request. Only the handler and the pastor read what it says. */
function rights(s: SeedState, a: Access, r: CounselRequest) {
  const pastor = pastorFor(s, r) === a.personId;
  const d = !r.branchId ? delegateOf(s, a.personId) : undefined;
  const handler = r.handlerId === a.personId;
  const triage = !!d?.perms.includes("manage") && (r.status === "new" || r.handlerId === a.personId || (r.status === "scheduled" && r.handlerId === pastorFor(s, r)));
  const has = (p: CounselDelegate["perms"][number]) => pastor || handler || !!d?.perms.includes(p);
  return {
    sees: pastor || handler || triage || r.personId === a.personId,
    reads: pastor || handler || (triage && r.status === "new"),
    book: (pastor || handler || (triage && has("approve"))) && r.status !== "done",
    reply: pastor || handler || (triage && has("reply")),
    refer: (pastor || handler || (triage && has("reassign"))) && r.status !== "done",
    forward: !pastor && triage && r.status === "new",
    pastor, staff: pastor || handler || triage,
  };
}

function calendar(r: CounselRequest, title: string) {
  if (!r.appt) return;
  const start = new Date(`${r.appt.date}T${r.appt.time}:00+01:00`); const end = new Date(start.getTime() + 60 * 60e3);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const where = r.appt.mode === "virtual" ? r.appt.link ?? "Online" : r.appt.mode === "phone" ? "Phone call" : r.appt.venue ?? "";
  saveBlob(new Blob([["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Traqi//Counselling//EN", "BEGIN:VEVENT", `UID:${r.id}@traqi.space`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`, `SUMMARY:${title}`, `LOCATION:${where}`, "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n")], { type: "text/calendar" }), "counselling.ics");
}
function CalendarButtons({ r, title }: { r: CounselRequest; title: string }) {
  if (!r.appt) return null;
  const start = new Date(`${r.appt.date}T${r.appt.time}:00+01:00`); const end = new Date(start.getTime() + 60 * 60e3);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const where = r.appt.mode === "virtual" ? r.appt.link ?? "Online" : r.appt.mode === "phone" ? "Phone call" : r.appt.venue ?? "";
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => calendar(r, title)}><CalendarPlus size={15} /> Add to calendar</Button>
      <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${f(start)}/${f(end)}&location=${encodeURIComponent(where)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-brand ring-1 ring-line">Google Calendar <ArrowUpRight size={14} /></a>
    </div>
  );
}
function ApptLine({ r }: { r: CounselRequest }) {
  if (!r.appt) return null;
  const I = r.appt.mode === "virtual" ? Video : MapPin;
  return (
    <div className="rounded-2xl bg-good-soft p-4 text-[14.5px]">
      <p className="flex items-center gap-2 font-semibold text-good"><CalendarCheck size={17} /> {shortDate(r.appt.date)}, {t12(r.appt.time)}</p>
      <p className="mt-1 flex items-center gap-2"><I size={15} className="text-ink-soft" />{r.appt.mode === "virtual" ? <a href={r.appt.link} target="_blank" rel="noreferrer" className="font-medium text-brand">{r.appt.link ?? "Online"}</a> : r.appt.mode === "phone" ? "Phone call" : r.appt.venue}</p>
    </div>
  );
}

export default function CounsellingPage() { return <Suspense><Counselling /></Suspense>; }

function Counselling() {
  const { state, access, me } = useStore();
  const q = useSearchParams();
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"inbox" | "booked" | "done" | "mine">("inbox");
  const [wizard, setWizard] = useState(false);
  useEffect(() => { if (q.has("new")) setAsking(true); }, [q]);
  if (!access || !me) return null;
  const setup = setupOf(state);
  const isPastor = state.assignments.some((a) => a.personId === me.id && (state.roles.find((r) => r.id === a.roleId)?.key === "lead" || (state.roles.find((r) => r.id === a.roleId)?.key === "pastor" && a.scope.type === "branch")));
  const leadPastor = state.assignments.some((a) => a.personId === me.id && state.roles.find((r) => r.id === a.roleId)?.key === "lead");
  const staffList = state.counsel.filter((r) => r.personId !== me.id && rights(state, access, r).staff);
  const mine = state.counsel.filter((r) => r.personId === me.id).sort((a, b) => b.at.localeCompare(a.at));
  const staff = isPastor || !!delegateOf(state, me.id) || staffList.length > 0;
  const urgentFirst = (a: CounselRequest, b: CounselRequest) => URGENCY.findIndex((u) => u.key === a.urgency) - URGENCY.findIndex((u) => u.key === b.urgency) || a.at.localeCompare(b.at);
  const lists = {
    inbox: staffList.filter((r) => r.status === "new" || r.status === "forwarded" || (r.status === "referred" && r.handlerId === me.id)).sort(urgentFirst),
    booked: staffList.filter((r) => r.status === "scheduled").sort((a, b) => `${a.appt?.date}${a.appt?.time}`.localeCompare(`${b.appt?.date}${b.appt?.time}`)),
    done: staffList.filter((r) => r.status === "done" || r.status === "cancelled" || (r.status === "referred" && r.handlerId !== me.id)),
    mine,
  };
  const t = staff ? tab : "mine";
  const needsSetup = leadPastor && !setup.done;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Counselling" sub={staff ? "Requests for counselling, and the sessions you've booked." : "Talk to the pastorate about something on your heart. It stays private."}
        actions={<div className="flex gap-2">{leadPastor && setup.done && <Button onClick={() => setWizard(true)}><Settings2 size={15} /> Who helps you</Button>}<Button variant="primary" onClick={() => setAsking(true)}><MessageCircleHeart size={16} /> Ask for counselling</Button></div>} />
      {needsSetup && (
        <section className="card mb-5 flex flex-wrap items-center gap-4 border-l-4 border-brand p-5">
          <span className="min-w-[14rem] flex-1"><b className="block font-display text-[17px]">Set up how counselling works for you</b><span className="text-[14px] text-ink-soft">Pick who sees your schedule and what each can do. Takes 2 minutes{setup.step ? `; you're on step ${setup.step + 1} of 4` : ""}.</span></span>
          <Button variant="primary" onClick={() => setWizard(true)}>{setup.step ? "Carry on" : "Start"} <ChevronRight size={15} /></Button>
        </section>
      )}
      {staff && <div className="mb-4"><Tabs value={t} onChange={setTab} items={[{ key: "inbox", label: "To handle", count: lists.inbox.length }, { key: "booked", label: "Booked", count: lists.booked.length }, { key: "done", label: "Done" }, { key: "mine", label: "My requests", count: mine.length || undefined }]} /></div>}
      {lists[t].length === 0 ? <Empty title={t === "mine" ? "No requests yet" : "Nothing here"} body={t === "mine" ? "Tap “Ask for counselling” when you'd like to talk to a pastor." : "Requests will show here."} icon={<MessageCircleHeart size={26} />} /> : (
        <ul className="space-y-2.5">{lists[t].map((r) => <Row key={r.id} r={r} own={t === "mine"} onOpen={() => setOpen(r.id)} />)}</ul>
      )}
      <AskForm open={asking} onClose={() => setAsking(false)} />
      {open && state.counsel.find((x) => x.id === open) && <Detail id={open} onClose={() => setOpen(null)} />}
      {wizard && <SetupWizard onClose={() => setWizard(false)} />}
    </div>
  );
}

function memberStatus(r: CounselRequest) {
  if (r.status === "scheduled") return { label: "Booked", tone: "good" as const, line: "Your session is booked." };
  if (r.status === "referred") return { label: "Referred", tone: "brand" as const, line: REFERRED };
  if (r.status === "done") return { label: "Done", tone: "neutral" as const, line: "This session has ended." };
  if (r.status === "cancelled") return { label: "Cancelled", tone: "neutral" as const, line: "This request was cancelled." };
  return { label: "Received", tone: "glow" as const, line: RECEIVED };
}

function Row({ r, own, onOpen }: { r: CounselRequest; own: boolean; onOpen: () => void }) {
  const { state, access } = useStore();
  const p = state.people.find((x) => x.id === r.personId);
  const u = URGENCY.find((x) => x.key === r.urgency)!;
  const reads = access ? rights(state, access, r).reads || own : false;
  const st = own ? memberStatus(r) : null;
  return (
    <li>
      <button type="button" onClick={onOpen} className="card card-hover flex w-full items-center gap-3 p-4 text-left">
        {p && !own ? <Avatar person={p} size={40} /> : <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand"><MessageCircleHeart size={18} /></span>}
        <span className="min-w-0 flex-1">
          <b className="block truncate font-medium">{own ? r.tags.join(", ") || "Counselling" : p ? fullName(p) : "Member"}</b>
          <span className="block truncate text-[13px] text-muted">{own ? st!.line : reads ? r.description : <span className="inline-flex items-center gap-1"><Lock size={12} /> Private to the person handling it</span>}</span>
        </span>
        <span className="text-right text-[12px] text-muted">{r.appt && r.status === "scheduled" ? <b className="block text-[13px] text-good">{shortDate(r.appt.date)}, {t12(r.appt.time)}</b> : ago(r.at)}</span>
        {own ? <Badge tone={st!.tone}>{st!.label}</Badge> : <Badge tone={r.urgency === "urgent" ? "alert" : r.urgency === "soon" ? "glow" : "neutral"}>{u.label}</Badge>}
      </button>
    </li>
  );
}

function AskForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, put, newId } = useStore();
  const [f, setF] = useState({ urgency: "soon" as CounselRequest["urgency"], timeline: "", description: "", tags: [] as string[] });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  if (!me) return null;
  const send = () => {
    if (f.description.trim().length < 10) return setErr("Tell us a little about what you'd like to talk about.");
    put("counsel", { id: newId("cs"), personId: me.id, at: new Date().toISOString(), urgency: f.urgency, timeline: f.urgency === "convenient" ? f.timeline.trim() || undefined : undefined, description: f.description.trim(), tags: f.tags, branchId: me.branchId, status: "new", log: [{ at: new Date().toISOString(), byId: me.id, text: "Asked for counselling" }] }, "asked for counselling");
    setSent(true); setF({ urgency: "soon", timeline: "", description: "", tags: [] });
  };
  const close = () => { setSent(false); setErr(""); onClose(); };
  return (
    <Sheet open={open} onClose={close} title={sent ? "Request sent" : "Ask for counselling"} footer={sent ? <Button variant="primary" className="w-full py-3" onClick={close}>Done</Button> : <div className="space-y-2">{err && <p className="text-sm text-alert" role="alert">{err}</p>}<Button variant="primary" className="w-full py-3" onClick={send}><Send size={16} /> Send request</Button></div>}>
      {sent ? (
        <div className="py-6 text-center"><span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-good-soft text-good"><Check size={28} /></span><p className="text-[16px]">We&apos;ve received your request.</p><p className="mt-2 text-ink-soft">{RECEIVED}</p></div>
      ) : (
        <div className="space-y-5">
          <Field label="How soon do you need it?">
            <div className="grid gap-2 sm:grid-cols-3">{URGENCY.map((u) => <button type="button" key={u.key} onClick={() => setF({ ...f, urgency: u.key })} className={cx("rounded-2xl p-3 text-left ring-1", f.urgency === u.key ? "bg-brand-soft ring-brand" : "bg-page ring-line")}><b className="block text-[14.5px]">{u.label}</b><span className="text-[12.5px] text-muted">{u.sub}</span></button>)}</div>
            {f.urgency === "convenient" && <input className={cx(inputCls, "mt-2")} value={f.timeline} onChange={(e) => setF({ ...f, timeline: e.target.value })} placeholder="Your preferred time (optional), e.g. any Saturday in March" />}
          </Field>
          <Field label="What would you like to talk about?" hint="Only the pastor and the person handling your request will read this."><textarea className={cx(inputCls, "min-h-28")} value={f.description} onChange={(e) => { setF({ ...f, description: e.target.value }); setErr(""); }} /></Field>
          <Field label="What is it about? (optional)">
            <div className="flex flex-wrap gap-1.5">{TAGS.map((t) => { const on = f.tags.includes(t); return <button type="button" key={t} onClick={() => setF({ ...f, tags: on ? f.tags.filter((x) => x !== t) : [...f.tags, t] })} className={cx("min-h-9 rounded-full px-3 text-[13px] ring-1", on ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}>{t}</button>; })}</div>
          </Field>
        </div>
      )}
    </Sheet>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, access, me, put } = useStore();
  const r = state.counsel.find((x) => x.id === id)!;
  const setup = setupOf(state);
  const [mode, setMode] = useState<null | "book" | "refer">(null);
  const [note, setNote] = useState("");
  const [b, setB] = useState(() => ({ date: r.appt?.date ?? todayLagos(), time: r.appt?.time ?? "10:00", mode: r.appt?.mode ?? ("in-person" as "in-person" | "virtual" | "phone"), venue: r.appt?.venue ?? setup.venue ?? "", link: r.appt?.link ?? setup.link ?? "", who: r.handlerId ?? pastorFor(state, r) ?? "" }));
  const [q, setQ] = useState("");
  if (!access || !me) return null;
  const own = r.personId === me.id;
  const can = rights(state, access, r);
  const p = state.people.find((x) => x.id === r.personId);
  const pastorId = pastorFor(state, r);
  const now = () => new Date().toISOString();
  const nm = (id?: string) => { const x = state.people.find((y) => y.id === id); return x ? fullName(x) : ""; };
  const save = (patch: Partial<CounselRequest>, text: string, toastText: string) => { put("counsel", { ...r, ...patch, log: [...r.log, { at: now(), byId: me.id, text }] }, text.toLowerCase()); toast(toastText); setMode(null); setNote(""); };
  const found = q.trim() ? state.people.filter((x) => !x.isChild && x.id !== r.personId && (x.stage === "leader" || x.stage === "worker") && fullName(x).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const status = own ? memberStatus(r) : null;
  const meetWith = [pastorId, me.id, ...setup.delegates.map((d) => d.personId)].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);

  return (
    <Sheet open onClose={onClose} wide title={own ? "Your counselling request" : p ? fullName(p) : "Counselling request"}>
      <div className="mb-4 flex flex-wrap gap-2"><Badge tone={r.urgency === "urgent" ? "alert" : r.urgency === "soon" ? "glow" : "neutral"}>{URGENCY.find((u) => u.key === r.urgency)?.label}</Badge>{r.tags.map((t) => <Badge key={t}>{t}</Badge>)}<span className="text-[13px] text-muted">Sent {ago(r.at)}</span></div>
      {own && status && <p className="mb-4 rounded-2xl bg-page p-4 text-[14.5px]">{status.line}</p>}
      {(can.reads || own) ? <p className="mb-4 whitespace-pre-line rounded-2xl bg-page p-4 text-[14.5px]">{r.description}</p> : <p className="mb-4 flex items-center gap-2 rounded-2xl bg-page p-4 text-[14px] text-muted"><Lock size={15} /> Only {nm(r.handlerId) || "the person handling it"} and the pastor can read this.</p>}
      {r.timeline && <p className="mb-4 flex items-center gap-2 text-[14px]"><Clock size={15} className="text-brand" />Prefers: {r.timeline}</p>}
      {r.appt && r.status === "scheduled" && (
        <div className="mb-4 space-y-3">
          <ApptLine r={r} />
          {!own && r.handlerId && <p className="text-[13.5px] text-ink-soft">With {nm(r.handlerId)}</p>}
          <CalendarButtons r={r} title={own ? `Counselling with ${nm(r.handlerId) || "the pastorate"}` : `Counselling: ${p ? fullName(p) : "member"}`} />
        </div>
      )}

      {!own && can.staff && !mode && (
        <div className="flex flex-wrap gap-2">
          {can.book && <Button variant="primary" onClick={() => setMode("book")}><CalendarCheck size={15} /> {r.status === "scheduled" ? "Reschedule" : "Book a session"}</Button>}
          {can.forward && pastorId && <Button onClick={() => save({ status: "forwarded", handlerId: pastorId }, `Forwarded to ${nm(pastorId)}`, "Forwarded to the pastor")}><Forward size={15} /> Forward to the pastor</Button>}
          {can.refer && <Button onClick={() => setMode("refer")}><Shuffle size={15} /> Refer on</Button>}
          {r.status === "scheduled" && <Button onClick={() => save({ status: "done" }, "Marked the session done", "Marked done")}><Check size={15} /> Session held</Button>}
        </div>
      )}
      {mode === "book" && (
        <div className="space-y-3 rounded-2xl bg-page p-4 ring-1 ring-line">
          <div className="grid grid-cols-2 gap-3"><Field label="Date"><input type="date" className={inputCls} value={b.date} min={todayLagos()} onChange={(e) => setB({ ...b, date: e.target.value })} /></Field><Field label="Time"><input type="time" className={inputCls} value={b.time} onChange={(e) => setB({ ...b, time: e.target.value })} /></Field></div>
          <Field label="How"><div className="flex gap-1.5">{([["in-person", "In person"], ["virtual", "Online"], ["phone", "Phone call"]] as const).map(([k, l]) => <button type="button" key={k} onClick={() => setB({ ...b, mode: k })} className={cx("min-h-10 flex-1 rounded-xl text-sm ring-1", b.mode === k ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}>{l}</button>)}</div></Field>
          {b.mode === "in-person" && <Field label="Where"><input className={inputCls} value={b.venue} onChange={(e) => setB({ ...b, venue: e.target.value })} placeholder="Pastor's office" /></Field>}
          {b.mode === "virtual" && <Field label="Link"><input className={inputCls} value={b.link} onChange={(e) => setB({ ...b, link: e.target.value })} placeholder="https://meet.google.com/…" /></Field>}
          {meetWith.length > 1 && <Field label="Who they'll meet"><select className={inputCls} value={b.who} onChange={(e) => setB({ ...b, who: e.target.value })}>{meetWith.map((id) => <option key={id} value={id}>{nm(id)}{id === pastorId ? " (pastor)" : ""}</option>)}</select></Field>}
          <div className="flex gap-2"><Button variant="primary" onClick={() => save({ status: "scheduled", handlerId: b.who || me.id, appt: { date: b.date, time: b.time, mode: b.mode, venue: b.mode === "in-person" ? b.venue.trim() : undefined, link: b.mode === "virtual" ? b.link.trim() : undefined } }, `${r.status === "scheduled" ? "Rescheduled" : "Booked"} for ${shortDate(b.date)}, ${t12(b.time)}`, r.status === "scheduled" ? "Rescheduled. They'll see the new time." : "Booked. They'll see it on their dashboard.")}>Save</Button><Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button></div>
        </div>
      )}
      {mode === "refer" && (
        <div className="space-y-3 rounded-2xl bg-page p-4 ring-1 ring-line">
          <p className="text-[13.5px] text-ink-soft">They&apos;ll see: “{REFERRED}”</p>
          <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for a pastor, counsellor or leader" autoFocus />
          <ul className="divide-y divide-line">{found.map((x: Person) => <li key={x.id} className="flex items-center gap-3 py-2"><Avatar person={x} size={30} /><span className="flex-1">{fullName(x)}</span><Button className="py-1.5 text-[13px]" onClick={() => save({ status: "referred", handlerId: x.id }, `Referred to ${fullName(x)}`, `Referred to ${fullName(x)}`)}>Refer</Button></li>)}</ul>
          <Button variant="ghost" onClick={() => setMode(null)}><X size={15} /> Cancel</Button>
        </div>
      )}
      {!own && can.reply && (
        <div className="mt-4 flex gap-2"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note to the log" /><Button disabled={!note.trim()} onClick={() => save({}, note.trim(), "Added")}>Add</Button></div>
      )}
      {!own && can.staff && (
        <div className="mt-6"><p className="mb-2 text-sm font-semibold">Activity</p><ol className="space-y-1.5 border-l-2 border-line pl-4">{r.log.map((l, i) => <li key={i} className="text-[13.5px]"><b className="font-medium">{l.text}</b> <span className="text-muted">· {nm(l.byId)} · {ago(l.at)}</span></li>)}</ol></div>
      )}
      {own && r.status === "new" && <Button variant="ghost" className="mt-4" onClick={() => save({ status: "cancelled" }, "Cancelled by the member", "Request cancelled")}><X size={15} /> Cancel my request</Button>}
    </Sheet>
  );
}

/** The pastor's first-time setup. Every change saves straight away, so he can stop and carry on later. */
function SetupWizard({ onClose }: { onClose: () => void }) {
  const { state, updateChurch } = useStore();
  const s = setupOf(state);
  const [step, setStep] = useState(Math.min(s.step, 3));
  const [q, setQ] = useState("");
  const save = (patch: Partial<CounselSetup>, quiet = true) => { updateChurch({}, { counselling: { ...s, ...patch } }, quiet ? undefined : "set up counselling"); };
  const go = (n: number) => { setStep(n); save({ step: n }); };
  const roleHolders = (key: string) => state.assignments.filter((a) => state.roles.find((r) => r.id === a.roleId)?.key === key).map((a) => a.personId);
  const protocol = state.groups.find((g) => /protocol/i.test(g.name));
  const suggestions: { personId: string; title: string }[] = [
    ...roleHolders("admin").map((personId) => ({ personId, title: "Admin" })),
    ...(protocol?.leaderIds ?? []).map((personId) => ({ personId, title: "Head of protocol" })),
  ].filter((x, i, a) => a.findIndex((y) => y.personId === x.personId) === i);
  const has = (id: string) => s.delegates.some((d) => d.personId === id);
  const toggle = (personId: string, title: string) => save({ delegates: has(personId) ? s.delegates.filter((d) => d.personId !== personId) : [...s.delegates, { personId, title, perms: title === "Personal assistant" ? ["manage", "approve", "reply", "reassign"] : ["manage"] }] });
  const found = q.trim() ? state.people.filter((p) => !p.isChild && !has(p.id) && fullName(p).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const nm = (id: string) => { const p = state.people.find((x) => x.id === id); return p ? fullName(p) : ""; };
  const steps = ["Who sees your schedule", "What each can do", "Where you meet", "All set"];
  return (
    <Sheet open onClose={onClose} wide title="Set up counselling" footer={
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}><ChevronLeft size={15} /> Back</Button>
        <span className="text-[12.5px] text-muted">Saved as you go</span>
        {step < 3 ? <Button variant="primary" onClick={() => go(step + 1)}>Next <ChevronRight size={15} /></Button> : <Button variant="primary" onClick={() => { save({ step: 3, done: true }, false); toast("Counselling is ready"); onClose(); }}><Check size={15} /> Finish</Button>}
      </div>}>
      <ol className="mb-5 flex gap-1.5">{steps.map((t, i) => <li key={t} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand" : "bg-line")} aria-label={t} />)}</ol>
      <h3 className="mb-1 font-display text-[18px] font-semibold">{steps[step]}</h3>
      {step === 0 && (
        <div>
          <p className="mb-4 text-[14px] text-ink-soft">Requests go to these people first. They can handle them or forward them to you.</p>
          <ul className="mb-4 space-y-2">{s.delegates.map((d) => <li key={d.personId} className="flex items-center gap-3 rounded-2xl bg-page p-3 ring-1 ring-line"><span className="flex-1"><b className="block text-[14.5px]">{nm(d.personId)}</b><input className="w-full bg-transparent text-[13px] text-muted outline-none" value={d.title} onChange={(e) => save({ delegates: s.delegates.map((x) => (x.personId === d.personId ? { ...x, title: e.target.value } : x)) })} aria-label="Title" /></span><button type="button" onClick={() => toggle(d.personId, d.title)} className="text-muted hover:text-alert" aria-label={`Remove ${nm(d.personId)}`}><X size={16} /></button></li>)}</ul>
          {suggestions.filter((x) => !has(x.personId)).length > 0 && <><p className="mb-2 text-sm font-medium">Suggested</p><div className="mb-4 flex flex-wrap gap-1.5">{suggestions.filter((x) => !has(x.personId)).map((x) => <button type="button" key={x.personId} onClick={() => toggle(x.personId, x.title)} className="min-h-10 rounded-full bg-surface px-3.5 text-[13.5px] ring-1 ring-line hover:ring-brand/40">+ {nm(x.personId)} <span className="text-muted">({x.title})</span></button>)}</div></>}
          <Field label="Your personal assistant, or anyone else"><input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" /></Field>
          <ul className="mt-2 divide-y divide-line">{found.map((p) => <li key={p.id} className="flex items-center gap-2 py-2"><Avatar person={p} size={30} /><span className="flex-1">{fullName(p)}</span><Button className="py-1.5 text-[13px]" onClick={() => { toggle(p.id, "Personal assistant"); setQ(""); }}>As PA</Button><Button className="py-1.5 text-[13px]" onClick={() => { toggle(p.id, "Helper"); setQ(""); }}>Other</Button></li>)}</ul>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-[14px] text-ink-soft">What they read stays private: once a request is booked for you or referred, only you and that person can read it.</p>
          {s.delegates.length === 0 && <p className="text-sm text-muted">No one added yet. Go back to add someone, or carry on and handle requests yourself.</p>}
          {s.delegates.map((d) => (
            <div key={d.personId} className="rounded-2xl bg-page p-4 ring-1 ring-line">
              <b className="mb-2 block">{nm(d.personId)} <span className="font-normal text-muted">· {d.title}</span></b>
              <div className="grid gap-2 sm:grid-cols-2">{PERMS.map((p) => { const on = d.perms.includes(p.key); return (
                <label key={p.key} className={cx("flex cursor-pointer items-start gap-2 rounded-xl p-2.5 ring-1", on ? "bg-brand-soft ring-brand" : "bg-surface ring-line")}>
                  <input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={on} onChange={() => save({ delegates: s.delegates.map((x) => (x.personId === d.personId ? { ...x, perms: on ? x.perms.filter((y) => y !== p.key) : [...x.perms, p.key] } : x)) })} />
                  <span><b className="block text-[13.5px]">{p.label}</b><span className="text-[12px] text-muted">{p.sub}</span></span>
                </label>
              ); })}</div>
            </div>
          ))}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-[14px] text-ink-soft">These fill in automatically when a session is booked. They can be changed for any session.</p>
          <Field label="Where you usually meet"><input className={inputCls} defaultValue={s.venue ?? ""} onBlur={(e) => save({ venue: e.target.value.trim() })} placeholder="Pastor's office" /></Field>
          <Field label="Your online meeting link"><input className={inputCls} inputMode="url" defaultValue={s.link ?? ""} onBlur={(e) => save({ link: e.target.value.trim() })} placeholder="https://meet.google.com/…" /></Field>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3 text-[14.5px]">
          <p>Members tap <b>I need help</b> then <b>Book a counselling session</b>.</p>
          <p>{s.delegates.length ? <>Requests go to {s.delegates.map((d) => nm(d.personId)).join(", ")} first. They can book, forward to you or refer on.</> : <>Requests come straight to you.</>}</p>
          <p>Everyone gets “Add to calendar”, and an email reminder when emails are on. Every step is logged.</p>
        </div>
      )}
    </Sheet>
  );
}

