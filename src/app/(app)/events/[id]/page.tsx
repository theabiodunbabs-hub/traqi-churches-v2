"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BellRing, Check, CheckCircle2, Copy, CopyPlus, Eye, Handshake, Image as ImageIcon, MessageSquareText, ScanLine, Send, UserPlus, Users, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge, Button, CountUp, Empty, Panel, ProgressRing, Sheet, Tabs, cx, inputCls, toast } from "@/components/ui";
import { COVERS } from "@/components/brand";
import { QR } from "@/components/public";
import { WhatsAppIcon } from "@/components/care";
import { EventLanding, whenLine } from "@/components/event-landing";
import { EventEditor } from "@/components/event-editor";
import { DownloadButton } from "@/components/download";
import { useDemoRegister } from "@/components/event-page";
import { STATE_BADGE, canCreateEvents, eventCounts, eventState } from "@/lib/domain";
import { registrationsSheet } from "@/lib/exports";
import { daysOf, duplicateEvent, eventPath, happeningNow, themeOf, ticketCode } from "@/lib/events";
import { shareImage } from "@/lib/share-image";
import { saveBlob } from "@/lib/download";
import { dayName, digits, todayLagos, waLink } from "@/lib/format";
import type { ChurchEvent, Registration } from "@/lib/types";

