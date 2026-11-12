"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Cake, CheckCircle2, Clock, Handshake, MoonStar, PartyPopper, Sprout, TrendingDown, TrendingUp, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Button, Sheet, cx } from "@/components/ui";
import { ReachOut, messages } from "@/components/care";
import { MeetingLink, PastorBoard } from "@/components/pastor-board";
import { MemberHome } from "@/components/member-home";
import { daysToBirthday, fullName, greeting, hoursSince, shortDate, todayLong } from "@/lib/format";
import type { Person } from "@/lib/types";
import { attendance, cameBack, escalation, goneQuiet } from "@/lib/metrics";

type Row = { person: Person; note: string; message?: string; assign?: boolean; placement?: string };
type Action = { key: string; icon: typeof Clock; tone: "alert" | "glow" | "brand"; n: number; title: string; body: string; cta: string; rows: Row[]; href?: string };

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Today() {
  const { me, access, state, person, resolvePlacement } = useStore();
  const [open, setOpen] = useState<string | null>(null);

  const d = useMemo(() => {
    if (!me || !access) return null;
    const church = state.church.name;
    const seeAll = access.can("followup.assign");
    const cases = state.cases.filter((c) => (seeAll && access.seesCase(c)) || c.assigneeId === me.id);
    const fresh = cases.filter((c) => c.stage === "new");
    const overdue = fresh.filter((c) => c.assigneeId && hoursSince(c.createdAt) > 48);
    const waiting = fresh.filter((c) => !c.assigneeId);
    const dueSoon = fresh.filter((c) => c.assigneeId && hoursSince(c.createdAt) <= 48);
    const mineToCall = fresh.filter((c) => c.assigneeId === me.id && hoursSince(c.createdAt) <= 48);
    const myContacts = state.cases.flatMap((c) => c.contacts).filter((x) => x.byId === me.id && hoursSince(x.at) <= 24 * 30).length;

    const scope = access.can("people.view") ? access.visiblePeople().filter((p) => !p.isChild && p.id !== me.id) : [];
    const quiet = goneQuiet(scope);
    const bdays = scope.filter((p) => { const x = daysToBirthday(p.birthday); return x !== null && x <= 6; })
      .sort((a, b) => daysToBirthday(a.birthday)! - daysToBirthday(b.birthday)!);

    const caseRow = (c: (typeof cases)[number], note: string): Row => {
      const p = person(c.personId)!;
      return { person: p, note, message: messages.welcome(p, church), assign: !c.assigneeId };
    };

    const actions: Action[] = [];
    if (overdue.length) actions.push({
      key: "overdue", icon: Clock, tone: "alert", n: overdue.length, title: "Past the 48-hour mark",
      body: seeAll ? "First-timers no one has reached yet." : "Assigned to you. Please reach them today.", cta: seeAll ? "See who" : "Call now", rows: overdue.map((c) => { const e = escalation(state, c); return caseRow(c, `${c.assigneeId === me.id ? "Yours" : fullName(person(c.assigneeId))} · ${Math.floor(hoursSince(c.createdAt) / 24)} days${e.label ? ` · ${e.label}` : ""}`); }),
    });
    if (waiting.length) actions.push({
      key: "waiting", icon: UserPlus, tone: "glow", n: waiting.length, title: "Waiting to be assigned",
      body: "New first-timers with no one to call them.", cta: "Assign now", href: "/first-timers", rows: [],
    });
    if (!seeAll && mineToCall.length) actions.push({
      key: "mine", icon: Sprout, tone: "brand", n: mineToCall.length, title: mineToCall.length === 1 ? "Person to call" : "People to call",
      body: "Assigned to you. One tap to call or WhatsApp.", cta: "Start calling", rows: mineToCall.map((c) => caseRow(c, `First visit ${shortDate(person(c.personId)?.firstVisit)}`)),
    });
    const openPlacements = access.handlesPlacement ? state.placements.filter((x) => x.status === "open") : [];
    if (openPlacements.length) actions.push({
      key: "place", icon: Handshake, tone: "brand", n: openPlacements.length, title: openPlacements.length === 1 ? "Wants to serve" : "Want to serve",
      body: "Members asking to join a department.", cta: "Review",
      rows: openPlacements.map((pl) => ({ person: person(pl.personId)!, note: `${state.groups.find((g) => g.id === pl.groupId)?.name}${pl.note ? ` · “${pl.note}”` : ""}`, placement: pl.id })).filter((r) => r.person),
    });
    if (bdays.length) actions.push({
      key: "bdays", icon: Cake, tone: "brand", n: bdays.length, title: bdays.length === 1 ? "Birthday this week" : "Birthdays this week",
      body: bdays[0] && daysToBirthday(bdays[0].birthday) === 0 ? `${bdays[0].firstName} celebrates today.` : "Send a word of blessing.", cta: "Send wishes",
      rows: bdays.map((p) => { const x = daysToBirthday(p.birthday)!; return { person: p, note: x === 0 ? "Today" : x === 1 ? "Tomorrow" : WEEKDAY[(new Date().getDay() + x) % 7], message: messages.birthday(p, church) }; }),
    });
    if (quiet.length && actions.length < 3) actions.push({
      key: "quiet", icon: MoonStar, tone: "glow", n: quiet.length, title: "Gone quiet",
      body: "Missed three or more Sundays.", cta: "Check in",
      rows: quiet.map((p) => ({ person: p, note: `Missed ${p.missedInARow} Sundays · last seen ${shortDate(p.lastSeen)}`, message: messages.absent(p, church) })),
    });

    const att = attendance(state);
    const back = cameBack(state);
    const month = state.cases.filter((c) => hoursSince(c.createdAt) <= 24 * 28).length;
    return { actions: actions.slice(0, 3), myContacts, quiet, overdue, dueSoon, mineToCall, scope, att, back, month };
  }, [me, access, state, person]);

  if (!me || !access || !d) return null;
  if (access.isMemberOnly) return <MemberHome />;

  const pastoral = access.isPastoral || access.can("followup.assign") || access.isLead;
  const title = access.isPastoral ? `Pastor ${me.firstName}` : me.firstName;
  const sheet = d.actions.find((a) => a.key === open);

  const stats: { n: ReactNode; label: string; sub?: ReactNode; href: string }[] = pastoral ? [
    d.att.series.length
      ? { n: d.att.last, label: d.att.goal ? `at church last Sunday, of ${d.att.goal} goal` : "at church last Sunday", sub: d.att.isBest ? <span className="text-[#7ee2b8]">Best in 8 weeks</span> : <Trend v={d.att.vsAvg} />, href: "/attendance" }
      : { n: "—", label: "at church last Sunday", sub: <span>Record your first service</span>, href: "/attendance" },
    { n: d.month, label: "first-timers in 4 weeks", sub: <span>{d.back.of ? `${d.back.pct}% of earlier ones came back` : "Return rate shows after 2 weeks"}</span>, href: "/first-timers" },
    { n: d.overdue.length + d.dueSoon.length, label: "waiting for a call", sub: <span>{d.overdue.length} overdue</span>, href: "/first-timers" },
    { n: d.quiet.length, label: "have gone quiet", sub: <span>of those who check in</span>, href: "/people" },
  ] : access.can("people.view") ? [
    { n: d.scope.length, label: "people in your care", sub: <span>across your departments</span>, href: "/departments" },
    { n: d.quiet.length, label: "have gone quiet", sub: <span>3+ Sundays missed</span>, href: "/departments" },
    { n: d.myContacts, label: "people you reached", sub: <span>in the last 30 days</span>, href: "/first-timers" },
  ] : [
    { n: d.mineToCall.length + d.overdue.length, label: "people for you to call", sub: <span>{d.overdue.length} past 48 hours</span>, href: "/first-timers" },
    { n: d.myContacts, label: "people you reached", sub: <span>in the last 30 days</span>, href: "/first-timers" },
  ];

  const headline = d.actions.length === 0
    ? "Everyone in your care is looked after. Lovely."
    : `${d.actions.length === 1 ? "One thing" : `${d.actions.length} things`} need${d.actions.length === 1 ? "s" : ""} you today.`;

  return (
    <div className="mx-auto max-w-5xl">
      {/* The summary: everything a leader needs at a glance */}
      <section className="rise relative overflow-hidden rounded-[28px] bg-deep px-6 pb-6 pt-7 text-white md:px-9 md:pb-8 md:pt-9">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full bg-brand/50 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/3 size-[360px] rounded-full bg-j4/30 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3"><p className="text-[14px] text-white/60">{todayLong()}</p>{pastoral && <MeetingLink />}</div>
          <h1 className="mt-1 font-display text-[30px] font-semibold leading-tight tracking-tight md:text-[42px]">{greeting()}, {title}.</h1>
          <p className="mt-1.5 text-[16px] text-white/75 md:text-[18px]">{headline}</p>

          <div className={cx("mt-7 grid gap-2.5", stats.length === 4 ? "grid-cols-2 md:grid-cols-4" : stats.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2")}>
            {stats.map((s) => (
              <Link key={s.label} href={s.href} className="group rounded-2xl bg-white/[.07] p-4 ring-1 ring-white/10 transition hover:bg-white/[.12]">
                <p className="num text-[34px] font-semibold leading-none md:text-[40px]">{s.n}</p>
                <p className="mt-2 text-[13.5px] leading-snug text-white/80">{s.label}</p>
                {s.sub && <p className="mt-1 text-[12px] text-white/50">{s.sub}</p>}
              </Link>
            ))}
          </div>

          {pastoral && d.att.series.length > 2 && <Spark values={d.att.series} />}
        </div>
      </section>

      {/* At most three things to do */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-[19px] font-semibold tracking-tight">Needs you today</h2>
        {d.actions.length === 0 ? (
          <div className="rise flex items-center gap-4 rounded-3xl bg-good-soft p-6 text-good">
            <PartyPopper size={28} />
            <div><p className="font-display text-lg font-semibold">You&apos;re all caught up</p><p className="text-sm">No first-timer is waiting and no birthday is missed.</p></div>
          </div>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-3 md:gap-3">
            {d.actions.map((a, i) => {
              const Icon = a.icon;
              const tone = { alert: "bg-alert-soft text-alert", glow: "bg-glow-soft text-glow-ink", brand: "bg-brand-soft text-brand" }[a.tone];
              const inner = (
                <>
                  {/* Phones: one compact row. Wider screens: a card. */}
                  <div className="flex items-center gap-3.5 md:items-start md:justify-between">
                    <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-2xl", tone)}><Icon size={21} /></span>
                    <span className="min-w-0 flex-1 md:hidden"><span className="block truncate font-display text-[16px] font-semibold">{a.title}</span><span className="text-[13px] font-semibold text-brand">{a.cta}</span></span>
                    <span className="num text-[30px] font-semibold leading-none md:text-[38px]">{a.n}</span>
                  </div>
                  <p className="mt-5 hidden font-display text-[17px] font-semibold leading-snug md:block">{a.title}</p>
                  <p className="mt-1 hidden text-[14px] text-ink-soft md:block">{a.body}</p>
                  <span className="mt-5 hidden items-center gap-1.5 text-[14px] font-semibold text-brand md:inline-flex">{a.cta} <ArrowRight size={15} className="transition group-hover:translate-x-0.5" /></span>
                </>
              );
              const cls = "rise group flex flex-col rounded-3xl bg-surface p-4 md:p-5 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/[.07] hover:ring-brand/30";
              return a.href
                ? <Link key={a.key} href={a.href} className={cls} style={{ animationDelay: `${i * 60}ms` }}>{inner}</Link>
                : <button key={a.key} onClick={() => setOpen(a.key)} className={cls} style={{ animationDelay: `${i * 60}ms` }}>{inner}</button>;
            })}
          </div>
        )}
      </section>

      {access.isPastoral && state.people.length >= 10 && <PastorBoard />}
      {access.isLead && state.people.length < 10 && <GettingStarted />}

      <Sheet open={!!sheet} onClose={() => setOpen(null)} title={sheet ? `${sheet.n} · ${sheet.title}` : ""}>
        {sheet && (
          <ul className="-mx-1 divide-y divide-line">
            {sheet.rows.map((r) => (
              <li key={r.person.id} className="flex items-center gap-3 px-1 py-3">
                <Link href={`/people/${r.person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar person={r.person} size={40} />
                  <span className="min-w-0"><span className="block truncate font-medium">{fullName(r.person)}</span><span className="block truncate text-[13px] text-muted">{r.note}</span></span>
                </Link>
                {r.placement ? (
                  <span className="flex shrink-0 gap-1.5">
                    <Button onClick={() => resolvePlacement(r.placement!, false)}>Not now</Button>
                    <Button variant="primary" onClick={() => resolvePlacement(r.placement!, true)}>Place</Button>
                  </span>
                ) : r.message && <ReachOut person={r.person} compact message={r.message} canContact={access.canSeeContacts(r.person)} />}
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}

function Trend({ v }: { v: number }) {
  const Icon = v >= 0 ? TrendingUp : TrendingDown;
  return <span className={cx("inline-flex items-center gap-1", v >= 0 ? "text-[#7ee2b8]" : "text-[#ff9fb2]")}><Icon size={13} />{v >= 0 ? "+" : ""}{v}% on the 4-week average</span>;
}

/** Eight Sundays as a soft line, so growth reads in one look. */
function Spark({ values }: { values: number[] }) {
  const w = 600, h = 56, min = Math.min(...values) * 0.92, max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / (max - min)) * h] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <div className="mt-6 flex items-end gap-4">
      <svg viewBox={`0 0 ${w} ${h + 4}`} className="h-12 flex-1" preserveAspectRatio="none" role="img" aria-label="Sunday attendance over eight weeks">
        <path d={`${line} L${w} ${h + 4} L0 ${h + 4}Z`} fill="url(#sg)" />
        <path d={line} fill="none" style={{ stroke: "var(--color-j3)" }} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        <defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: "var(--color-j4)" }} stopOpacity=".35" /><stop offset="1" style={{ stopColor: "var(--color-j4)" }} stopOpacity="0" /></linearGradient></defs>
      </svg>
      <span className="shrink-0 pb-1 text-[12px] text-white/50">8 Sundays</span>
    </div>
  );
}

/** For a church that has just signed up: the few steps that make Traqi useful. */
function GettingStarted() {
  const { state } = useStore();
  const steps = [
    { done: state.people.length > 1, title: "Bring in your people", body: "Import your Excel member list, or share the update-details link.", href: "/people/import", cta: "Import" },
    { done: state.assignments.some((a) => state.roles.find((r) => r.id === a.roleId)?.key === "pastor"), title: "Add your pastors and admin", body: "Give each pastor the departments they oversee.", href: "/settings/roles", cta: "Set roles" },
    { done: state.groups.some((g) => g.leaderIds.length > 0), title: "Name your department heads", body: "Open each department and choose its head.", href: "/departments", cta: "Departments" },
    { done: state.cases.length > 0, title: "Welcome first-timers on Sunday", body: "Show the welcome QR code on screen during service.", href: "/display/welcome", cta: "Show QR" },
  ];
  const n = steps.filter((x) => x.done).length;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[19px] font-semibold tracking-tight">Get {state.church.name} set up</h2>
        <span className="text-sm text-muted">{n} of {steps.length} done</span>
      </div>
      <ol className="space-y-2">
        {steps.map((x, i) => (
          <li key={x.title} className={cx("flex items-center gap-4 rounded-3xl bg-surface p-4 ring-1 ring-line", x.done && "opacity-60")}>
            <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold", x.done ? "bg-good text-white" : "bg-brand-soft text-brand")}>
              {x.done ? <CheckCircle2 size={18} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1"><span className="block font-medium">{x.title}</span><span className="block text-[13.5px] text-ink-soft">{x.body}</span></span>
            {!x.done && <Link href={x.href} className="inline-flex h-11 shrink-0 items-center rounded-xl bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover">{x.cta}</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}

