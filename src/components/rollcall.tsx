"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarCheck, Check, ClipboardCheck, MonitorPlay, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Button, Sheet, cx, toast } from "./ui";
import { fullName, timeOf } from "@/lib/format";
import { record } from "@/lib/domain";
import type { Access } from "@/lib/access";
import type { SeedState } from "@/lib/seed";
import type { Attendance, Meeting, Person } from "@/lib/types";

export type Mark = NonNullable<Attendance["status"]>;
/** "leaders" is the admin's roll call of leaders and pastors; anything else is a department or unit id. */
export type RollKey = string;
const HOURS_AFTER = 12;

/** Roll call opens 30 minutes before a service and stays open until 12 hours after it ends. */
export const rollCallOpen = (m: Meeting, now = Date.now()) => now >= Date.parse(m.start) - 30 * 6e4 && now <= Date.parse(m.end) + HOURS_AFTER * 36e5;
export const rollCallMeetings = (s: SeedState, now = Date.now()) =>
  s.meetings.filter((m) => m.kind !== "class" && rollCallOpen(m, now)).sort((a, b) => a.start.localeCompare(b.start));

/** Who is on the list: a department's people (with its units), one unit, or all leaders and pastors. */
export function rollPeople(s: SeedState, key: RollKey): Person[] {
  const live = (ids: string[]) => [...new Set(ids)].map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p && !p.inactive);
  if (key === "leaders") {
    const pastorRoles = new Set(s.roles.filter((r) => r.key === "lead" || r.key === "pastor").map((r) => r.id));
    const pastoral = new Set(s.assignments.filter((a) => !a.pending && pastorRoles.has(a.roleId)).map((a) => a.personId));
    const heads = s.groups.flatMap((g) => g.leaderIds);
    const leaders = s.people.filter((p) => p.stage === "leader").map((p) => p.id);
    return live([...pastoral, ...heads, ...leaders]).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }
  const g = s.groups.find((x) => x.id === key);
  if (!g) return [];
  const units = g.kind === "department" ? s.groups.filter((u) => u.parentId === g.id) : [];
  return live([...g.leaderIds, ...g.memberIds, ...units.flatMap((u) => [...u.leaderIds, ...u.memberIds])]).sort((a, b) => fullName(a).localeCompare(fullName(b)));
}

/** The roll calls this person takes: departments they head, units with a named lead (them), and the leaders' list for the admin. */
export function myRollCalls(s: SeedState, a: Access, meId: string): { key: RollKey; name: string }[] {
  const out: { key: RollKey; name: string }[] = [];
  // The admin's roll call of leaders and the pastorate; the admin can name someone to take it for them
  if (a.isAdmin || a.can("rollcall.leaders") || (s.church.profile?.leadersRollcallBy ?? []).includes(meId)) out.push({ key: "leaders", name: "Leaders and pastorate" });
  // Department heads and their assistants (with roll call) mark their own workers
  for (const g of s.groups) {
    if (g.leaderIds.includes(meId) || g.assistants?.some((x) => x.personId === meId && x.perms.includes("rollcall"))) out.push({ key: g.id, name: g.name });
  }
  return out;
}

const OPTS: { key: Mark; label: string; on: string }[] = [
  { key: "present", label: "Present", on: "bg-good text-white ring-good" },
  { key: "late", label: "Late", on: "bg-glow text-white ring-glow" },
  { key: "absent", label: "Absent", on: "bg-alert text-white ring-alert" },
  { key: "excused", label: "Excused", on: "bg-deep-2 text-white ring-deep-2" },
];

/**
 * Mark each person Present, Late, Absent or Excused. Someone who checked in stays present (only "late" can be added),
 * and each person counts once per service, however they were recorded.
 */