type Tab = "overview" | "people" | "door" | "share" | "feedback" | "edit";

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, access, me, put, drop, newId, findByPhone } = useStore();
  const demoRegister = useDemoRegister();
  const [tab, setTab] = useState<Tab>("overview");
  const [preview, setPreview] = useState<ChurchEvent | null>(null);
  useEffect(() => { if (typeof window !== "undefined" && new URLSearchParams(location.search).get("edit")) setTab("edit"); }, []);
  const e = state.events.find((x) => x.id === id);
  if (!access || !me) return null;
  if (!e) return <Empty title="Event not found" body="It may have been removed." action={<Link href="/events" className="text-brand">Back to events</Link>} />;

  const coOrg = e.coOrganisers.some((c) => c.status === "approved" && access.leads.has(c.groupId));
  const manage = canCreateEvents(access) || e.createdById === me.id || coOrg || access.isPastoral;
  const s = eventState(e); const b = STATE_BADGE[s]; const c = eventCounts(state, e);
  const church = { name: state.church.name, slug: state.church.slug, profile: state.church.profile };

  if (!manage || preview) {
    const shown = preview ?? e;
    return (
      <div className="-mx-4 -mt-5 md:-mx-8 md:-mt-8">
        {preview && <div className="sticky top-14 z-50 flex justify-center md:top-3"><Button className="shadow-lg" onClick={() => setPreview(null)}><X size={15} /> Close preview</Button></div>}
        <EventLanding e={shown} church={church} registered={c.people} recent={c.confirmed.slice(-4).map((r) => r.name)} onRegister={(r) => demoRegister(e, r)} preview={!!preview} />
      </div>
    );
  }

  const myGroups = state.groups.filter((g) => access.leads.has(g.id) && !e.coOrganisers.some((x) => x.groupId === g.id));
  const pendingCo = e.coOrganisers.filter((x) => x.status === "requested");
  const duplicate = () => {
    const copy = duplicateEvent(e, newId("ev"), me.id);
    let slug = copy.slug; let n = 2;
    while (state.events.some((x) => x.slug === slug)) slug = `${copy.slug}-${n++}`;
    put("events", { ...copy, slug }, `made a copy of ${e.title}`);
    toast("Copied with next year's dates. Check the details, then publish.");
    router.push(`/events/${copy.id}?edit=1`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/events" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> Events</Link>
      <section className="relative mb-5 overflow-hidden rounded-[28px] p-6 text-white md:p-8" style={{ background: e.flyer ? `linear-gradient(100deg, rgba(10,8,20,.88) 30%, rgba(10,8,20,.4)), url(${e.flyer}) center/cover` : COVERS[e.cover % COVERS.length] }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <Badge tone={b.tone}>{b.label}</Badge>
            <h1 className="mt-3 font-display text-[32px] font-semibold leading-tight tracking-tight md:text-[42px]">{e.title}</h1>
            {themeOf(e) && <p className="mt-1 text-[17px] text-white/85">{themeOf(e)}</p>}
            <p className="mt-1 text-white/75">{whenLine(e)}{e.venue && e.mode !== "virtual" ? ` · ${e.venue}` : e.mode === "virtual" ? " · Online" : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPreview(e)}><Eye size={15} /> Preview</Button>
            <Button onClick={duplicate}><CopyPlus size={15} /> Duplicate</Button>
            {e.status === "draft" && <Button variant="light" onClick={() => { put("events", { ...e, status: access.isPastoral ? "published" : "pending", approvedById: access.isPastoral ? me.id : undefined }, access.isPastoral ? `published the event ${e.title}` : `sent ${e.title} for approval`); toast(access.isPastoral ? "Published. Share the link!" : "Sent to a pastor for approval"); }}><Send size={15} /> {access.isPastoral ? "Publish" : "Send for approval"}</Button>}
            {e.status === "pending" && access.isPastoral && <Button variant="light" onClick={() => { put("events", { ...e, status: "published", approvedById: me.id }, `approved the event ${e.title}`); toast("Approved and published"); }}><CheckCircle2 size={15} /> Approve and publish</Button>}
          </div>
        </div>
        {e.status === "pending" && !access.isPastoral && <p className="glass mt-4 rounded-2xl px-4 py-2.5 text-sm">A pastor needs to approve this before it goes public.</p>}
      </section>

      {pendingCo.length > 0 && access.can("roles.manage") && (
        <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
          <Handshake size={20} className="text-brand" />
          <span className="flex-1 text-sm">{pendingCo.map((x) => state.groups.find((g) => g.id === x.groupId)?.name).join(", ")} asked to co-organise.</span>
          <Button variant="primary" onClick={() => { put("events", { ...e, coOrganisers: e.coOrganisers.map((x) => ({ ...x, status: "approved" as const })) }, `approved co-organisers for ${e.title}`); toast("Co-organisers approved"); }}>Approve</Button>
        </div>
      )}
      {myGroups.length > 0 && !canCreateEvents(access) && e.createdById !== me.id && (
        <div className="card mb-5 flex flex-wrap items-center gap-3 p-4">
          <Handshake size={20} className="text-brand" /><span className="flex-1 text-sm">Want {myGroups[0].name} to help run this event?</span>
          <Button onClick={() => { put("events", { ...e, coOrganisers: [...e.coOrganisers, { groupId: myGroups[0].id, status: "requested" }] }, `asked to co-organise ${e.title}`); toast("Request sent to the admin"); }}>Request to co-organise</Button>
        </div>
      )}

      <Tabs className="mb-5" value={tab} onChange={setTab} items={[
        { key: "overview", label: "Overview" }, { key: "people", label: "Registrations", count: c.regs.length },
        { key: "door", label: "At the door" }, { key: "share", label: "Share" },
        ...(e.feedback?.on ? [{ key: "feedback" as Tab, label: "Feedback", count: c.regs.filter((r) => r.feedback).length }] : []),
        { key: "edit", label: "Edit" },
      ]} />

      <div key={tab} className="rise">
        {tab === "overview" && <Overview e={e} />}
        {tab === "people" && <People e={e} />}
        {tab === "door" && <Door e={e} put={put} newId={newId} findByPhone={findByPhone} />}
        {tab === "share" && <Share e={e} />}
        {tab === "feedback" && <FeedbackResults e={e} />}
        {tab === "edit" && <EventEditor e={e} onPreview={setPreview} onSave={(x) => {
          const moved = e.status === "published" && (x.start !== e.start || x.venue !== e.venue || x.link !== e.link || x.days.join() !== e.days.join());
          put("events", moved && !access.isPastoral ? { ...x, status: "pending" } : x, `updated the event ${x.title}`);
          toast(moved && !access.isPastoral ? "Saved. The date or venue changed, so a pastor must approve again." : "Event saved");
          setTab("overview");
        }} onDelete={e.status !== "published" ? () => { drop("events", e.id, `deleted the event ${e.title}`); router.push("/events"); } : undefined} />}
      </div>
    </div>
  );
}

function Overview({ e }: { e: ChurchEvent }) {
  const { state } = useStore();
  const c = eventCounts(state, e);
  const days = daysOf(e).map((d) => ({ d: d.date, n: c.regs.filter((r) => r.days.includes(d.date)).length, inn: c.regs.filter((r) => r.checkins.includes(d.date)).length }));
  const types = { individual: 0, group: 0, online: 0 } as Record<string, number>;
  c.regs.forEach((r) => { types[r.type ?? "individual"] = (types[r.type ?? "individual"] ?? 0) + 1; });
  const live = happeningNow(e);
  return (
    <div className="space-y-5">
      {live && <div className="flex items-center gap-3 rounded-2xl bg-alert px-4 py-3 text-white"><span className="size-2.5 animate-pulse rounded-full bg-white" /><b>Happening now</b><span className="truncate">{live.session?.title ?? `Day ${live.dayIndex + 1}`}</span></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card flex items-center gap-4 p-4">
          {e.capacity ? <span className="text-brand"><ProgressRing value={c.people / e.capacity} size={56}>{Math.round((c.people / e.capacity) * 100)}%</ProgressRing></span> : null}
          <div><p className="num text-[28px] font-semibold"><CountUp to={c.people} /></p><p className="text-[13px] text-ink-soft">coming{e.capacity ? ` of ${e.capacity}` : ""}</p></div>
        </div>
        <div className="card p-4"><p className="num text-[28px] font-semibold text-good"><CountUp to={c.checkedIn} /></p><p className="text-[13px] text-ink-soft">checked in</p></div>
        <div className="card p-4"><p className="num text-[28px] font-semibold text-brand"><CountUp to={c.newContacts} /></p><p className="text-[13px] text-ink-soft">new to the church</p></div>
        <div className="card p-4"><p className="num text-[28px] font-semibold text-glow-ink"><CountUp to={c.pending + c.waitlist} /></p><p className="text-[13px] text-ink-soft">waiting or pending</p></div>
      </div>
      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <Panel title="Each day">
          <ul className="space-y-4">{days.map((x, i) => (
            <li key={x.d}>
              <div className="mb-1.5 flex justify-between text-[14px]"><span className="font-medium">Day {i + 1} · {dayName(x.d, { weekday: "short", day: "numeric", month: "short" })}</span><span className="text-muted">{x.inn} in · {x.n} registered</span></div>
              <div className="relative h-3 rounded-full bg-page"><div className="absolute inset-y-0 left-0 rounded-full bg-j2" style={{ width: `${(x.n / Math.max(1, c.regs.length)) * 100}%` }} /><div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${(x.inn / Math.max(1, c.regs.length)) * 100}%` }} /></div>
            </li>
          ))}</ul>
        </Panel>
        <Panel title="How they're coming">
          <ul className="space-y-2.5 text-[14px]">
            {[["individual", "Just themselves"], ["group", "In a group"], ["online", "Online"]].map(([k, l]) => <li key={k} className="flex justify-between"><span className="text-ink-soft">{l}</span><b className="num">{types[k] ?? 0}</b></li>)}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function People({ e }: { e: ChurchEvent }) {
  const { state, put, drop, access } = useStore();
  const c = eventCounts(state, e);
  const [q, setQ] = useState("");
  const [toFollow, setToFollow] = useState(false);
  const fresh = c.regs.filter((r) => !r.personId && digits(r.phone).length >= 10 && r.status === "confirmed" && !c.regs.some((x) => x !== r && x.personId && digits(x.phone).slice(-10) === digits(r.phone).slice(-10)));
  const list = c.regs.filter((r) => !q || `${r.name} ${r.phone} ${r.ticket}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.at.localeCompare(a.at));
  const leadOf = (r: Registration) => (r.byRegId ? c.regs.find((x) => x.id === r.byRegId) : undefined);
  return (
    <Panel title="Registrations" action={<DownloadButton what={`${e.title} registrations`} sheets={() => [registrationsSheet(state, e)]} />}>
      {e.followup && fresh.length > 0 && access?.can("followup.assign") && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-soft/60 p-3.5 ring-1 ring-brand/20">
          <UserPlus size={18} className="text-brand" />
          <span className="flex-1 text-[14px]"><b>{fresh.length} {fresh.length === 1 ? "person is" : "people are"} new to the church.</b> Add them to follow-up so someone reaches out.</span>
          <Button variant="primary" onClick={() => setToFollow(true)}>Add to follow-up</Button>
        </div>
      )}
      {toFollow && <ToFollowUp e={e} regs={fresh} onClose={() => setToFollow(false)} />}
      <input className={cx(inputCls, "mb-3")} value={q} onChange={(x) => setQ(x.target.value)} placeholder="Search name, phone or ticket" />
      {list.length === 0 ? <p className="py-6 text-center text-sm text-muted">No registrations yet. Share the link to get started.</p> : (
        <ul className="divide-y divide-line">{list.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand">{r.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{r.name}</span>
              <span className="block text-[13px] text-muted">{r.phone} · {r.ticket}{r.type === "online" ? " · online" : ""}{leadOf(r) ? ` · with ${leadOf(r)!.name}` : ""}{!r.personId ? " · new to the church" : ""}</span>
            </span>
            {r.checkins.length > 0 && <Badge tone="good"><Check size={12} /> In</Badge>}
            {r.status === "confirmed" ? <Badge tone="brand">Confirmed</Badge> : r.status === "waitlist" ? (
              <span className="flex items-center gap-1.5"><Badge tone="glow">Waiting list</Badge><Button onClick={() => { put("registrations", { ...r, status: "confirmed" }, `gave ${r.name} a place at ${e.title}`); toast(`${r.name.split(" ")[0]} has a place now`); }}>Give a place</Button></span>
            ) : (
              <span className="flex gap-1.5"><Button onClick={() => { put("registrations", { ...r, status: "confirmed" }); toast(`${r.name.split(" ")[0]} confirmed`); }}>Accept</Button><Button variant="ghost" onClick={() => drop("registrations", r.id)}>Decline</Button></span>
            )}
          </li>
        ))}</ul>
      )}
    </Panel>
  );
}

/** Registrants new to the church become first-timers, assigned like anyone else. */
function ToFollowUp({ e, regs, onClose }: { e: ChurchEvent; regs: Registration[]; onClose: () => void }) {
  const { addFirstTimer, put } = useStore();
  const [g, setG] = useState<Record<string, "M" | "F">>(() => Object.fromEntries(regs.map((r) => [r.id, /^(m|male)$/i.test(r.answers.gender ?? "") ? "M" : /^(f|female)$/i.test(r.answers.gender ?? "") ? "F" : undefined]).filter(([, v]) => v)) as Record<string, "M" | "F">);
  const ready = regs.filter((r) => g[r.id]);
  return (
    <Sheet open onClose={onClose} title="Add to follow-up" footer={<Button variant="primary" className="w-full py-3" disabled={!ready.length} onClick={() => {
      for (const r of ready) {
        const [firstName, ...rest] = r.name.trim().split(/\s+/);
        const pid = addFirstTimer({ firstName, lastName: rest.join(" ") || "-", gender: g[r.id], phone: r.phone, email: r.email, heardFrom: e.title, consent: { at: r.at, via: "welcome-form" } });
        put("registrations", { ...r, personId: pid });
      }
      toast(`${ready.length} added to follow-up`); onClose();
    }}>Add {ready.length || ""} to follow-up</Button>}>
      <p className="mb-4 text-sm text-ink-soft">Choose each person&apos;s gender so they&apos;re matched well. They&apos;re assigned automatically.</p>
      <ul className="divide-y divide-line">{regs.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-2.5">
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="text-[12.5px] text-muted">{r.phone}</span></span>
          {(["M", "F"] as const).map((x) => <button key={x} onClick={() => setG({ ...g, [r.id]: x })} className={cx("rounded-lg px-3 py-1.5 text-[13px] ring-1", g[r.id] === x ? "bg-deep text-white ring-deep" : "bg-page ring-line")}>{x === "M" ? "Male" : "Female"}</button>)}
        </li>
      ))}</ul>
    </Sheet>
  );
}

