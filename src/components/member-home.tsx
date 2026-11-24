"use client";

import Link from "next/link";
import { useState } from "react";
import { EventDuties } from "./event-duties";
import { MyEvents } from "./my-events";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock, ExternalLink, Film, FolderOpen, Globe, HandHeart, HeartHandshake, Mic, Send, Sparkles, Ticket, Trophy, UserRound, Users, Mail, MessageCircleHeart, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Button, Sheet, cx, toast } from "./ui";
import { kindOf } from "@/lib/journey";
import { WhatsAppIcon } from "./care";
import { NewRoleCard } from "./role-cards";
import { MetSomeoneButton } from "./outreach";
import { ListenToMessages, NeedHelp } from "./messages-help";
import { meetingWhen, upcomingMeetings } from "./department-extras";
import { TodayService } from "./rollcall";
import { COVERS } from "./brand";
import { eventWhen } from "./event-page";
import { useWords } from "./theme";
import { isLimited, isUnconfirmed, nextMeeting, openMeeting, progress } from "@/lib/domain";
import { nextStepFor } from "@/lib/journey-engine";
import { daysToBirthday, fullName, greeting, shortDate, stageInfo, timeOf, todayLong } from "@/lib/format";
import type { Resource } from "@/lib/types";

const RES_ICON: Record<Resource["kind"], typeof Film> = { youtube: Film, telegram: Send, drive: FolderOpen, podcast: Mic, website: Globe, instagram: Globe, facebook: Globe, other: ExternalLink };