export function RollCallSheet({ meeting, rollKey, name, onClose }: { meeting: Meeting; rollKey: RollKey; name: string; onClose: () => void }) {
  const { state, me, put, putMany, drop, newId } = useStore();
  const people = useMemo(() => rollPeople(state, rollKey), [state, rollKey]);
  const saved = meeting.rollcalls?.[rollKey];
  const records = state.attendance.filter((a) => a.meetingId === meeting.id);
  const checkedIn = (pid: string) => records.find((a) => a.personId === pid && a.method !== "rollcall");
  const [marks, setMarks] = useState<Record<string, Mark>>(() => {
    const m: Record<string, Mark> = { ...(saved?.marks ?? {}) };
    for (const p of people) if (!m[p.id] && checkedIn(p.id)) m[p.id] = "present";
    return m;
  });
  const [reasons, setReasons] = useState<Record<string, string>>(saved?.reasons ?? {});
  const open = rollCallOpen(meeting);
  const left = people.filter((p) => !marks[p.id]).length;
  const count = (k: Mark) => Object.entries(marks).filter(([pid, v]) => v === k && people.some((p) => p.id === pid)).length;

  const save = () => {
    if (!me) return;
    put("meetings", { ...meeting, rollcalls: { ...(meeting.rollcalls ?? {}), [rollKey]: { byId: me.id, at: new Date().toISOString(), marks, reasons } } }, `took roll call for ${name} at ${meeting.name}`);
    // One attendance record per person: add it for present or late, take back a roll-call one for absent or excused
    const add: Attendance[] = [];
    for (const p of people) {
      const m = marks[p.id]; if (!m) continue;
      const mine = records.find((a) => a.personId === p.id && a.method === "rollcall");
      const came = m === "present" || m === "late";
      if (came && !checkedIn(p.id)) add.push(mine ? { ...mine, status: m } : record(meeting.id, p.id, "rollcall", newId("at"), m));
      if (!came && mine) drop("attendance", mine.id);
    }
    if (add.length) putMany("attendance", add);
    toast(`Roll call saved for ${name}`); onClose();
  };

  return (
    <Sheet open onClose={onClose} title={`Roll call: ${name}`} wide footer={
      <div className="space-y-2">
        <p className="text-center text-[13px] text-muted">{left ? `${left} not marked yet` : "Everyone is marked"}{!open && " · This roll call has closed"}</p>
        <Button variant="primary" className="w-full py-3" disabled={!open || !Object.keys(marks).length} onClick={save}><Check size={16} /> Save roll call</Button>
      </div>}>
      <p className="mb-3 text-[14px] text-ink-soft">{meeting.name}, {timeOf(meeting.start)}. Open until {HOURS_AFTER} hours after it ends.</p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button className="py-2" onClick={() => setMarks(Object.fromEntries(people.map((p) => [p.id, marks[p.id] ?? "present"])))}><Check size={15} /> Everyone else present</Button>
        <span className="text-[13px] text-muted">{count("present")} present · {count("late")} late · {count("absent")} absent · {count("excused")} excused</span>
      </div>
      <ul className="divide-y divide-line">
        {people.map((p) => {
          const ci = checkedIn(p.id);
          return (
            <li key={p.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar person={p} size={36} />
                <span className="min-w-[9rem] flex-1"><span className="block font-medium">{fullName(p)}</span>{ci && <span className="block text-[12.5px] text-good">Checked in {timeOf(ci.at)}</span>}</span>
                <span className="grid w-full grid-cols-4 gap-1 sm:w-auto">
                  {OPTS.map((o) => {
                    const blocked = !!ci && (o.key === "absent" || o.key === "excused");
                    return (
                      <button type="button" key={o.key} disabled={blocked} onClick={() => setMarks({ ...marks, [p.id]: o.key })}
                        className={cx("min-h-10 rounded-lg px-2 text-[13px] font-medium ring-1 transition disabled:opacity-30", marks[p.id] === o.key ? o.on : "bg-page text-ink-soft ring-line")}>{o.label}</button>
                    );
                  })}
                </span>
              </div>
              {marks[p.id] === "excused" && <input className="mt-2 w-full rounded-xl bg-page px-3 py-2 text-[14px] ring-1 ring-line outline-none focus:ring-2 focus:ring-brand" placeholder="Reason (optional)" value={reasons[p.id] ?? ""} onChange={(e) => setReasons({ ...reasons, [p.id]: e.target.value })} />}
            </li>
          );
        })}
        {people.length === 0 && <li className="py-8 text-center text-sm text-muted">Nobody on this list yet.</li>}
      </ul>
    </Sheet>
  );
}

/**
 * "Today's service" on Home, on service days, for anyone with an attendance job:
 * headcount and the check-in screen for ushers and admins, roll call for heads and the admin.
 */
export function TodayService() {
  const { state, access, me } = useStore();
  const [taking, setTaking] = useState<{ m: Meeting; key: RollKey; name: string } | null>(null);
  // Pastors see insights only; the people doing the work see this card
  if (!access || !me || access.isPastoral) return null;
  const now = Date.now();
  const meetings = rollCallMeetings(state, now);
  const heads = access.can("headcount.record");
  const runsCheckin = access.can("checkin.code");
  const counts = heads || runsCheckin;
  const calls = myRollCalls(state, access, me.id);
  if (!meetings.length || (!counts && !calls.length)) return null;
  const m = meetings.find((x) => Date.parse(x.end) >= now) ?? meetings[meetings.length - 1];
  const ended = Date.parse(m.end) < now;
  const came = new Set(state.attendance.filter((a) => a.meetingId === m.id && (!a.status || a.status === "present" || a.status === "late")).map((a) => a.personId)).size;
  return (
    <section className="card overflow-hidden p-0 ring-2 ring-brand/30">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white"><CalendarCheck size={19} /></span>
        <span className="min-w-0 flex-1"><b className="block font-display text-[17px] font-semibold">Today&apos;s service</b><span className="text-[13.5px] text-ink-soft">{m.name}, {timeOf(m.start)}{ended ? ` · ${came} came` : ""}</span></span>
        {meetings.length > 1 && <span className="text-[12.5px] text-muted">{meetings.length} services</span>}
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-3">
        {heads && <Link href="/attendance" className="flex min-h-14 items-center gap-3 rounded-2xl bg-page px-4 ring-1 ring-line hover:ring-brand/40"><Users size={19} className="text-brand" /><span className="font-medium">Headcount</span></Link>}
        {runsCheckin && <Link href="/display/checkin" className="flex min-h-14 items-center gap-3 rounded-2xl bg-page px-4 ring-1 ring-line hover:ring-brand/40"><MonitorPlay size={19} className="text-brand" /><span className="font-medium">Check-in screen</span></Link>}
        {calls.map((c) => {
          const done = !!m.rollcalls?.[c.key];
          return (
            <button type="button" key={c.key} onClick={() => setTaking({ m, key: c.key, name: c.name })} className={cx("flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left ring-1", done ? "bg-good-soft ring-good/25" : "bg-page ring-line hover:ring-brand/40")}>
              <ClipboardCheck size={19} className={done ? "text-good" : "text-brand"} />
              <span className="min-w-0 flex-1"><span className="block font-medium">Roll call</span><span className="block truncate text-[12.5px] text-muted">{c.name}{done ? " · done" : ""}</span></span>
            </button>
          );
        })}
      </div>
      {counts && <p className="border-t border-line px-5 py-2.5 text-[12.5px] text-muted">Check-in opens by itself 30 minutes before. More options are on the <Link href="/attendance" className="font-medium text-brand">Attendance</Link> page.</p>}
      {taking && <RollCallSheet meeting={taking.m} rollKey={taking.key} name={taking.name} onClose={() => setTaking(null)} />}
    </section>
  );
}
