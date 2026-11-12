"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Baby, Check, Copy, Globe, Minus, MonitorPlay, Plus, QrCode, RefreshCw, Search, Sparkles, UserCheck, Users, WifiOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { DownloadButton } from "@/components/download";
import { attendanceSheet, canDownloadAll } from "@/lib/exports";
import { Avatar, Badge, Button, CountUp, Empty, Panel, Sheet, Tabs, Toggle, cx, inputCls, toast } from "@/components/ui";
import { StackedBars } from "@/components/charts";
import { QR } from "@/components/public";
import { checkinsFor, isSunday, newCode, nextMeeting, openMeeting, record, sundaySeries, upcomingFromSchedule, WEEKDAYS } from "@/lib/domain";
import { dayName, fullName, shortDate, timeOf } from "@/lib/format";
import type { Attendance, Headcount, Meeting, ServiceSlot } from "@/lib/types";

type Tab = "now" | "checkin" | "rollcall" | "history" | "schedule";

export default function AttendancePage() {
  const { state, access, putMany, mode } = useStore();
  const [tab, setTab] = useState<Tab>("now");

  // Create the coming week's gatherings from the service schedule, once.
  useEffect(() => {
    if (!access || !(access.can("attendance.record") || access.can("checkin.code"))) return;
    const add = upcomingFromSchedule(state);
    if (add.length) putMany("meetings", add);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  const current = useMemo(() => openMeeting(state.meetings) ?? nextMeeting(state.meetings, Date.now(), "sunday") ?? nextMeeting(state.meetings), [state.meetings]);
  if (!access) return null;
  const canRecord = access.can("attendance.record");
  const canSchedule = access.can("checkin.code") || access.can("groups.manage");

  const items: { key: Tab; label: string }[] = [
    { key: "now", label: "Sunday mode" },
    ...(canRecord ? [{ key: "checkin" as Tab, label: "Check people in" }, { key: "rollcall" as Tab, label: "Roll call" }] : []),
    { key: "history", label: "Trends" },
    ...(canSchedule ? [{ key: "schedule" as Tab, label: "Services" }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <ServiceHero meeting={current} />
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} items={items} />
        {mode === "demo" && <span className="flex items-center gap-1.5 text-[12.5px] text-muted"><WifiOff size={14} /> Counts save on this phone and sync when you're back online</span>}
      </div>
      <div key={tab} className="rise">
        {tab === "now" && <SundayMode meeting={current} />}
        {tab === "checkin" && current && <UsherCheckin meeting={current} />}
        {tab === "rollcall" && <RollCall />}
        {tab === "history" && <History />}
        {tab === "schedule" && <Schedule />}
      </div>
    </div>
  );
}

function ServiceHero({ meeting }: { meeting?: Meeting }) {
  const { state, put, access } = useStore();
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${location.origin}/checkin/${state.church.slug}` : `/checkin/${state.church.slug}`;
  if (!meeting) return (
    <section className="hero px-6 py-8 md:px-9">
      <p className="text-white/60">Attendance</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">No services scheduled yet</h1>
      <p className="mt-2 text-white/70">Add your Sunday services in the Services tab to start checking people in.</p>
    </section>
  );
  const open = openMeeting([meeting]) === meeting;
  const before = Date.parse(meeting.start) - Date.now();
  const n = checkinsFor(state, meeting.id).length;
  return (
    <section className="hero px-6 pb-6 pt-7 md:px-9 md:pb-8 md:pt-9">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            {open ? <span className="flex items-center gap-1.5 rounded-full bg-[#7ee2b8]/20 px-2.5 py-1 text-[12px] font-semibold text-[#7ee2b8]"><span className="pulse size-2 rounded-full bg-[#7ee2b8]" />Check-in open</span>
              : <span className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white/75">{before > 0 ? `Opens 30 minutes before · ${dayName(meeting.start, { weekday: "short", day: "numeric", month: "short" })}` : "Closed"}</span>}
            {meeting.mode !== "physical" && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] text-white/75">{meeting.mode === "virtual" ? "Online" : "In person and online"}</span>}
          </div>
          <h1 className="mt-3 font-display text-[30px] font-semibold leading-tight tracking-tight md:text-[40px]">{meeting.name}</h1>
          <p className="mt-1 text-white/70">{dayName(meeting.start)} · {timeOf(meeting.start)} to {timeOf(meeting.end)}</p>
          {access && canDownloadAll(access) && <DownloadButton className="mt-3 w-fit" what="Sunday attendance" label="Download Sundays" sheets={() => [attendanceSheet(state)]} />}
        </div>
        <div className="glass flex items-center gap-5 rounded-3xl px-5 py-4">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-white/55">Service code</p>
            <p className="num mt-0.5 text-[40px] font-semibold leading-none tracking-[.12em]">{meeting.code ?? "—"}</p>
          </div>
          <div className="h-12 w-px bg-white/15" />
          <div>
            <p className="text-[12px] uppercase tracking-wider text-white/55">Checked in</p>
            <p className="num mt-0.5 text-[40px] font-semibold leading-none"><CountUp to={n} /></p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/display/checkin?m=${meeting.id}`} target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-white/90"><MonitorPlay size={16} /> Show on the screen</Link>
        <button onClick={() => setQr(true)} className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium hover:bg-white/15"><QrCode size={16} /> QR code</button>
        <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium hover:bg-white/15">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy church link"}
        </button>
        <button onClick={() => { put("meetings", { ...meeting, code: newCode() }, `changed the code for ${meeting.name}`); toast("New code ready"); }} className="glass inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium hover:bg-white/15"><RefreshCw size={15} /> New code</button>
      </div>
      <Sheet open={qr} onClose={() => setQr(false)} title="Check-in QR code">
        <div className="text-center">
          <div className="mx-auto w-fit rounded-3xl bg-surface p-4 shadow-lg ring-1 ring-line"><QR value={link} size={240} /></div>
          <p className="mt-4 font-medium">{link.replace(/^https?:\/\//, "")}</p>
          <p className="mt-1 text-sm text-muted">The same link works every week. It opens whichever service is on, and asks for the code.</p>
          <Button className="mt-4" onClick={() => window.print()}>Print it</Button>
        </div>
      </Sheet>
    </section>
  );
}

const CATS: { key: keyof Pick<Headcount, "men" | "women" | "children" | "firstTimers" | "online">; label: string; color: string; icon: typeof Users }[] = [
  { key: "men", label: "Men", color: "var(--color-brand)", icon: Users },
  { key: "women", label: "Women", color: "var(--color-j3)", icon: Users },
  { key: "children", label: "Children", color: "#f59e0b", icon: Baby },
  { key: "firstTimers", label: "First-timers", color: "#0e9f6e", icon: Sparkles },
  { key: "online", label: "Watching online", color: "#38bdf8", icon: Globe },
];

/** Headcount by tapping, made for an usher standing at the back. */
function SundayMode({ meeting }: { meeting?: Meeting }) {
  const { state, put, me, access } = useStore();
  const sundays = useMemo(() => state.meetings.filter((m) => Date.parse(m.start) - 864e5 * 1 < Date.now()).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 12), [state.meetings]);
  // During a service, count that service; otherwise show the most recent one.
  const lastPast = sundays.find((x) => Date.parse(x.start) < Date.now());
  const [mid, setMid] = useState((openMeeting(state.meetings) ?? lastPast ?? meeting)?.id);
  const m = state.meetings.find((x) => x.id === mid) ?? meeting;
  const saved = state.headcounts.find((h) => h.meetingId === m?.id);
  const [h, setH] = useState<Headcount | null>(null);
  useEffect(() => { setH(saved ? { ...saved } : m ? { meetingId: m.id, men: 0, women: 0, children: 0, firstTimers: 0, online: 0, byId: me!.id, at: "" } : null); }, [m?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m || !h) return <Empty title="No service to count" body="Once a service is scheduled, its headcount goes here." icon={<Users size={26} />} />;
  const canEdit = access!.can("attendance.record");
  const total = h.men + h.women + h.children;
  const checked = checkinsFor(state, m.id).length;
  const set = (k: (typeof CATS)[number]["key"], v: number) => setH({ ...h, [k]: Math.max(0, v) });
  const dirty = JSON.stringify({ ...h, at: "" }) !== JSON.stringify({ ...(saved ?? h), at: "" }) || !saved;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Panel title="Headcount" action={
        <select className="rounded-xl bg-page px-3 py-1.5 text-sm ring-1 ring-line" value={m.id} onChange={(e) => setMid(e.target.value)} aria-label="Service">
          {[...(meeting && !sundays.includes(meeting) ? [meeting] : []), ...sundays].map((x) => <option key={x.id} value={x.id}>{x.name} · {shortDate(x.date)}</option>)}
        </select>
      }>
        <div className="grid gap-3 sm:grid-cols-2">
          {CATS.filter((c) => c.key !== "online" || m.mode !== "physical").map((c) => (
            <div key={c.key} className="flex items-center gap-3 rounded-2xl bg-page p-3 ring-1 ring-line">
              <span className="flex size-10 items-center justify-center rounded-xl text-white" style={{ background: c.color }}><c.icon size={18} /></span>
              <span className="flex-1">
                <span className="block text-[13px] text-muted">{c.label}</span>
                <input inputMode="numeric" disabled={!canEdit} value={h[c.key] ?? 0} onChange={(e) => set(c.key, Number(e.target.value.replace(/\D/g, "")) || 0)}
                  className="num w-20 bg-transparent text-[26px] font-semibold outline-none" aria-label={c.label} />
              </span>
              {canEdit && <span className="flex gap-1.5">
                <button onClick={() => set(c.key, (h[c.key] ?? 0) - 1)} className="flex size-11 items-center justify-center rounded-xl bg-surface ring-1 ring-line active:scale-95" aria-label={`One less ${c.label}`}><Minus size={18} /></button>
                <button onClick={() => set(c.key, (h[c.key] ?? 0) + 1)} className="flex size-11 items-center justify-center rounded-xl text-white shadow-sm active:scale-95" style={{ background: c.color }} aria-label={`One more ${c.label}`}><Plus size={18} /></button>
              </span>}
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-ink-soft"><span className="num text-[28px] font-semibold text-ink">{total.toLocaleString()}</span> in the room{h.online ? ` · ${h.online} online` : ""}</p>
          {canEdit && <Button variant="primary" disabled={!dirty} onClick={() => { put("headcounts", { ...h, byId: me!.id, at: new Date().toISOString() }, `recorded the headcount for ${m.name}`); toast(`Headcount saved: ${total} people`); }}>
            <Check size={16} /> {saved ? "Update headcount" : "Save headcount"}
          </Button>}
        </div>
        {saved && <p className="mt-2 text-[12.5px] text-muted">Last saved by {fullName(state.people.find((p) => p.id === saved.byId))} at {saved.at ? timeOf(saved.at) : ""}</p>}
      </Panel>
      <div className="space-y-4">
        <div className="card p-5">
          <p className="text-sm text-muted">Checked in personally</p>
          <p className="num mt-1 text-[34px] font-semibold"><CountUp to={checked} /></p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-page"><div className="h-full rounded-full bg-gradient-to-r from-brand to-j3 transition-all duration-700" style={{ width: `${total ? Math.min(100, (checked / total) * 100) : 0}%` }} /></div>
          <p className="mt-2 text-[12.5px] text-muted">{total ? `${Math.round((checked / total) * 100)}% of the headcount` : "Save the headcount to compare"}</p>
        </div>
        <FirstTimerFeedback meetingId={m.id} />
      </div>
    </div>
  );
}

function FirstTimerFeedback({ meetingId }: { meetingId: string }) {
  const { state } = useStore();
  const fb = state.people.flatMap((p) => (p.feedback ?? []).filter((f) => f.meetingId === meetingId));
  const counts = new Map<string, number>();
  fb.forEach((f) => f.enjoyed.forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1)));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">First-timers enjoyed</p>
      {fb.length === 0 ? <p className="mt-2 text-[13.5px] text-ink-soft">Their feedback appears here after service.</p> : (
        <>
          <ul className="mt-3 space-y-2">{top.map(([k, n]) => <li key={k} className="flex items-center justify-between text-[14px]"><span>{k}</span><Badge tone="good">{n}</Badge></li>)}</ul>
          {fb.find((f) => f.comment) && <p className="mt-3 rounded-xl bg-page p-3 text-[13.5px] italic text-ink-soft">“{fb.find((f) => f.comment)!.comment}”</p>}
          <p className="mt-2 text-[12px] text-muted">{fb.length} response{fb.length > 1 ? "s" : ""}</p>
        </>
      )}
    </div>
  );
}

/** An usher checks people in by name: for anyone without a phone, or a whole family at once. */
function UsherCheckin({ meeting }: { meeting: Meeting }) {
  const { state, access, putMany, drop, newId } = useStore();
  const [q, setQ] = useState("");
  const here = new Set(checkinsFor(state, meeting.id).map((a) => a.personId));
  const people = access!.visiblePeople().filter((p) => !p.inactive);
  const found = q.trim().length < 2 ? [] : people.filter((p) => `${p.firstName} ${p.lastName} ${p.phone}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const recent = checkinsFor(state, meeting.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  const checkIn = (ids: string[], method: Attendance["method"]) => {
    const recs = ids.filter((id) => !here.has(id)).map((id) => record(meeting.id, id, method, newId("at")));
    if (!recs.length) return;
    putMany("attendance", recs, `checked in ${recs.length} ${recs.length === 1 ? "person" : "people"} at ${meeting.name}`);
    toast(recs.length === 1 ? `${state.people.find((p) => p.id === recs[0].personId)?.firstName} is checked in` : `${recs.length} people checked in`, { undo: () => recs.forEach((r) => drop("attendance", r.id)) });
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Panel title={`Check in at ${meeting.name}`}>
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name or phone number" className={cx(inputCls, "py-3.5 pl-11 text-[16px]")} />
        </div>
        <ul className="mt-3 space-y-1">
          {found.map((p) => {
            const family = p.householdId ? state.people.filter((x) => x.householdId === p.householdId && x.id !== p.id) : [];
            const isHere = here.has(p.id);
            return (
              <li key={p.id} className="rounded-2xl p-2 ring-1 ring-transparent hover:bg-page hover:ring-line">
                <div className="flex items-center gap-3">
                  <Avatar person={p} size={42} />
                  <span className="min-w-0 flex-1"><span className="block font-medium">{fullName(p)}</span><span className="block text-[13px] text-muted">{p.location ?? "No area"}{family.length ? ` · family of ${family.length + 1}` : ""}</span></span>
                  {isHere ? <Badge tone="good"><Check size={13} /> Here</Badge> : <Button variant="primary" onClick={() => checkIn([p.id], "usher")}><UserCheck size={16} /> Check in</Button>}
                </div>
                {family.length > 0 && !family.every((f) => here.has(f.id)) && (
                  <button onClick={() => checkIn([p.id, ...family.map((f) => f.id)], "family")} className="ml-[54px] mt-2 inline-flex items-center gap-1.5 rounded-xl bg-brand-soft px-3 py-1.5 text-[13px] font-medium text-brand">
                    <Users size={14} /> Check in the whole family ({family.map((f) => f.firstName).join(", ")})
                  </button>
                )}
              </li>
            );
          })}
          {q.trim().length >= 2 && found.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">No one matches. If they're new, use “Add first-timer”.</li>}
          {q.trim().length < 2 && <li className="px-2 py-6 text-center text-sm text-muted">Start typing to find someone.</li>}
        </ul>
      </Panel>
      <Panel title="Just checked in">
        {recent.length === 0 ? <p className="text-sm text-muted">No one yet.</p> : (
          <ul className="space-y-2">
            {recent.map((a) => { const p = state.people.find((x) => x.id === a.personId); return p && (
              <li key={a.id} className="flex items-center gap-3"><Avatar person={p} size={32} /><span className="flex-1 truncate text-[14px]">{fullName(p)}</span><span className="text-[12px] text-muted">{timeOf(a.at)}</span></li>
            ); })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** Roll call for a department meeting: present, late, absent, excused. */
function RollCall() {
  const { state, access, putMany, newId, put } = useStore();
  const groups = state.groups.filter((g) => access!.isLead || access!.isPastoral || access!.leads.has(g.id) || access!.can("groups.manage"));
  const [gid, setGid] = useState(groups[0]?.id);
  const g = state.groups.find((x) => x.id === gid);
  const [marks, setMarks] = useState<Record<string, Attendance["status"]>>({});
  if (!g) return <Empty title="No departments to call" body="Roll call is for leaders of a department." icon={<Users size={26} />} />;
  const members = [...new Set([...g.leaderIds, ...g.memberIds])].map((id) => state.people.find((p) => p.id === id)).filter(Boolean) as typeof state.people;
  const opts: { key: NonNullable<Attendance["status"]>; label: string; cls: string }[] = [
    { key: "present", label: "Present", cls: "bg-good text-white" }, { key: "late", label: "Late", cls: "bg-glow text-white" },
    { key: "absent", label: "Absent", cls: "bg-alert text-white" }, { key: "excused", label: "Excused", cls: "bg-deep-2 text-white" },
  ];
  const save = () => {
    const today = new Date().toISOString().slice(0, 10);
    const m: Meeting = { id: newId("m"), name: `${g.name} meeting`, kind: "special", date: today, start: new Date().toISOString(), end: new Date(Date.now() + 2 * 36e5).toISOString(), mode: "physical", checkin: false, refId: g.id };
    put("meetings", m);
    putMany("attendance", Object.entries(marks).map(([pid, s]) => record(m.id, pid, "rollcall", newId("at"), s)), `took roll call for ${g.name}`);
    toast(`Roll call saved for ${g.name}`); setMarks({});
  };
  const count = (s: string) => Object.values(marks).filter((x) => x === s).length;
  return (
    <Panel title="Roll call" action={<select className="rounded-xl bg-page px-3 py-1.5 text-sm ring-1 ring-line" value={gid} onChange={(e) => { setGid(e.target.value); setMarks({}); }} aria-label="Department">{groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={() => setMarks(Object.fromEntries(members.map((p) => [p.id, "present"])))}><Check size={15} /> Mark everyone present</Button>
        {opts.map((o) => <Badge key={o.key} tone={o.key === "present" ? "good" : o.key === "late" ? "glow" : o.key === "absent" ? "alert" : "neutral"}>{o.label} {count(o.key)}</Badge>)}
      </div>
      <ul className="divide-y divide-line">
        {members.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <Avatar person={p} size={36} />
            <span className="min-w-0 flex-1 font-medium">{fullName(p)}</span>
            <span className="flex gap-1">
              {opts.map((o) => (
                <button key={o.key} onClick={() => setMarks({ ...marks, [p.id]: o.key })} className={cx("rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition", marks[p.id] === o.key ? o.cls : "bg-page text-ink-soft ring-1 ring-line hover:ring-ink/20")}>{o.label}</button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end"><Button variant="primary" disabled={!Object.keys(marks).length} onClick={save}>Save roll call</Button></div>
    </Panel>
  );
}

function History() {
  const { state } = useStore();
  const series = sundaySeries(state);
  const avg = series.length ? Math.round(series.reduce((a, b) => a + b.total, 0) / series.length) : 0;
  const best = series.reduce((a, b) => (b.total > a.total ? b : a), series[0] ?? { total: 0, date: "" });
  const ft = series.reduce((a, b) => a + b.firstTimers, 0);
  const goal = state.church.attendanceGoal;
  if (!series.length) return <Empty title="No Sundays counted yet" body="Save a headcount on Sunday and the trend starts here." icon={<Users size={26} />} />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-4"><p className="num text-[30px] font-semibold"><CountUp to={series.at(-1)!.total} /></p><p className="text-[13.5px] text-ink-soft">last Sunday</p></div>
        <div className="card p-4"><p className="num text-[30px] font-semibold"><CountUp to={avg} /></p><p className="text-[13.5px] text-ink-soft">average Sunday</p></div>
        <div className="card p-4"><p className="num text-[30px] font-semibold text-good"><CountUp to={best.total} /></p><p className="text-[13.5px] text-ink-soft">best, {shortDate(best.date)}</p></div>
        <div className="card p-4"><p className="num text-[30px] font-semibold text-brand"><CountUp to={ft} /></p><p className="text-[13.5px] text-ink-soft">first-timers counted</p></div>
      </div>
      <Panel title="Sunday attendance" action={goal ? <Badge tone="brand">Goal {goal}</Badge> : undefined}>
        <StackedBars data={series.map((s) => ({ label: shortDate(s.date), values: [s.men, s.women, s.children] }))} keys={["men", "women", "children"]} labels={["Men", "Women", "Children"]} colors={["var(--color-brand)", "var(--color-j3)", "#f59e0b"]} />
      </Panel>
    </div>
  );
}

function Schedule() {
  const { state, updateChurch, newId } = useStore();
  const services = state.church.profile?.services ?? [];
  const [edit, setEdit] = useState<ServiceSlot | null>(null);
  const save = (list: ServiceSlot[], what: string) => updateChurch({}, { services: list }, what);
  return (
    <Panel title="Weekly services" action={<Button onClick={() => setEdit({ id: newId("s"), name: "", weekdays: [3], start: "18:00", end: "19:30", kind: "midweek", mode: "physical", checkin: false })}><Plus size={15} /> Add a service</Button>}>
      <ul className="divide-y divide-line">
        {services.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className={cx("flex size-11 items-center justify-center rounded-2xl font-display text-sm font-semibold", s.kind === "sunday" ? "bg-brand text-white" : "bg-brand-soft text-brand")}>{WEEKDAYS[s.weekdays[0]].slice(0, 3)}</span>
            <button onClick={() => setEdit(s)} className="min-w-0 flex-1 text-left">
              <span className="block font-medium">{s.name}</span>
              <span className="block text-[13px] text-muted">{s.weekdays.map((d) => WEEKDAYS[d].slice(0, 3)).join(", ")} · {fmt(s.start)} to {fmt(s.end)} · {s.mode === "physical" ? "In person" : s.mode === "virtual" ? "Online" : "Hybrid"}</span>
            </button>
            <span className="flex items-center gap-2 text-[13px] text-ink-soft">
              {s.kind === "sunday" ? <Badge tone="brand">Check-in always on</Badge> : <>Check-in <Toggle label={`Check-in for ${s.name}`} on={s.checkin} onChange={(v) => save(services.map((x) => (x.id === s.id ? { ...x, checkin: v } : x)), `turned check-in ${v ? "on" : "off"} for ${s.name}`)} /></>}
            </span>
          </li>
        ))}
      </ul>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit && services.some((s) => s.id === edit.id) ? "Edit service" : "Add a service"}>
        {edit && <ServiceForm s={edit} onSave={(s) => { save(services.some((x) => x.id === s.id) ? services.map((x) => (x.id === s.id ? s : x)) : [...services, s], `saved the service ${s.name}`); setEdit(null); toast("Service saved"); }}
          onDelete={services.some((x) => x.id === edit.id) ? () => { save(services.filter((x) => x.id !== edit.id), `removed the service ${edit.name}`); setEdit(null); } : undefined} />}
      </Sheet>
    </Panel>
  );
}
const fmt = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

function ServiceForm({ s: initial, onSave, onDelete }: { s: ServiceSlot; onSave: (s: ServiceSlot) => void; onDelete?: () => void }) {
  const [s, setS] = useState(initial);
  return (
    <div className="space-y-4">
      <label className="block"><span className="mb-1.5 block text-sm font-medium">Name</span><input className={inputCls} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Midweek service" /></label>
      <div><span className="mb-1.5 block text-sm font-medium">Days</span>
        <div className="flex flex-wrap gap-1.5">{WEEKDAYS.map((d, i) => (
          <button key={d} onClick={() => setS({ ...s, weekdays: s.weekdays.includes(i) ? s.weekdays.filter((x) => x !== i) : [...s.weekdays, i].sort() })} className={cx("rounded-xl px-3 py-2 text-sm ring-1", s.weekdays.includes(i) ? "bg-brand text-white ring-brand" : "bg-page ring-line")}>{d.slice(0, 3)}</button>
        ))}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label><span className="mb-1.5 block text-sm font-medium">Starts</span><input type="time" className={inputCls} value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} /></label>
        <label><span className="mb-1.5 block text-sm font-medium">Ends</span><input type="time" className={inputCls} value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} /></label>
      </div>
      <div><span className="mb-1.5 block text-sm font-medium">Type</span>
        <div className="grid grid-cols-3 gap-1.5">{(["sunday", "midweek", "prayer"] as const).map((k) => <button key={k} onClick={() => setS({ ...s, kind: k, checkin: k === "sunday" ? true : s.checkin })} className={cx("rounded-xl py-2 text-sm capitalize ring-1", s.kind === k ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{k === "sunday" ? "Sunday" : k}</button>)}</div>
      </div>
      <div><span className="mb-1.5 block text-sm font-medium">Where</span>
        <div className="grid grid-cols-3 gap-1.5">{(["physical", "virtual", "hybrid"] as const).map((k) => <button key={k} onClick={() => setS({ ...s, mode: k })} className={cx("rounded-xl py-2 text-sm ring-1", s.mode === k ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{k === "physical" ? "In person" : k === "virtual" ? "Online" : "Both"}</button>)}</div>
      </div>
      {s.mode !== "physical" && <label className="block"><span className="mb-1.5 block text-sm font-medium">Online link</span><input className={inputCls} value={s.link ?? ""} onChange={(e) => setS({ ...s, link: e.target.value })} placeholder="https://youtube.com/…" /></label>}
      {s.kind !== "sunday" && <label className="flex items-center justify-between rounded-xl bg-page p-3 ring-1 ring-line"><span className="text-sm">People check in at this service</span><Toggle label="Check-in" on={s.checkin} onChange={(v) => setS({ ...s, checkin: v })} /></label>}
      <Button variant="primary" className="w-full py-3" disabled={!s.name.trim() || !s.weekdays.length} onClick={() => onSave(s)}>Save service</Button>
      {onDelete && <Button variant="ghost" className="w-full text-alert" onClick={onDelete}>Remove this service</Button>}
    </div>
  );
}
