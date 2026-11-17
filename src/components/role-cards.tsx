"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, ShieldCheck, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { PERMISSION_SAYS, scopeLabel } from "@/lib/access";
import { cx } from "./ui";
import type { PermissionKey } from "@/lib/types";

/** Where each ability takes you, so the card can offer a button straight to it. */
const PLACE: Partial<Record<PermissionKey, { href: string; label: string }>> = {
  "people.view": { href: "/people", label: "People" },
  "followup.assign": { href: "/first-timers", label: "Follow-up" },
  "followup.log": { href: "/first-timers", label: "Follow-up" },
  "attendance.record": { href: "/attendance", label: "Attendance" },
  "groups.manage": { href: "/departments", label: "Your department" },
  "classes.manage": { href: "/classes", label: "Classes" },
  "events.manage": { href: "/events", label: "Events" },
  "finance.view": { href: "/finance", label: "Offerings" },
  "finance.count": { href: "/finance", label: "Offerings" },
  "roles.manage": { href: "/settings", label: "Settings" },
};

const seenKey = (id: string) => `traqi-role-seen-${id}`;

/**
 * "You have a new role": shown on Home once a role takes effect, in plain words,
 * with buttons to the new places. It goes away when they tap Got it.
 */
export function NewRoleCard() {
  const { state, me } = useStore();
  const [seen, setSeen] = useState<string[] | null>(null);
  useEffect(() => { if (me) { try { setSeen(JSON.parse(localStorage.getItem(seenKey(me.id)) || "[]")); } catch { setSeen([]); } } }, [me]);
  if (!me || !seen) return null;
  const fresh = state.assignments.filter((a) => a.personId === me.id && !a.pending && a.givenAt && Date.now() - Date.parse(a.givenAt) < 30 * 864e5 && !seen.includes(`${a.roleId}|${a.givenAt}`));
  if (!fresh.length) return null;
  const a = fresh[0];
  const role = state.roles.find((r) => r.id === a.roleId);
  if (!role) return null;
  const perms = role.permissions.filter((k) => PERMISSION_SAYS[k]);
  const places = [...new Map(perms.map((k) => PLACE[k]).filter((x): x is { href: string; label: string } => !!x).map((x) => [x.href, x])).values()].slice(0, 3);
  const where = scopeLabel(state, a.scope);
  const dismiss = () => { const next = [...seen, `${a.roleId}|${a.givenAt}`]; try { localStorage.setItem(seenKey(me.id), JSON.stringify(next)); } catch { /* storage unavailable */ } setSeen(next); };
  return (
    <section className="rise relative overflow-hidden rounded-3xl bg-brand-soft p-5 ring-1 ring-brand/20">
      <button type="button" onClick={dismiss} className="absolute right-3 top-3 rounded-lg p-2 text-muted hover:bg-surface" aria-label="Close"><X size={16} /></button>
      <div className="flex items-start gap-3.5 pr-8">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white"><BadgeCheck size={21} /></span>
        <div className="min-w-0">
          <p className="font-display text-[18px] font-semibold">You have a new role</p>
          <p className="mt-0.5 text-[14.5px] text-ink-soft">You&apos;re now <b className="font-semibold text-ink">{role.name}</b>{where && where !== "Whole church" ? ` for ${where}` : ""}{a.until ? `, until ${a.until}` : ""}.</p>
        </div>
      </div>
      {perms.length > 0 && (
        <ul className="mt-3 space-y-1 text-[14px] text-ink-soft">{perms.slice(0, 4).map((k) => <li key={k} className="flex gap-2"><span className="text-brand">✓</span>You can {PERMISSION_SAYS[k]}</li>)}</ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {places.map((p) => <Link key={p.href} href={p.href} onClick={dismiss} className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-[14px] font-semibold text-white">Open {p.label}</Link>)}
        <button type="button" onClick={dismiss} className="inline-flex min-h-10 items-center rounded-xl bg-surface px-4 text-[14px] font-medium ring-1 ring-line">Got it</button>
      </div>
    </section>
  );
}

/** For leaders without a team of their own: their titles and their own attendance, so Home still says who they are. */
export function YourRolesCard() {
  const { state, me, access } = useStore();
  if (!me || !access || access.isPastoral || access.leads.size > 0) return null;
  const mine = state.assignments.filter((a) => a.personId === me.id && !a.pending).map((a) => ({ a, r: state.roles.find((r) => r.id === a.roleId) })).filter((x) => x.r && x.r.key !== "member" && x.r.key !== "worker");
  if (!mine.length && me.stage !== "leader") return null;
  const services = state.meetings.filter((m) => (m.kind === "sunday" || m.kind === "midweek") && Date.parse(m.end) < Date.now() && Date.now() - Date.parse(m.end) < 56 * 864e5);
  const came = services.filter((m) => state.attendance.some((x) => x.meetingId === m.id && x.personId === me.id && (!x.status || x.status === "present" || x.status === "late"))).length;
  return (
    <section className="card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><ShieldCheck size={19} /></span>
        <p className="font-display text-[17px] font-semibold">Your roles</p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {me.stage === "leader" && !mine.length && <li className="rounded-full bg-brand-soft px-3 py-1 text-[13px] font-medium text-brand">Leader</li>}
        {mine.map(({ a, r }) => <li key={r!.id} className="rounded-full bg-brand-soft px-3 py-1 text-[13px] font-medium text-brand">{r!.name}<span className="font-normal opacity-80"> · {scopeLabel(state, a.scope)}</span></li>)}
      </ul>
      {services.length > 0 && <p className={cx("mt-3 text-[14px] text-ink-soft")}>You were at <b className="font-semibold text-ink">{came} of the last {services.length}</b> services.</p>}
    </section>
  );
}
