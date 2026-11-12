"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Building2, MessageSquareHeart, Sparkles, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { ownerStats, setChurchVerified } from "@/lib/live";
import { Badge, Button, CountUp, Empty, Panel, Sheet, toast } from "@/components/ui";
import { LogoMark } from "@/components/brand";
import { Sparkline } from "@/components/charts";
import { ago, shortDate } from "@/lib/format";

type ChurchRow = { id: string; name: string; country: string; created_at: string; verified?: boolean; address?: string; directions?: string; city?: string; photo?: string; pin?: { lat: number; lng: number }; level?: string; people: number; members: number; staff: number; active_week: number; last_active?: string; checkins: number; followups: number; classes: number; events: number; messages: number };
type Stats = { churches: ChurchRow[]; feedback: { church: string; text: string; screen: string; at: string }[] };

/** For the Traqi team: how churches are using the product. Totals only, never anyone's personal details. */
export default function Owner() {
  const { mode, state } = useStore();
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<ChurchRow | null>(null);
  useEffect(() => {
    if (mode === "live") { ownerStats().then((d) => setData(d as unknown as Stats)).catch((e) => setErr(e.message)); return; }
    const now = Date.now(), day = 864e5;
    const real: ChurchRow = { id: "c0", name: state.church.name, country: state.church.country, verified: true, address: state.church.profile?.address, directions: state.church.profile?.directions, city: state.church.profile?.city, created_at: new Date(now - 60 * day).toISOString(), people: state.people.length,
      members: state.people.filter((p) => p.stage !== "first_timer" && !p.isChild).length, staff: new Set(state.assignments.map((a) => a.personId)).size,
      active_week: new Set(state.activity.filter((a) => now - Date.parse(a.at) < 7 * day).map((a) => a.actorId)).size, last_active: state.activity.at(-1)?.at,
      checkins: state.attendance.length, followups: state.cases.flatMap((c) => c.contacts).length, classes: state.programmes.length, events: state.events.length, messages: state.announcements.length };
    const sample = (name: string, country: string, d: number, people: number, active: number, last: number): ChurchRow => ({ id: name, name, country, created_at: new Date(now - d * day).toISOString(), people, members: Math.round(people * 0.7), staff: Math.round(people / 18), active_week: active, last_active: new Date(now - last * day).toISOString(), checkins: people * 6, followups: Math.round(people / 3), classes: 2, events: 1, messages: 4 });
    setData({ churches: [real, sample("Grace Assembly (sample)", "NG", 41, 410, 12, 0), sample("Living Waters (sample)", "GH", 28, 180, 5, 1), sample("Kingdom Life (sample)", "NG", 19, 95, 0, 16), sample("New Dawn Chapel (sample)", "KE", 6, 40, 3, 2)],
      feedback: [...state.appFeedback.map((f) => ({ church: state.church.name, text: f.text, screen: f.screen, at: f.at })), { church: "Grace Assembly (sample)", text: "Can ushers record two services at once?", screen: "/attendance", at: new Date(now - 2 * day).toISOString() }] });
  }, [mode, state]);

  if (err) return <Empty title="Owners only" body="This page is for the Traqi team." icon={<Sparkles size={26} />} />;
  if (!data) return <div className="skeleton h-96 rounded-3xl" />;
  const cs = data.churches;
  const atRisk = cs.filter((c) => !c.last_active || Date.now() - Date.parse(c.last_active) > 14 * 864e5);
  const weeks = Array.from({ length: 10 }, (_, i) => cs.filter((c) => Date.parse(c.created_at) <= Date.now() - (9 - i) * 7 * 864e5).length);
  const totals = { churches: cs.length, people: cs.reduce((n, c) => n + Number(c.people), 0), staff: cs.reduce((n, c) => n + Number(c.staff), 0), active: cs.reduce((n, c) => n + Number(c.active_week), 0) };

  return (
    <div className="mx-auto max-w-6xl">
      <section className="hero mb-6 px-6 pb-6 pt-7 md:px-9 md:pt-9">
        <div className="flex items-center gap-3"><LogoMark size={40} /><div><p className="font-display text-2xl font-semibold">Traqi owner view</p><p className="text-[13px] text-white/60">Totals only. No one&apos;s personal details.{mode === "demo" && " Sample churches shown for the demo."}</p></div></div>
        <div className="mt-7 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[[totals.churches, "churches"], [totals.people, "people recorded"], [totals.staff, "staff using Traqi"], [totals.active, "active this week"]].map(([n, l]) => (
            <div key={l} className="glass rounded-2xl px-4 py-3"><p className="num text-[30px] font-semibold"><CountUp to={Number(n)} /></p><p className="text-[13px] text-white/65">{l}</p></div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Panel title="Churches" action={<span className="flex items-center gap-2 text-brand"><Sparkline values={weeks} width={90} height={28} /><span className="text-[12px] text-muted">10 weeks</span></span>}>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead><tr className="text-left text-[12px] text-muted"><th className="px-2 py-2 font-medium">Church</th><th className="px-2 font-medium">People</th><th className="px-2 font-medium">Staff</th><th className="px-2 font-medium">Active (7d)</th><th className="px-2 font-medium">Check-ins</th><th className="px-2 font-medium">Follow-ups</th><th className="px-2 font-medium">Last seen</th></tr></thead>
              <tbody>{cs.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-2 py-3"><button onClick={() => setOpen(c)} className="flex items-center gap-2 text-left"><span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Building2 size={15} /></span><span><b className="flex items-center gap-1 font-semibold hover:text-brand">{c.name}{c.verified && <BadgeCheck size={14} className="text-brand" />}</b><span className="text-[12px] text-muted">{c.city ?? c.country} · since {shortDate(c.created_at)}</span></span></button></td>
                  <td className="num px-2">{c.people}</td><td className="num px-2">{c.staff}</td>
                  <td className="px-2"><span className="num">{c.active_week}</span></td>
                  <td className="num px-2">{c.checkins}</td><td className="num px-2">{c.followups}</td>
                  <td className="px-2">{atRisk.includes(c) ? <Badge tone="alert">{c.last_active ? ago(c.last_active) : "Never"}</Badge> : <span className="text-muted">{c.last_active ? ago(c.last_active) : ""}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel title={<span className="flex items-center gap-2"><AlertTriangle size={17} className="text-alert" /> At risk</span>}>
            {atRisk.length === 0 ? <p className="text-sm text-good">Every church was active in the last two weeks.</p> : <ul className="space-y-2">{atRisk.map((c) => <li key={c.id} className="rounded-xl bg-alert-soft/60 px-3 py-2 text-[13.5px]"><b className="font-semibold">{c.name}</b><br /><span className="text-muted">No activity for over 14 days</span></li>)}</ul>}
          </Panel>
          <Panel title={<span className="flex items-center gap-2"><MessageSquareHeart size={17} className="text-brand" /> Feedback</span>}>
            {data.feedback.length === 0 ? <p className="text-sm text-muted">No feedback yet.</p> : <ul className="space-y-3">{data.feedback.slice(0, 12).map((f, i) => <li key={i} className="rounded-2xl bg-page p-3"><p className="text-[14px]">“{f.text}”</p><p className="mt-1 text-[12px] text-muted">{f.church} · {f.screen} · {ago(f.at)}</p></li>)}</ul>}
          </Panel>
          <p className="flex items-center gap-2 px-1 text-[12.5px] text-muted"><Users size={14} /> Billing: free during early access.</p>
        </div>
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ""}>
        {open && (
          <div className="space-y-4">
            {open.photo && <img src={open.photo} alt="The church building" className="h-44 w-full rounded-2xl object-cover" />}
            <div className="rounded-2xl bg-page p-4 text-[14px]">
              <p className="font-medium">{open.address ?? "No address"}{open.city ? `, ${open.city}` : ""}</p>
              {open.directions && <p className="mt-1 text-ink-soft">{open.directions}</p>}
              {open.pin && <a className="mt-2 inline-block font-medium text-brand" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${open.pin.lat},${open.pin.lng}`}>Open the map pin</a>}
            </div>
            <p className="text-[13px] text-muted">Check the address and photo look real before giving the tick. Members see it in search.</p>
            <Button variant={open.verified ? "secondary" : "primary"} className="w-full" onClick={async () => {
              const v = !open.verified;
              try { if (mode === "live") await setChurchVerified(open.id, v); setData((d) => d && { ...d, churches: d.churches.map((x) => (x.id === open.id ? { ...x, verified: v } : x)) }); setOpen({ ...open, verified: v }); toast(v ? "Verified" : "Tick removed"); }
              catch (e) { toast(e instanceof Error ? e.message : "Couldn't save"); }
            }}><BadgeCheck size={16} /> {open.verified ? "Remove the verified tick" : "Give the verified tick"}</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