/** Home for members and workers: cards for what matters to them this week. */
export function MemberHome() {
  const { me, state, requestPlacement } = useStore();
  const w = useWords();
  const [asking, setAsking] = useState(false);
  const [depts, setDepts] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [team, setTeam] = useState<string | null>(null);
  if (!me) return null;

  const profile = state.church.profile;
  const unconfirmed = isUnconfirmed(me);
  const now = Date.now();
  const open = openMeeting(state.meetings, now);
  const next = nextMeeting(state.meetings, now, "sunday");
  const checkedIn = open && state.attendance.some((a) => a.meetingId === open.id && a.personId === me.id);
  const step = nextStepFor(state, me);
  const myGroups = state.groups.filter((g) => g.memberIds.includes(me.id) || g.leaderIds.includes(me.id));
  const serving = myGroups.filter((g) => g.kind === "department" || g.kind === "unit");
  const myPlacements = state.placements.filter((x) => x.personId === me.id);
  const mine = myPlacements.at(-1);
  const openAsks = myPlacements.filter((x) => x.status === "open");
  const recentNo = myPlacements.filter((x) => x.status === "declined" && Date.now() - Date.parse(x.decidedAt ?? x.at) < 14 * 864e5);
  // Members not yet serving anywhere get asked whether they're a worker
  const askWorker = kindOf(me.stage) === "member" && !serving.length && !openAsks.length;
  const enrolments = state.enrolments.filter((e) => e.personId === me.id && e.status === "active");
  const myRegs = state.registrations.filter((r) => r.personId === me.id && r.status === "confirmed");
  const events = state.events.filter((e) => e.status === "published" && Date.parse(e.end) > now).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const live = events.find((e) => Date.parse(e.start) - 30 * 6e4 <= now && myRegs.some((r) => r.eventId === e.id));
  const b = daysToBirthday(me.birthday);
  const showCommunity = !!profile?.whatsapp && (!unconfirmed || profile.whatsappForUnconfirmed);
  const deptLinks = serving.filter((g) => g.whatsapp);
  const prayers = state.prayers.filter((p) => p.personId === me.id);
  const prayedLately = prayers.filter((p) => p.prayed.some((x) => now - Date.parse(x.at) < 7 * 864e5));
  const answered = prayers.filter((p) => p.answered && now - Date.parse(p.answered) < 7 * 864e5);
  const myWelfare = state.welfare.filter((x) => x.personId === me.id && (x.givenAt || x.decision) && now - Date.parse(x.givenAt ?? x.decision!.at) < 7 * 864e5);
  const teamGroup = state.groups.find((g) => g.id === team);
  const teammates = (gid: string) => {
    const g = state.groups.find((x) => x.id === gid)!;
    return [...new Set([...g.leaderIds, ...g.memberIds])].filter((id) => id !== me.id).map((id) => state.people.find((p) => p.id === id)!).filter((p) => p && !p.inactive);
  };
  // Events only show when they need you: open for registration, or you're registered and it's coming
  const days = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - now) / 864e5));
  const links = [
    showCommunity && { href: profile!.whatsapp!, label: "Church WhatsApp", icon: "wa" as const },
    ...deptLinks.map((g) => ({ href: g.whatsapp!, label: `${g.name} group`, icon: "wa" as const })),
    ...(profile?.resources ?? []).map((r) => ({ href: r.url, label: r.title, icon: RES_ICON[r.kind] ?? ExternalLink })),
  ].filter(Boolean) as { href: string; label: string; icon: "wa" | typeof Film }[];
  const stageName = stageInfo(me.stage).label;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Hello */}
      <section className="hero rise relative overflow-hidden rounded-[28px] p-6 text-white md:p-7">
        <p className="text-[14px] text-white/75">{todayLong()}</p>
        <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight md:text-[34px]">{greeting()}, {me.firstName}.</h1>
        {b !== null && b <= 7 && <p className="mt-1.5 text-[#ffd48a]">{b === 0 ? "Happy birthday! The whole church is celebrating you today." : `Your birthday is in ${b} day${b === 1 ? "" : "s"}.`}</p>}
        {/* Next service, or check in when it's open */}
        {open ? (
          <Link href={`/checkin/${state.church.slug}`} className={cx("mt-5 flex items-center gap-3 rounded-2xl p-4", checkedIn ? "bg-white/12" : "bg-white text-ink")}>
            <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-xl text-white", checkedIn ? "bg-good" : "bg-brand pulse")}><CheckCircle2 size={21} /></span>
            <span className="min-w-0 flex-1"><b className="block font-semibold">{checkedIn ? "You're checked in" : `Check in to ${open.name}`}</b><span className={cx("text-[13.5px]", checkedIn ? "text-white/75" : "text-ink-soft")}>{checkedIn ? "Glad you're here." : "Open now. One tap."}</span></span>
            {!checkedIn && <ArrowRight size={18} className="text-brand" />}
          </Link>
        ) : next && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/12 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><CalendarDays size={20} /></span>
            <span className="min-w-0 flex-1"><b className="block font-semibold">{next.name}</b><span className="text-[13.5px] text-white/75">{shortDate(next.date)}, {timeOf(next.start)}. Check-in opens 30 minutes before.</span></span>
          </div>
        )}
      </section>

      <EventDuties className="mt-4" />

      {unconfirmed && (
        <div className={cx("mt-4 flex items-start gap-3 rounded-2xl p-4 text-[14px] ring-1", isLimited(me) ? "bg-alert-soft text-alert ring-alert/20" : "bg-brand-soft text-brand ring-brand/20")}>
          <Clock size={18} className="mt-0.5 shrink-0" />
          <span>{isLimited(me) ? <><b>Your account is paused.</b> Ask your church admin to confirm you; everything comes back as soon as they do.</> : <><b>Welcome!</b> You can use Traqi as a {w.member.toLowerCase()} now. {state.church.name} will confirm you soon.</>}</span>
        </div>
      )}

      {/* The two things anyone can do any day */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetSomeoneButton className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-3 text-[15px] font-semibold text-white shadow-lg shadow-brand/25 active:scale-[.98]" />
        <NeedHelp className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-surface px-3 text-[15px] font-semibold text-ink ring-1 ring-line active:scale-[.98]" />
      </div>

      <div className="mt-4 space-y-3">
        <NewRoleCard />
        <TodayService />
        {/* For you: each card only when it applies */}
        {state.counsel.filter((r) => r.personId === me.id && (r.status === "scheduled" ? (r.appt?.date ?? "") >= new Date().toISOString().slice(0, 10) : r.status === "new" || r.status === "forwarded" || r.status === "referred")).slice(0, 1).map((r) => (
          <Link key={r.id} href="/counselling" className="card card-hover flex items-center gap-4 p-4">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${r.status === "scheduled" ? "bg-good-soft text-good" : "bg-brand-soft text-brand"}`}><MessageCircleHeart size={20} /></span>
            <span className="min-w-0 flex-1"><b className="block font-medium">{r.status === "scheduled" ? "Your counselling session is booked" : "Your counselling request"}</b>
              <span className="block text-[13.5px] text-ink-soft">{r.status === "scheduled" && r.appt ? `${shortDate(r.appt.date)} at ${r.appt.time}${r.appt.mode === "virtual" ? " · online" : r.appt.venue ? ` · ${r.appt.venue}` : ""}` : r.status === "referred" ? "Directed to the appropriate quarters. You will be contacted soon." : "Kindly keep checking here for a response from the pastorate."}</span></span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
        {state.challenges.filter((c) => c.participantIds.includes(me.id) && c.start <= new Date().toISOString().slice(0, 10) && c.end >= new Date().toISOString().slice(0, 10)).map((c) => {
          const n = state.outreachContacts.filter((k) => k.challengeId === c.id && k.byId === me.id).length;
          return (
            <Link key={c.id} href={`/challenges?c=${c.id}`} className="card card-hover flex items-center gap-4 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-glow-soft text-glow-ink"><Trophy size={20} /></span>
              <span className="min-w-0 flex-1"><b className="block truncate font-medium">{c.name}</b><span className="text-[13.5px] text-ink-soft">You&apos;ve added {n}{c.targetEach ? ` of ${c.targetEach}` : ""}. See the leaderboard.</span></span>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </Link>
          );
        })}
        {live && (
          <Link href={`/events/${live.id}`} className="card card-hover flex items-center gap-4 p-5 ring-2 ring-glow">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-glow text-white"><Ticket size={21} /></span>
            <span className="min-w-0 flex-1"><b className="block font-display text-[17px] font-semibold">{live.title} is starting</b><span className="text-[13.5px] text-ink-soft">Show your ticket at the door</span></span>
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </Link>
        )}
        <MyEvents />
        {enrolments.length > 0 && (
          <Link href="/classes" className="card card-hover block p-5">
            <p className="font-display text-[16px] font-semibold">Your classes</p>
            {enrolments.map((e) => { const pr = progress(state, e); return (
              <div key={e.id} className="mt-3"><div className="flex justify-between text-[13.5px]"><span>{pr.prog.name}</span><span className="text-muted">{pr.done.length} of {pr.prog.modules.length}</span></div><div className="mt-1.5 h-2 rounded-full bg-page"><div className="h-full rounded-full bg-brand" style={{ width: `${(pr.done.length / pr.prog.modules.length) * 100}%` }} /></div></div>
            ); })}
          </Link>
        )}
        {(answered.length > 0 || prayedLately.length > 0) && (
          <Link href="/prayer" className="card card-hover flex items-center gap-4 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><HandHeart size={19} /></span>
            <span className="min-w-0 flex-1 text-[14px]">{answered.length ? "A prayer request was marked answered. Praise God!" : `Someone prayed for your request this week.`}</span>
          </Link>
        )}
        {myWelfare.length > 0 && (
          <Link href="/welfare" className="card card-hover flex items-center gap-4 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-glow-soft text-glow-ink"><HeartHandshake size={19} /></span>
            <span className="min-w-0 flex-1 text-[14px]">There&apos;s an update on your support request.</span>
          </Link>
        )}
        {askWorker && (
          <div className="card overflow-hidden border-l-4 border-brand p-5">
            <p className="text-[14px] text-ink-soft">You&apos;re registered as a <b className="font-semibold text-ink">member</b> of {state.church.name}.</p>
            <p className="mt-1 font-display text-[18px] font-semibold">Are you a worker?</p>
            <p className="mt-0.5 text-[14px] text-ink-soft">Choose the {w.department.toLowerCase()}s you serve in. Each head will confirm you.</p>
            <Button variant="primary" className="mt-3" onClick={() => setAsking(true)}><Users size={15} /> Choose my {w.department.toLowerCase()}</Button>
          </div>
        )}
        {recentNo.map((x) => (
          <div key={x.id} className="card flex items-start gap-4 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-page text-ink-soft"><Users size={19} /></span>
            <span className="min-w-0 flex-1 text-[14px]">Your request to join {state.groups.find((g) => g.id === x.groupId)?.name} wasn&apos;t approved. Please speak to the church admin.
              {profile?.phone && <a href={`tel:${profile.phone}`} className="mt-1 block font-medium text-brand">Call the church: {profile.phone}</a>}</span>
          </div>
        ))}
        {openAsks.length > 0 && (
          <div className="card flex items-center gap-4 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-page text-ink-soft"><Users size={19} /></span>
            <span className="min-w-0 flex-1 text-[14px]">You asked to join {openAsks.map((x) => state.groups.find((g) => g.id === x.groupId)?.name).filter(Boolean).join(", ")}. {openAsks.length > 1 ? "The heads" : "The head"} will confirm you soon.</span>
          </div>
        )}

        {/* Your journey, in one line */}
        <div className="card flex items-center gap-4 p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-glow-soft text-glow-ink"><Sparkles size={21} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] text-ink-soft">You&apos;re a <b className="font-semibold text-ink">{stageName}</b> at {state.church.name}</span>
            {step && <b className="block font-display text-[16px] font-semibold">{step.title}</b>}
            {step && <span className="block text-[13.5px] text-ink-soft">{step.body}</span>}
          </span>
          {step?.href === "/departments" && !serving.length && mine?.status !== "open"
            ? <Button variant="primary" className="shrink-0" onClick={() => setAsking(true)}>Ask to join</Button>
            : step?.href ? <Link href={step.href} className="shrink-0 rounded-xl bg-brand-soft px-3.5 py-2 text-sm font-semibold text-brand">Go</Link> : null}
        </div>

        {/* Where you serve */}
        {serving.length > 0 && (
          <div className="card p-5">
            <p className="font-display text-[16px] font-semibold">Where you serve</p>
            <ul className="mt-3 space-y-2">
              {serving.map((g) => {
                const t = teammates(g.id);
                const assistant = g.assistants?.find((a) => a.personId === me.id);
                return (
                  <li key={g.id}>
                    <button type="button" onClick={() => setTeam(g.id)} className="flex w-full items-center gap-3 rounded-2xl bg-page px-3.5 py-2.5 text-left ring-1 ring-line hover:ring-brand/40">
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{g.name}</span><span className="block truncate text-[12.5px] text-muted">{upcomingMeetings(g)[0] ? `${upcomingMeetings(g)[0].title}: ${meetingWhen(upcomingMeetings(g)[0])}` : assistant ? assistant.title : g.leaderIds.includes(me.id) ? "You lead this team" : `${t.length} on the team`}</span></span>
                      <span className="flex -space-x-1.5">{t.slice(0, 3).map((p) => <span key={p.id} className="rounded-full ring-2 ring-page"><Avatar person={p} size={24} /></span>)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {me.probation && <p className="mt-3 rounded-xl bg-glow-soft px-3 py-2 text-[13px] text-glow-ink">Serving on probation until {shortDate(me.probation.until)}.</p>}
          </div>
        )}

        {/* Church links and quick places */}
        <div className="flex flex-wrap gap-2 pt-1">
          {links.map((l) => { const I = l.icon; return (
            <a key={l.href + l.label} href={l.href} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[13.5px] font-medium ring-1 ring-line hover:ring-brand/40">
              {I === "wa" ? <span className="text-[#25D366]"><WhatsAppIcon size={16} /></span> : <I size={15} className="text-brand" />}<span className="max-w-[12rem] truncate">{l.label}</span>
            </a>
          ); })}
          <ListenToMessages />
          <Link href="/invitations?new=1" className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[13.5px] font-medium ring-1 ring-line hover:ring-brand/40"><Mail size={15} className="text-brand" /> Invite the church</Link>
          <Link href="/prayer" className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[13.5px] font-medium ring-1 ring-line hover:ring-brand/40"><HandHeart size={15} className="text-brand" /> Prayer request</Link>
          <Link href="/welfare" className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[13.5px] font-medium ring-1 ring-line hover:ring-brand/40"><HeartHandshake size={15} className="text-brand" /> Need support?</Link>
          <Link href={`/people/${me.id}`} className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[13.5px] font-medium ring-1 ring-line hover:ring-brand/40"><UserRound size={15} className="text-brand" /> My details</Link>
        </div>
      </div>

      {/* Fellow workers in a department: names and faces, no phone numbers */}
      <Sheet open={!!teamGroup} onClose={() => setTeam(null)} title={teamGroup?.name ?? ""}>
        {teamGroup && (
          <>
            {teamGroup.whatsapp && <a href={teamGroup.whatsapp} target="_blank" rel="noreferrer" className="mb-4 flex items-center gap-3 rounded-2xl bg-[#25D366]/12 px-4 py-3 ring-1 ring-[#25D366]/40"><WhatsAppIcon size={18} /><span className="flex-1 font-medium">Open the team&apos;s WhatsApp group</span><ExternalLink size={15} /></a>}
            <ul className="-mx-1 divide-y divide-line">
              {teammates(teamGroup.id).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-1 py-2.5">
                  <Avatar person={p} size={38} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{fullName(p)}</span>
                    <span className="block truncate text-[12.5px] text-muted">{teamGroup.leaderIds.includes(p.id) ? "Head" : teamGroup.assistants?.find((a) => a.personId === p.id)?.title ?? "Team member"}</span></span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-2 text-[12.5px] text-muted"><Users size={13} /> You see the people on your own team.</p>
          </>
        )}
      </Sheet>

      <Sheet open={asking} onClose={() => setAsking(false)} title={`Your ${w.department.toLowerCase()}s`} footer={
        <div className="space-y-2">{err && <p className="text-sm text-alert" role="alert">{err}</p>}
          <Button variant="primary" className="w-full py-3" onClick={() => { if (!depts.length) return setErr(`Tick at least one ${w.department.toLowerCase()}.`); depts.forEach((d) => requestPlacement(d, note.trim() || undefined)); setAsking(false); setDepts([]); setNote(""); toast(depts.length > 1 ? "Sent to each head" : "Sent to the head"); }}>{depts.length > 1 ? `Send ${depts.length} requests` : "Send request"}</Button></div>
      }>
        <div className="space-y-4">
          <div className="grid gap-2">
            <p className="text-[14px] text-ink-soft">Tick every {w.department.toLowerCase()} you&apos;re part of.</p>
            {state.groups.filter((g) => g.kind === "department" && !g.tags?.includes("children") && !serving.some((x) => x.id === g.id) && !openAsks.some((x) => x.groupId === g.id)).map((g) => {
              const need = g.requiresClassId ? state.programmes.find((p) => p.id === g.requiresClassId) : undefined;
              return (
                <button type="button" key={g.id} role="checkbox" aria-checked={depts.includes(g.id)} onClick={() => { setDepts(depts.includes(g.id) ? depts.filter((x) => x !== g.id) : [...depts, g.id]); setErr(""); }}
                  className={cx("rounded-2xl px-4 py-3 text-left ring-1", depts.includes(g.id) ? "bg-brand-soft ring-brand" : "bg-surface ring-line hover:ring-ink/20")}>
                  <span className="flex items-center gap-2 font-medium"><span className={cx("flex size-5 shrink-0 items-center justify-center rounded-md ring-1", depts.includes(g.id) ? "bg-brand text-white ring-brand" : "ring-line")}>{depts.includes(g.id) && <Check size={13} />}</span>{g.name}</span>
                  <span className="block text-[13px] text-muted">{g.purpose}</span>
                  {need && <span className="mt-1 flex items-center gap-1 text-[12px] text-glow-ink"><BookOpen size={11} /> Asks for {need.name}</span>}
                </button>
              );
            })}
          </div>
          <textarea className="w-full rounded-xl bg-page px-3.5 py-2.5 text-[15px] ring-1 ring-line outline-none focus:bg-surface focus:ring-2 focus:ring-brand" rows={3}
            placeholder="Anything they should know? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </Sheet>
    </div>
  );
}

function WaLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-[#25D366]/10 px-3.5 py-2.5 ring-1 ring-[#25D366]/30 hover:bg-[#25D366]/15">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[#25D366] text-white"><WhatsAppIcon size={16} /></span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{label}</span>
        <ExternalLink size={14} className="text-muted" />
      </a>
    </li>
  );
}