function Door({ e, put, newId, findByPhone }: { e: ChurchEvent; put: ReturnType<typeof useStore>["put"]; newId: (p: string) => string; findByPhone: ReturnType<typeof useStore>["findByPhone"] }) {
  const { state } = useStore();
  const c = eventCounts(state, e);
  const days = daysOf(e);
  const today = days.some((d) => d.date === todayLagos()) ? todayLagos() : days[0].date;
  const [day, setDay] = useState(today);
  const plan = days.find((d) => d.date === day);
  const sessions = e.sessionCheckin ? (plan?.sessions ?? []).filter((s) => s.checkin !== false) : [];
  const live = happeningNow(e);
  const [sess, setSess] = useState<string>(live?.session?.id && sessions.some((s) => s.id === live.session!.id) ? live.session.id : "");
  const [code, setCode] = useState("");
  const [walk, setWalk] = useState(false);
  const [w, setW] = useState({ name: "", phone: "" });
  const [last, setLast] = useState<Registration | null>(null);
  const scan = (r?: Registration) => {
    if (!r) return toast("No ticket with that code");
    if (r.status !== "confirmed") return toast(`${r.name} is ${r.status === "waitlist" ? "on the waiting list" : "not confirmed yet"}`);
    const inDay = r.checkins.includes(day);
    const inSess = !sess || (r.sessions ?? []).includes(sess);
    if (inDay && inSess) { setLast(r); return toast(`${r.name.split(" ")[0]} is already in`); }
    const next = { ...r, checkins: inDay ? r.checkins : [...r.checkins, day], sessions: sess && !inSess ? [...(r.sessions ?? []), sess] : r.sessions };
    put("registrations", next); setLast(next); setCode("");
  };
  const inCount = sess ? c.regs.filter((r) => (r.sessions ?? []).includes(sess)).length : c.regs.filter((r) => r.checkins.includes(day)).length;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Panel title="Check people in" action={days.length > 1 && <select className="rounded-xl bg-page px-3 py-1.5 text-sm ring-1 ring-line" value={day} onChange={(x) => { setDay(x.target.value); setSess(""); }}>{days.map((d, i) => <option key={d.date} value={d.date}>Day {i + 1} · {dayName(d.date, { weekday: "short", day: "numeric", month: "short" })}</option>)}</select>}>
        {sessions.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button onClick={() => setSess("")} className={cx("rounded-full px-3 py-1.5 text-[13px] ring-1", !sess ? "bg-deep text-white ring-deep" : "bg-page ring-line")}>The day</button>
            {sessions.map((s) => <button key={s.id} onClick={() => setSess(s.id)} className={cx("rounded-full px-3 py-1.5 text-[13px] ring-1", sess === s.id ? "bg-deep text-white ring-deep" : "bg-page ring-line")}>{s.title || s.start}</button>)}
          </div>
        )}
        <form onSubmit={(x) => { x.preventDefault(); const k = code.trim().toUpperCase(); scan(c.regs.find((r) => r.ticket === k || (digits(k).length >= 10 && digits(r.phone).slice(-10) === digits(k).slice(-10)))); }} className="flex gap-2">
          <div className="relative flex-1"><ScanLine size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus className={cx(inputCls, "num py-3.5 pl-11 text-lg uppercase tracking-wider")} value={code} onChange={(x) => setCode(x.target.value)} placeholder="Ticket code or phone" /></div>
          <Button variant="primary" type="submit">Check in</Button>
        </form>
        <p className="mt-2 text-[12.5px] text-muted">A barcode scanner types the code for you. Or search by phone number.</p>
        {last && (
          <div className="pop mt-5 flex items-center gap-4 rounded-2xl bg-good-soft p-4">
            <span className="flex size-12 items-center justify-center rounded-full bg-good text-white"><Check size={24} /></span>
            <span><b className="block text-lg">{last.name}</b><span className="text-sm text-ink-soft">Welcome! {last.ticket}</span></span>
          </div>
        )}
        <div className="mt-6 border-t border-line pt-4">
          {walk ? (
            <div className="space-y-3">
              <p className="font-semibold">Walk-in</p>
              <div className="grid grid-cols-2 gap-2"><input className={inputCls} placeholder="Full name" value={w.name} onChange={(x) => setW({ ...w, name: x.target.value })} /><input className={inputCls} placeholder="Phone" inputMode="tel" value={w.phone} onChange={(x) => setW({ ...w, phone: x.target.value })} /></div>
              <Button variant="primary" disabled={w.name.trim().length < 2 || digits(w.phone).length < 10} onClick={() => {
                const r: Registration = { id: newId("rg"), eventId: e.id, personId: findByPhone(w.phone)?.id, name: w.name.trim(), phone: w.phone, guests: 0, days: [day], answers: {},
                  ticket: ticketCode(e), status: "confirmed", checkins: [day], sessions: sess ? [sess] : [], at: new Date().toISOString(), type: "individual" };
                put("registrations", r, `added a walk-in at ${e.title}`); setLast(r); toast(`${r.name.split(" ")[0]} is checked in`);
                setW({ name: "", phone: "" }); setWalk(false);
              }}><UserPlus size={15} /> Add and check in</Button>
            </div>
          ) : <Button onClick={() => setWalk(true)}><UserPlus size={15} /> Add a walk-in</Button>}
        </div>
      </Panel>
      <div className="card flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-muted">In {sess ? "this session" : "today"}</p>
        <p className="num mt-1 text-[56px] font-semibold leading-none"><CountUp to={inCount} /></p>
        <p className="mt-2 text-sm text-ink-soft">of {c.regs.filter((r) => r.days.includes(day) && r.status === "confirmed" && r.type !== "online").length} expected in person</p>
      </div>
    </div>
  );
}

