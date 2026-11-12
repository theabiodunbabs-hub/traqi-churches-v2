"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock, ExternalLink, Film, FolderOpen, Globe, HandHeart, HeartHandshake, Mic, Send, Sparkles, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Button, JourneyTrack, Sheet, cx } from "./ui";
import { WhatsAppIcon } from "./care";
import { COVERS } from "./brand";
import { eventWhen } from "./event-page";
import { useWords } from "./theme";
import { isLimited, isUnconfirmed, nextMeeting, openMeeting, progress, sundayDots } from "@/lib/domain";
import { nextStepFor } from "@/lib/journey-engine";
import { daysToBirthday, fullName, greeting, shortDate, timeOf, todayLong } from "@/lib/format";
import { kindOf } from "@/lib/journey";
import type { Resource } from "@/lib/types";

const RES_ICON: Record<Resource["kind"], typeof Film> = { youtube: Film, telegram: Send, drive: FolderOpen, podcast: Mic, website: Globe, instagram: Globe, facebook: Globe, other: ExternalLink };

/** Home for members and workers: cards for what matters to them this week. */
export function MemberHome() {
  const { me, state, requestPlacement } = useStore();
  const w = useWords();
  const [asking, setAsking] = useState(false);
  const [dept, setDept] = useState("");
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
  const mine = state.placements.filter((x) => x.personId === me.id).at(-1);
  const enrolments = state.enrolments.filter((e) => e.personId === me.id && e.status === "active");
  const myRegs = state.registrations.filter((r) => r.personId === me.id && r.status === "confirmed");
  const events = state.events.filter((e) => e.status === "published" && Date.parse(e.end) > now).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const live = events.find((e) => Date.parse(e.start) - 30 * 6e4 <= now && myRegs.some((r) => r.eventId === e.id));
  const ids = new Set(myGroups.map((g) => g.id));
  const news = me.prefs?.noAnnouncements ? [] : state.announcements
    .filter((a) => a.audience.type === "all" || (a.audience.type === "group" && ids.has(a.audience.id ?? "")) || (a.audience.type === "stage" && kindOf(me.stage) === kindOf(a.audience.id ?? "")))
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
  const dots = sundayDots(state, me.id);
  const household = state.people.filter((p) => p.householdId && p.householdId === me.householdId && p.id !== me.id);
  const b = daysToBirthday(me.birthday);
  const showCommunity = !!profile?.whatsapp && (!unconfirmed || profile.whatsappForUnconfirmed);
  const deptLinks = serving.filter((g) => g.whatsapp);
  const prayers = state.prayers.filter((p) => p.personId === me.id && !p.answered);
  const teamGroup = state.groups.find((g) => g.id === team);
  const teammates = (gid: string) => {
    const g = state.groups.find((x) => x.id === gid)!;
    return [...new Set([...g.leaderIds, ...g.memberIds])].filter((id) => id !== me.id).map((id) => state.people.find((p) => p.id === id)!).filter((p) => p && !p.inactive);
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hello */}
      <section className="hero rise relative overflow-hidden rounded-[28px] p-6 text-white md:p-8">
        <p className="text-[14px] text-white/65">{todayLong()}</p>
        <h1 className="mt-1 font-display text-[30px] font-semibold tracking-tight md:text-[38px]">{greeting()}, {me.firstName}.</h1>
        {b !== null && b <= 7 && <p className="mt-1.5 text-[#ffd48a]">{b === 0 ? "Happy birthday! The whole church is celebrating you today." : `Your birthday is in ${b} day${b === 1 ? "" : "s"}.`}</p>}
        <div className="mt-6 rounded-2xl bg-surface p-4 text-ink md:p-5">
          <p className="mb-3 text-[13px] font-medium text-ink-soft">Your journey at {state.church.name}</p>
          <JourneyTrack stage={me.stage} />
        </div>
      </section>

      {unconfirmed && (
        <div className={cx("mt-4 flex items-start gap-3 rounded-2xl p-4 text-[14px] ring-1", isLimited(me) ? "bg-alert-soft text-alert ring-alert/20" : "bg-brand-soft text-brand ring-brand/20")}>
          <Clock size={18} className="mt-0.5 shrink-0" />
          <span>{isLimited(me) ? <><b>Your account is paused.</b> Ask your church admin to confirm you; everything comes back as soon as they do.</> : <><b>Welcome!</b> You can use Traqi as a {w.member.toLowerCase()} now. {state.church.name} will confirm you soon.</>}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {/* Check in: live from 30 minutes before */}
        {open ? (
          <Link href={`/checkin/${state.church.slug}`} className={cx("card card-hover flex items-center gap-4 p-5 sm:col-span-2", !checkedIn && "ring-2 ring-brand")}>
            <span className={cx("flex size-12 shrink-0 items-center justify-center rounded-2xl text-white", checkedIn ? "bg-good" : "bg-brand pulse")}><CheckCircle2 size={22} /></span>
            <span className="flex-1"><b className="block font-display text-[18px] font-semibold">{checkedIn ? "You're checked in" : `Check in to ${open.name}`}</b><span className="text-sm text-ink-soft">{checkedIn ? "Glad you're here." : "Open now. One tap."}</span></span>
            {!checkedIn && <ArrowRight size={18} className="text-brand" />}
          </Link>
        ) : next && (
          <div className="card flex items-center gap-4 p-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-page text-ink-soft ring-1 ring-line"><CalendarDays size={21} /></span>
            <span className="flex-1"><b className="block font-display text-[16px] font-semibold">{next.name}</b><span className="text-[13.5px] text-ink-soft">{shortDate(next.date)}, {timeOf(next.start)}. Check-in opens 30 minutes before.</span></span>
          </div>
        )}

        {live && (
          <Link href={`/events/${live.id}`} className="card card-hover flex items-center gap-4 p-5 ring-2 ring-glow">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-glow text-white"><Sparkles size={21} /></span>
            <span className="flex-1"><b className="block font-display text-[16px] font-semibold">{live.title}</b><span className="text-[13.5px] text-ink-soft">Show your ticket at the door</span></span>
          </Link>
        )}

        {/* Next step on their journey */}
        {step && (
          <Link href={step.href ?? `/people/${me.id}`} className="card card-hover flex items-center gap-4 p-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-glow-soft text-glow-ink"><Sparkles size={21} /></span>
            <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-semibold uppercase tracking-wider text-muted">Your next step</span><b className="block font-display text-[16px] font-semibold">{step.title}</b><span className="text-[13.5px] text-ink-soft">{step.body}</span></span>
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </Link>
        )}

        {/* Community */}
        {(showCommunity || deptLinks.length > 0) && (
          <div className="card p-5">
            <p className="font-display text-[16px] font-semibold">Stay connected</p>
            <ul className="mt-3 space-y-2">
              {showCommunity && <WaLink href={profile!.whatsapp!} label={`${state.church.name} community`} />}
              {deptLinks.map((g) => <WaLink key={g.id} href={g.whatsapp!} label={`${g.name} group`} />)}
            </ul>
          </div>
        )}

        {/* Where you serve, and your team */}
        <div className="card p-5">
          {serving.length ? (
            <>
              <p className="font-display text-[16px] font-semibold">Where you serve</p>
              <ul className="mt-3 space-y-2">
                {serving.map((g) => {
                  const t = teammates(g.id);
                  const assistant = g.assistants?.find((a) => a.personId === me.id);
                  return (
                    <li key={g.id}>
                      <button onClick={() => setTeam(g.id)} className="flex w-full items-center gap-3 rounded-2xl bg-page px-3.5 py-2.5 text-left ring-1 ring-line hover:ring-brand/40">
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{g.name}</span><span className="block truncate text-[12.5px] text-muted">{assistant ? assistant.title : g.leaderIds.includes(me.id) ? "You lead this team" : `${t.length} on the team`}</span></span>
                        <span className="flex -space-x-1.5">{t.slice(0, 3).map((p) => <span key={p.id} className="rounded-full ring-2 ring-page"><Avatar person={p} size={24} /></span>)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {me.probation && <p className="mt-3 rounded-xl bg-glow-soft px-3 py-2 text-[13px] text-glow-ink">Serving on probation until {shortDate(me.probation.until)}.</p>}
            </>
          ) : mine?.status === "open" ? (
            <><p className="font-display text-[16px] font-semibold">Request sent</p><p className="mt-1 text-sm text-ink-soft">You asked to join {state.groups.find((g) => g.id === mine.groupId)?.name}. Someone will be in touch.</p></>
          ) : (
            <>
              <p className="font-display text-[16px] font-semibold">Serve with us</p>
              <p className="mt-1 text-sm text-ink-soft">{mine?.status === "declined" ? "That team is full for now. Try another." : `Find a ${w.department.toLowerCase()} where your gifts fit.`}</p>
              <Button variant="primary" className="mt-4" onClick={() => setAsking(true)}>Ask to join</Button>
            </>
          )}
        </div>

        {/* Classes, only once enrolled */}
        {enrolments.length > 0 && (
          <Link href="/classes" className="card card-hover p-5">
            <p className="font-display text-[16px] font-semibold">Your classes</p>
            {enrolments.map((e) => { const pr = progress(state, e); return (
              <div key={e.id} className="mt-3"><div className="flex justify-between text-[13.5px]"><span>{pr.prog.name}</span><span className="text-muted">{pr.done.length}/{pr.prog.modules.length}</span></div><div className="mt-1.5 h-1.5 rounded-full bg-page"><div className="h-full rounded-full bg-brand" style={{ width: `${(pr.done.length / pr.prog.modules.length) * 100}%` }} /></div></div>
            ); })}
          </Link>
        )}

        {/* Latest message and resources: links only, they open where they live */}
        {(profile?.pinnedMessage?.url || (profile?.resources ?? []).length > 0) && (
          <div className="card p-5 sm:col-span-2">
            {profile?.pinnedMessage?.url && (
              <a href={profile.pinnedMessage.url} target="_blank" rel="noreferrer" className="hero group flex items-center gap-4 rounded-2xl p-4 text-white">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><Film size={20} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[11.5px] uppercase tracking-wider text-white/65">Latest message</span><b className="block truncate font-display text-[16px] font-semibold">{profile.pinnedMessage.title || "Watch"}</b></span>
                <ExternalLink size={16} className="shrink-0 opacity-75" />
              </a>
            )}
            {(profile?.resources ?? []).length > 0 && (
              <ul className={cx("grid grid-cols-2 gap-2 sm:grid-cols-3", profile?.pinnedMessage?.url && "mt-3")}>
                {profile!.resources!.map((r) => { const I = RES_ICON[r.kind] ?? ExternalLink; return (
                  <li key={r.id}><a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-xl bg-page px-3 py-2.5 text-[13.5px] ring-1 ring-line hover:ring-brand/40"><I size={16} className="shrink-0 text-brand" /><span className="truncate">{r.title}</span></a></li>
                ); })}
              </ul>
            )}
          </div>
        )}

        {/* Prayer and support */}
        <Link href="/prayer" className="card card-hover flex items-start gap-4 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><HandHeart size={20} /></span>
          <span><b className="block font-display text-[16px] font-semibold">Prayer</b><span className="text-[13.5px] text-ink-soft">{prayers.length ? `${prayers.filter((p) => p.prayed.length).length} of your ${prayers.length} requests prayed for` : "Share a request with your pastors."}</span></span>
        </Link>
        <Link href="/welfare" className="card card-hover flex items-start gap-4 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-glow-soft text-glow-ink"><HeartHandshake size={20} /></span>
          <span><b className="block font-display text-[16px] font-semibold">Need support?</b><span className="text-[13.5px] text-ink-soft">Ask privately. Only the {w.welfare} head and the pastors see it.</span></span>
        </Link>

        {/* Events */}
        {events.map((e) => {
          const reg = myRegs.some((r) => r.eventId === e.id);
          return (
            <Link key={e.id} href={`/events/${e.id}`} className="card card-hover overflow-hidden">
              <div className="p-5 text-white" style={{ background: COVERS[e.cover % COVERS.length] }}>
                <p className="text-[12px] uppercase tracking-wider text-white/75">{eventWhen(e)}</p>
                <p className="mt-3 font-display text-xl font-semibold leading-tight">{e.title}</p>
              </div>
              <p className="flex items-center justify-between px-5 py-3 text-[13.5px]"><span className="text-ink-soft">{reg ? "You're registered" : "Register in a tap"}</span><ArrowRight size={15} className="text-brand" /></p>
            </Link>
          );
        })}

        {news.length > 0 && (
          <div className="card p-5 sm:col-span-2">
            <p className="font-display text-[16px] font-semibold">From the church</p>
            <ul className="mt-3 space-y-2.5">{news.map((a) => <li key={a.id} className="rounded-2xl bg-page p-3.5"><p className="font-medium">{a.title}</p><p className="mt-0.5 line-clamp-2 text-[13.5px] text-ink-soft">{a.body}</p><p className="mt-1 text-[12px] text-muted">{shortDate(a.at.slice(0, 10))}</p></li>)}</ul>
          </div>
        )}

        {dots.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between"><p className="font-display text-[16px] font-semibold">Your Sundays</p><span className="text-[13px] text-muted">{dots.filter((d) => d.came).length} of {dots.length}</span></div>
            <div className="mt-3 flex gap-1">{dots.map((d) => <span key={d.date} className={cx("h-7 flex-1 rounded-md", d.came ? "bg-brand" : d.away ? "bg-glow-soft" : "bg-page ring-1 ring-line")} title={shortDate(d.date)} />)}</div>
            <Link href={`/people/${me.id}`} className="mt-3 inline-flex text-[13px] font-medium text-brand">Travelling? Tell us you&apos;ll be away</Link>
          </div>
        )}

        <Link href={`/people/${me.id}`} className="card card-hover p-5">
          <p className="font-display text-[16px] font-semibold">You and your family</p>
          <div className="mt-3 flex -space-x-1.5"><span className="rounded-full ring-[2.5px] ring-surface"><Avatar person={me} size={34} /></span>{household.map((h) => <span key={h.id} className="rounded-full ring-[2.5px] ring-surface"><Avatar person={h} size={34} /></span>)}</div>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">Update your details <ArrowRight size={14} /></span>
        </Link>
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

      <Sheet open={asking} onClose={() => setAsking(false)} title={`Join a ${w.department.toLowerCase()}`} footer={
        <div className="space-y-2">{err && <p className="text-sm text-alert" role="alert">{err}</p>}
          <Button variant="primary" className="w-full py-3" onClick={() => { if (!dept) return setErr(`Choose a ${w.department.toLowerCase()}.`); requestPlacement(dept, note.trim() || undefined); setAsking(false); }}>Send request</Button></div>
      }>
        <div className="space-y-4">
          <div className="grid gap-2">
            {state.groups.filter((g) => g.kind === "department" && !g.tags?.includes("children")).map((g) => {
              const need = g.requiresClassId ? state.programmes.find((p) => p.id === g.requiresClassId) : undefined;
              return (
                <button type="button" key={g.id} onClick={() => { setDept(g.id); setErr(""); }}
                  className={cx("rounded-2xl px-4 py-3 text-left ring-1", dept === g.id ? "bg-brand-soft ring-brand" : "bg-surface ring-line hover:ring-ink/20")}>
                  <span className="block font-medium">{g.name}</span>
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
