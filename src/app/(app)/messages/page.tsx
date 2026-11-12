"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Cake, Check, Heart, Mail, Megaphone, MoonStar, Send, Smartphone, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Badge, Button, Empty, Field, Panel, Tabs, Toggle, cx, inputCls, toast } from "@/components/ui";
import { TemplatePicker, WhatsAppIcon } from "@/components/care";
import { eventWhen } from "@/components/event-page";
import { ago, daysToBirthday, fullName, shortDate } from "@/lib/format";
import type { Announcement, Person } from "@/lib/types";

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Days until the next anniversary of a YYYY-MM-DD date (0 = today). */
const daysTo = (d?: string) => daysToBirthday(d);
const lagosHour = () => Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }).format(new Date()));

export default function Messages() {
  const { access } = useStore();
  const [tab, setTab] = useState<"celebrate" | "announce" | "settings">("celebrate");
  useEffect(() => { if (new URLSearchParams(location.search).get("event")) setTab("announce"); }, []);
  if (!access) return null;
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-[30px] font-semibold tracking-tight md:text-[34px]">Messages</h1>
        <p className="mt-1 text-ink-soft">Celebrate your people, and keep the church in the loop.</p>
      </header>
      <Tabs className="mb-5" value={tab} onChange={setTab} items={[{ key: "celebrate", label: "Celebrations" }, { key: "announce", label: "Announcements" }, { key: "settings", label: "Your notifications" }]} />
      <div key={tab} className="rise">
        {tab === "celebrate" && <Celebrations />}
        {tab === "announce" && <Announcements />}
        {tab === "settings" && <MySettings />}
      </div>
    </div>
  );
}

function Celebrations() {
  const { state, access, me, put } = useStore();
  const [picking, setPicking] = useState<{ p: Person; kind: "birthday" | "anniversary" } | null>(null);
  const year = new Date().getFullYear();
  const family = state.groups.some((g) => g.tags?.includes("family") && (g.leaderIds.includes(me!.id) || g.overseerId === me!.id));
  const membership = state.groups.some((g) => g.tags?.includes("membership") && (g.leaderIds.includes(me!.id) || g.overseerId === me!.id));
  const everyone = access!.isLead || membership || family;
  const pool = (everyone ? state.people : access!.visiblePeople()).filter((p) => !p.inactive && p.id !== me!.id);
  const rows = useMemo(() => [
    ...pool.filter((p) => !p.isChild && (daysTo(p.birthday) ?? 99) <= 6).map((p) => ({ p, kind: "birthday" as const, d: daysTo(p.birthday)! })),
    ...(family || access!.isLead || membership || access!.isPastoral ? pool : []).filter((p) => (daysTo(p.anniversary) ?? 99) <= 6).map((p) => ({ p, kind: "anniversary" as const, d: daysTo(p.anniversary)! })),
  ].sort((a, b) => a.d - b.d), [pool, family, membership, access]);
  const sentBy = (p: Person, kind: string) => state.wishes.filter((w) => w.personId === p.id && w.kind === kind && w.year === year);
  const today = rows.filter((r) => r.d === 0);

  if (!rows.length) return <Empty title="No celebrations this week" body="Birthdays and wedding anniversaries for the people in your care show up here." icon={<Cake size={26} />} />;
  return (
    <div className="space-y-5">
      {today.length > 0 && (
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#fff6e5] via-white to-[#eef0ff] p-6 ring-1 ring-line md:p-8">
          <div aria-hidden className="absolute -right-6 -top-6 text-[120px] leading-none opacity-20">🎉</div>
          <p className="text-[13px] font-semibold uppercase tracking-[.18em] text-glow-ink">Today</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{today.map((r) => r.p.firstName).join(", ")} {today.length > 1 ? "are" : "is"} celebrating</p>
          <div className="mt-4 flex -space-x-2">{today.slice(0, 8).map((r) => <span key={r.p.id + r.kind} className="rounded-full ring-4 ring-surface"><Avatar person={r.p} size={44} /></span>)}</div>
        </section>
      )}
      <Panel title="This week">
        <ul className="divide-y divide-line">
          {rows.map(({ p, kind, d }) => {
            const sent = sentBy(p, kind);
            const mine = sent.some((w) => w.byId === me!.id);
            return (
              <li key={p.id + kind} className="flex flex-wrap items-center gap-3 py-3">
                <span className="relative"><Avatar person={p} size={44} /><span className={cx("absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full ring-2 ring-surface", kind === "birthday" ? "bg-glow text-white" : "bg-alert text-white")}>{kind === "birthday" ? <Cake size={11} /> : <Heart size={11} />}</span></span>
                <span className="min-w-0 flex-1">
                  <Link href={`/people/${p.id}`} className="block font-medium hover:text-brand">{fullName(p)}</Link>
                  <span className="block text-[13px] text-muted">{kind === "birthday" ? "Birthday" : "Wedding anniversary"} · {d === 0 ? "today" : d === 1 ? "tomorrow" : WEEK[(new Date().getDay() + d) % 7]}{sent.length > 0 && ` · wished by ${sent.map((w) => (w.byId === me!.id ? "you" : state.people.find((x) => x.id === w.byId)?.firstName)).join(", ")}`}</span>
                </span>
                {mine ? <Badge tone="good"><Check size={12} /> Sent</Badge> : access!.canSeeContacts(p) && <button onClick={() => setPicking({ p, kind })} className="inline-flex items-center gap-1.5 rounded-xl bg-[#e7f8ee] px-3.5 py-2 text-sm font-medium text-[#0f7a3d] hover:bg-[#d6f3e2]"><WhatsAppIcon /> Send wishes</button>}
              </li>
            );
          })}
        </ul>
      </Panel>
      {picking && <TemplatePicker person={picking.p} category={picking.kind} onClose={() => setPicking(null)} onSent={() => { put("wishes", { personId: picking.p.id, kind: picking.kind, year, byId: me!.id, at: new Date().toISOString() }); toast("Wishes sent. That will make their day."); }} />}
    </div>
  );
}