function Share({ e }: { e: ChurchEvent }) {
  const { state } = useStore();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = `${typeof window !== "undefined" ? location.origin : ""}${eventPath(state.church.slug, e)}`;
  const msg = `*${e.title}*${themeOf(e) ? `\n${themeOf(e)}` : ""}\n${whenLine(e)}${e.venue && e.mode !== "virtual" ? `\n${e.venue}` : ""}\n\nRegister free: ${url}`;
  const c = eventCounts(state, e);
  const reminder = useMemo(() => `Hello! A reminder that *${e.title}* is ${daysOf(e).length > 1 ? "starting" : "on"} ${whenLine(e)}. Please come with your ticket (the code you got when you registered).${e.mode !== "physical" && e.link ? `\nWatch online: ${e.link}` : ""}\nDetails: ${url}`, [e, url]);
  if (e.status !== "published") return <Empty title="Not public yet" body="Once a pastor approves this event, its link, QR code and share image appear here." icon={<Send size={26} />} />;
  const img = async (size: "story" | "square") => { setBusy(true); try { saveBlob(await shareImage(e, { name: state.church.name, color: state.church.profile?.color }, url, size), `${e.slug}-${size}.png`); } finally { setBusy(false); } };
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[1fr_300px]">
        <Panel title="Share the event">
          <div className="flex items-center gap-2 rounded-2xl bg-page p-2 pl-4 ring-1 ring-line"><span className="flex-1 truncate text-[14.5px] font-medium">{url.replace(/^https?:\/\//, "")}</span><Button onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}</Button></div>
          <div className="mt-4 whitespace-pre-line rounded-2xl bg-[#e7fbe9] p-4 text-[14px] text-[#14361f]">{msg}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-3.5 py-2 text-sm font-medium text-white"><WhatsAppIcon /> Share on WhatsApp</a>
            <Button disabled={busy} onClick={() => img("story")}><ImageIcon size={15} /> Status image</Button>
            <Button disabled={busy} onClick={() => img("square")}><ImageIcon size={15} /> Square image</Button>
            <Link href={`/messages?event=${e.id}`}><Button><Send size={15} /> Announce to the church</Button></Link>
          </div>
        </Panel>
        <div className="card flex flex-col items-center p-6 text-center"><div className="rounded-3xl bg-surface p-3 shadow-lg ring-1 ring-line"><QR value={url} size={200} /></div><Button className="mt-4" onClick={() => window.print()}>Print the QR code</Button></div>
      </div>
      {e.reminders?.whatsapp && (
        <Panel title={<span className="flex items-center gap-2"><BellRing size={17} className="text-brand" /> WhatsApp reminder</span>} action={<span className="text-xs text-muted">{c.confirmed.length} people</span>}>
          <p className="text-[13.5px] text-ink-soft">Ready to send {(e.reminders.daysBefore ?? [1]).map((n) => (n === 1 ? "the day before" : `${n} days before`)).join(" and ")}. Copy it to your broadcast list, or send one by one.</p>
          <div className="mt-3 whitespace-pre-line rounded-2xl bg-[#e7fbe9] p-4 text-[14px] text-[#14361f]">{reminder}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => { navigator.clipboard?.writeText(reminder); toast("Reminder copied"); }}><Copy size={15} /> Copy</Button>
            <details className="w-full">
              <summary className="cursor-pointer text-[13.5px] font-medium text-brand">Send one by one</summary>
              <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-xl ring-1 ring-line">
                {c.confirmed.filter((r) => digits(r.phone).length >= 10).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-[14px]"><span className="flex-1 truncate">{r.name}</span>
                    <a href={waLink(r.phone, reminder.replace("Hello!", `Hello ${r.name.split(" ")[0]}!`))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-2.5 py-1 text-[12.5px] font-medium text-white"><WhatsAppIcon size={13} /> Send</a></li>
                ))}
              </ul>
            </details>
          </div>
        </Panel>
      )}
    </div>
  );
}