function Announcements() {
  const { state, access, me, put, newId } = useStore();
  const canAll = access!.isPastoral || access!.isLead || access!.can("messages.bulk");
  const myGroups = state.groups.filter((g) => access!.leads.has(g.id));
  const eventId = typeof window !== "undefined" ? new URLSearchParams(location.search).get("event") : null;
  const ev = state.events.find((e) => e.id === eventId);
  const [a, setA] = useState<Omit<Announcement, "id" | "byId" | "at">>({
    title: ev ? ev.title : "", body: ev ? `${ev.theme ?? ev.tagline}\n\n${eventWhen(ev)}${ev.venue ? ` · ${ev.venue}` : ""}\nRegister free on the event page.` : "",
    audience: ev ? { type: "all" } : canAll ? { type: "all" } : { type: "group", id: myGroups[0]?.id }, channels: ["app", "email"],
  });
  if (!canAll && !myGroups.length) return <Empty title="Announcements" body="Pastors, the admin and department heads can send announcements." icon={<Megaphone size={26} />} />;
  const people = state.people.filter((p) => !p.isChild && !p.inactive && !p.prefs?.noAnnouncements);
  const reach = a.audience.type === "all" ? people.length
    : a.audience.type === "group" ? people.filter((p) => state.groups.find((g) => g.id === a.audience.id)?.memberIds.includes(p.id) || state.groups.find((g) => g.id === a.audience.id)?.leaderIds.includes(p.id)).length
    : a.audience.type === "stage" ? people.filter((p) => p.stage === a.audience.id).length
    : a.audience.type === "programme" ? state.enrolments.filter((e) => e.programmeId === a.audience.id).length
    : state.registrations.filter((r) => r.eventId === a.audience.id).length;
  const quiet = lagosHour() >= 22 || lagosHour() < 6;
  const history = state.announcements.slice().sort((x, y) => y.at.localeCompare(x.at));
  const ch = (k: Announcement["channels"][number]) => setA({ ...a, channels: a.channels.includes(k) ? a.channels.filter((x) => x !== k) : [...a.channels, k] });
  const send = () => {
    const next6 = new Date(); next6.setUTCHours(5, 0, 0, 0); if (next6.getTime() < Date.now()) next6.setUTCDate(next6.getUTCDate() + 1);
    put("announcements", { ...a, id: newId("an"), byId: me!.id, at: new Date().toISOString(), scheduledFor: quiet && a.channels.some((c) => c !== "app") ? next6.toISOString() : undefined }, `sent the announcement “${a.title}”`);
    if (a.channels.includes("whatsapp")) window.open(`https://wa.me/?text=${encodeURIComponent(`*${a.title}*\n\n${a.body}`)}`, "_blank", "noopener");
    toast(quiet ? "Scheduled for 6:00 AM, after quiet hours" : `Sent to ${reach} people`);
    setA({ ...a, title: "", body: "" });
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Panel title="New announcement">
        <div className="space-y-4">
          <Field label="To">
            <select className={inputCls} value={`${a.audience.type}:${a.audience.id ?? ""}`} onChange={(e) => { const [type, id] = e.target.value.split(":"); setA({ ...a, audience: { type: type as Announcement["audience"]["type"], id: id || undefined } }); }}>
              {canAll && <option value="all:">The whole church</option>}
              {(canAll ? state.groups.filter((g) => g.kind === "department") : myGroups).map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
              {canAll && <><option value="stage:worker">All workers</option><option value="stage:member">All members</option><option value="stage:first_timer">First-timers</option></>}
              {canAll && state.programmes.map((p) => <option key={p.id} value={`programme:${p.id}`}>Students in {p.name}</option>)}
              {canAll && state.events.filter((e) => e.status === "published").map((e) => <option key={e.id} value={`event:${e.id}`}>Registered for {e.title}</option>)}
            </select>
          </Field>
          <Field label="Title"><input className={inputCls} value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder="Choir rehearsal moved to Friday" /></Field>
          <Field label="Message"><textarea className={cx(inputCls, "min-h-36")} value={a.body} onChange={(e) => setA({ ...a, body: e.target.value })} /></Field>
          <div><span className="mb-1.5 block text-sm font-medium">Send by</span>
            <div className="grid grid-cols-3 gap-1.5">
              {([["app", "In Traqi", Smartphone], ["email", "Email", Mail], ["whatsapp", "WhatsApp", BellRing]] as const).map(([k, l, I]) => (
                <button key={k} onClick={() => ch(k)} className={cx("flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm ring-1", a.channels.includes(k) ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{k === "whatsapp" ? <WhatsAppIcon size={15} /> : <I size={15} />}{l}</button>
              ))}
            </div>
            {a.channels.includes("whatsapp") && <p className="mt-1.5 text-[12.5px] text-muted">Opens WhatsApp so you can post it to your church groups or broadcast list.</p>}
          </div>
          {quiet && <p className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-[13px] text-brand"><MoonStar size={15} /> Quiet hours (10:00 PM to 6:00 AM). Emails go out at 6:00 AM.</p>}
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="flex items-center gap-1.5 text-sm text-ink-soft"><Users size={15} /> Reaches {reach.toLocaleString()} {reach === 1 ? "person" : "people"}</span>
            <Button variant="primary" disabled={!a.title.trim() || !a.body.trim() || !a.channels.length} onClick={send}><Send size={15} /> Send</Button>
          </div>
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel title="Preview">
          <div className="rounded-2xl bg-page p-4">
            <p className="text-[12px] text-muted">{state.church.name} · now</p>
            <p className="mt-1 font-semibold">{a.title || "Your title"}</p>
            <p className="mt-1 whitespace-pre-line text-[14px] text-ink-soft">{a.body || "Your message appears here."}</p>
          </div>
        </Panel>
        <Panel title="Sent before">
          {history.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
            <ul className="space-y-3">{history.slice(0, 8).map((h) => (
              <li key={h.id} className="rounded-2xl p-3 ring-1 ring-line">
                <p className="font-medium">{h.title}</p>
                <p className="text-[12.5px] text-muted">{h.audience.type === "all" ? "Whole church" : h.audience.type === "group" ? state.groups.find((g) => g.id === h.audience.id)?.name : h.audience.type} · {fullName(state.people.find((p) => p.id === h.byId))} · {h.scheduledFor && Date.parse(h.scheduledFor) > Date.now() ? `scheduled ${shortDate(h.scheduledFor)}` : ago(h.at)}</p>
              </li>
            ))}</ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function MySettings() {
  const { me, updatePerson, access } = useStore();
  const prefs = me!.prefs ?? {};
  return (
    <Panel title="How Traqi reaches you">
      <div className="space-y-3">
        {!access!.isMemberOnly && (
          <label className="flex items-center justify-between gap-4 rounded-2xl bg-page p-4 ring-1 ring-line">
            <span><b className="block font-semibold">Daily email at 7:00 AM</b><span className="text-[13.5px] text-muted">A short list of what needs you today. Only sent when there&apos;s something.</span></span>
            <Toggle label="Daily email" on={!prefs.noNudgeEmail} onChange={(v) => { updatePerson(me!.id, { prefs: { ...prefs, noNudgeEmail: !v } }, "self"); toast(v ? "Daily email on" : "Daily email off"); }} />
          </label>
        )}
        {(access!.isLead || access!.can("roles.manage")) && (
          <label className="flex items-center justify-between gap-4 rounded-2xl bg-page p-4 ring-1 ring-line">
            <span><b className="block font-semibold">Monday summary and month-end report</b><span className="text-[13.5px] text-muted">Monday at 7:00 AM, and 8:00 PM on the last day of each month.</span></span>
            <Toggle label="Report emails" on={!prefs.noReportEmails} onChange={(v) => { updatePerson(me!.id, { prefs: { ...prefs, noReportEmails: !v } }, "self"); toast(v ? "Report emails on" : "Report emails off"); }} />
          </label>
        )}
        <label className="flex items-center justify-between gap-4 rounded-2xl bg-page p-4 ring-1 ring-line">
          <span><b className="block font-semibold">Church announcements</b><span className="text-[13.5px] text-muted">News from your pastors and departments.</span></span>
          <Toggle label="Announcements" on={!prefs.noAnnouncements} onChange={(v) => { updatePerson(me!.id, { prefs: { ...prefs, noAnnouncements: !v } }, "self"); toast(v ? "Announcements on" : "Announcements off"); }} />
        </label>
        <p className="flex items-center gap-2 px-1 pt-1 text-[13px] text-muted"><MoonStar size={14} /> Nothing is sent between 10:00 PM and 6:00 AM.</p>
      </div>
    </Panel>
  );
}