function FeedbackResults({ e }: { e: ChurchEvent }) {
  const { state } = useStore();
  const got = eventCounts(state, e).regs.filter((r) => r.feedback);
  const qs = e.feedback?.questions ?? [];
  if (!got.length) return <Empty title="No feedback yet" body="Once the event ends, the feedback form shows on the event page. Answers appear here." icon={<MessageSquareText size={26} />} />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted"><Users size={14} className="mr-1 inline" />{got.length} people gave feedback.</p>
      {qs.map((q) => {
        const answers = got.map((r) => r.feedback!.answers[q.id]).filter(Boolean);
        if (q.type === "choice" || q.type === "yesno" || q.type === "multi") {
          const opts = q.type === "yesno" ? ["Yes", "No"] : q.options ?? [];
          const counts = opts.map((o) => ({ o, n: answers.filter((a) => a.split(" | ").includes(o)).length }));
          return (
            <Panel key={q.id} title={q.label}>
              <ul className="space-y-2.5">{counts.map((x) => (
                <li key={x.o}><div className="mb-1 flex justify-between text-[14px]"><span>{x.o}</span><span className="text-muted">{x.n}</span></div><div className="h-2.5 rounded-full bg-page"><div className="h-full rounded-full bg-brand" style={{ width: `${(x.n / Math.max(1, answers.length)) * 100}%` }} /></div></li>
              ))}</ul>
            </Panel>
          );
        }
        return (
          <Panel key={q.id} title={q.label}>
            <ul className="space-y-2">{answers.map((a, i) => <li key={i} className="rounded-xl bg-page px-3.5 py-2.5 text-[14.5px]">{a}</li>)}</ul>
          </Panel>
        );
      })}
    </div>
  );
}
