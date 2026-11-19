"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Button, Confetti, Field, Sheet, cx, inputCls, toast } from "./ui";
import { autoPick } from "@/lib/metrics";
import { fullName } from "@/lib/format";
import type { SeedState } from "@/lib/seed";
import type { ExtraFollowers, OutreachContact, Person } from "@/lib/types";

const digits = (s: string) => s.replace(/\D/g, "").replace(/^234/, "0");

/** Someone already in Traqi with the same phone number. */
export const knownAs = (s: SeedState, phone: string): Person | undefined => { const d = digits(phone); return d.length >= 10 ? s.people.find((p) => digits(p.phone) === d) : undefined; };
/** They came to church after we met them: someone with their number whose first visit was on or after that day. */
export const cameToChurch = (s: SeedState, c: OutreachContact) => { const p = knownAs(s, c.phone); return p && p.firstVisit >= c.at.slice(0, 10) ? p : undefined; };

/**
 * "I met someone": 20 seconds for anyone in the church. Name, phone, area and a note,
 * tagged to an outreach when they came from its link, and only with the person's agreement.
 */
export function MetSomeone({ open, onClose, outreachId, challengeId }: { open: boolean; onClose: () => void; outreachId?: string; challengeId?: string }) {
  const { state, me, put, newId } = useStore();
  const [f, setF] = useState({ name: "", phone: "", area: "", note: "", outreach: outreachId ?? "" });
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const outreaches = state.outreaches.filter((o) => Date.now() - Date.parse(`${o.date}T23:59:00+01:00`) < 14 * 864e5);
  const reset = () => { setF({ name: "", phone: "", area: "", note: "", outreach: f.outreach }); setOk(false); setErr(""); setDone(null); };
  const close = () => { reset(); onClose(); };
  const save = () => {
    if (!me) return;
    if (f.name.trim().length < 2) return setErr("Enter their name.");
    if (digits(f.phone).length < 10) return setErr("Enter a phone number with at least 10 digits.");
    if (!ok) return setErr("Ask if the church may contact them, then tick the box.");
    // The same number added again is one person, not two
    const again = state.outreachContacts.find((c) => digits(c.phone) === digits(f.phone));
    if (again) {
      put("outreachContacts", { ...again, note: [again.note, f.note.trim() && `${me.firstName}: ${f.note.trim()}`].filter(Boolean).join("\n") || undefined }, `added a note for ${again.name}`);
    } else {
      // Assigned at once to the Follow-up department (plus whoever the outreach or challenge added)
      const extra = (f.outreach ? state.outreaches.find((o) => o.id === f.outreach)?.extraFollowers : undefined) ?? (challengeId ? state.challenges.find((c) => c.id === challengeId)?.extraFollowers : undefined);
      const pick = autoPick(state, { id: "new", firstName: f.name, lastName: "", gender: undefined, location: f.area.trim() || undefined } as unknown as Person, contactPool(state, extra));
      put("outreachContacts", { id: newId("oc"), name: f.name.trim(), phone: f.phone.trim(), area: f.area.trim() || undefined, note: f.note.trim() || undefined, outreachId: f.outreach || undefined, challengeId, byId: me.id, at: new Date().toISOString(), consent: true, status: "new", assigneeId: pick?.id }, `added ${f.name.trim()}, met${f.outreach ? ` at ${state.outreaches.find((o) => o.id === f.outreach)?.name}` : challengeId ? ` in ${state.challenges.find((c) => c.id === challengeId)?.name}` : " personally"}`);
    }
    setDone(f.name.trim().split(" ")[0]);
  };
  return (
    <Sheet open={open} onClose={close} title={done ? "Thank you!" : "I met someone"} footer={done ? (
      <div className="flex gap-2"><Button className="flex-1 py-3" onClick={close}>Done</Button><Button variant="primary" className="flex-1 py-3" onClick={reset}><UserPlus size={16} /> Add another</Button></div>
    ) : (
      <div className="space-y-2">{err && <p className="text-sm text-alert" role="alert">{err}</p>}<Button variant="primary" className="w-full py-3" onClick={save}>Save</Button></div>
    )}>
      {done ? (
        <div className="rise py-6 text-center">
          <Confetti show />
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-good-soft text-good"><Check size={26} /></span>
          <p className="mt-4 font-display text-xl font-semibold">{done} is on the list</p>
          <p className="mt-1 text-[14.5px] text-ink-soft">The follow-up team will reach out. Thank you for sharing the love of God.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[14px] text-ink-soft">Met someone at an outreach, at work or on the street? Add them and the follow-up team will reach out.</p>
          <Field label="Their name"><input autoFocus className={inputCls} value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setErr(""); }} placeholder="Chukwuemeka Obi" /></Field>
          <Field label="Phone number"><input className={inputCls} inputMode="tel" value={f.phone} onChange={(e) => { setF({ ...f, phone: e.target.value }); setErr(""); }} placeholder="0803 123 4567" /></Field>
          <Field label="Area (optional)"><input className={inputCls} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Ojota" /></Field>
          {!challengeId && outreaches.length > 0 && (
            <Field label="Where did you meet them?">
              <select className={inputCls} value={f.outreach} onChange={(e) => setF({ ...f, outreach: e.target.value })}>
                <option value="">On my own (not at an outreach)</option>
                {outreaches.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="A short note (optional)"><textarea className={cx(inputCls, "min-h-20")} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Prayed with him at the bus stop. Wants to visit with his wife." /></Field>
          <label className="flex gap-3 rounded-xl bg-page p-3 text-[13.5px] text-ink-soft ring-1 ring-line">
            <input type="checkbox" checked={ok} onChange={(e) => { setOk(e.target.checked); setErr(""); }} className="mt-0.5 size-5 shrink-0 accent-brand" />
            They&apos;re happy for {state.church.name} to contact them.
          </label>
        </div>
      )}
    </Sheet>
  );
}

/** A button anyone can tap to add someone they met. */
export function MetSomeoneButton({ className, outreachId, challengeId, label }: { className?: string; outreachId?: string; challengeId?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[13.5px] font-medium ring-1 ring-line hover:ring-brand/40"}><UserPlus size={className ? 17 : 15} className={className ? undefined : "text-brand"} /> {label ?? "I met someone"}</button>
      <MetSomeone open={open} onClose={() => { setOpen(false); }} outreachId={outreachId} challengeId={challengeId} />
    </>
  );
}


/** Who follows up people met at outreaches and challenges: the Follow-up department, plus any extras chosen when it was set up. */
export function contactPool(s: SeedState, extra?: ExtraFollowers): string[] {
  const fu = s.groups.filter((g) => g.tags?.includes("followup")).flatMap((g) => [...g.leaderIds, ...g.memberIds]);
  const leaders = extra?.leaders ? [...s.groups.flatMap((g) => g.leaderIds), ...s.people.filter((p) => p.stage === "leader").map((p) => p.id)] : [];
  const depts = (extra?.groupIds ?? []).flatMap((id) => { const g = s.groups.find((x) => x.id === id); const units = s.groups.filter((u) => u.parentId === id); return g ? [...g.leaderIds, ...g.memberIds, ...units.flatMap((u) => u.memberIds)] : []; });
  return [...new Set([...fu, ...leaders, ...depts])];
}

/** One tap to have more people follow up: all leaders, or whole departments. */
export function ExtraFollowersPicker({ value, onChange }: { value: ExtraFollowers; onChange: (v: ExtraFollowers) => void }) {
  const { state } = useStore();
  const depts = state.groups.filter((g) => g.kind === "department" && !g.tags?.includes("followup"));
  const ids = value.groupIds ?? [];
  return (
    <div>
      <span className="mb-1 block text-sm font-medium">Who else follows up the people met?</span>
      <p className="mb-2 text-[12.5px] text-muted">The Follow-up department always does. Add more with one tap.</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange({ ...value, leaders: !value.leaders })} className={cx("min-h-10 rounded-full px-3.5 text-[13.5px] ring-1", value.leaders ? "bg-brand text-white ring-brand" : "bg-surface ring-line")}>All leaders</button>
        {depts.map((g) => { const on = ids.includes(g.id); return (
          <button type="button" key={g.id} onClick={() => onChange({ ...value, groupIds: on ? ids.filter((x) => x !== g.id) : [...ids, g.id] })} className={cx("min-h-10 rounded-full px-3.5 text-[13.5px] ring-1", on ? "bg-brand text-white ring-brand" : "bg-surface ring-line")}>{g.name}</button>
        ); })}
      </div>
    </div>
  );
}

/** Who met and documented the most people. Staff see everyone; participants see the top 10 and their own place. */
export function Leaderboard({ contacts, ids, compact }: { contacts: OutreachContact[]; ids?: string[]; compact?: boolean }) {
  const { state, me } = useStore();
  const counts = new Map<string, number>();
  for (const id of ids ?? []) counts.set(id, 0);
  for (const c of contacts) counts.set(c.byId, (counts.get(c.byId) ?? 0) + 1);
  const rows = [...counts.entries()].map(([id, n]) => ({ p: state.people.find((x) => x.id === id), n })).filter((r) => r.p).sort((a, b) => b.n - a.n || a.p!.firstName.localeCompare(b.p!.firstName));
  const max = Math.max(1, ...rows.map((r) => r.n));
  const myAt = rows.findIndex((r) => r.p!.id === me?.id);
  const shown = compact ? rows.slice(0, 10) : rows;
  if (!rows.length) return <p className="text-sm text-muted">Nobody has added anyone yet.</p>;
  const Row = ({ r, i }: { r: (typeof rows)[number]; i: number }) => (
    <li className={cx("flex items-center gap-3 rounded-xl px-2 py-2", r.p!.id === me?.id && "bg-brand-soft")}>
      <span className={cx("num w-7 text-center text-[15px] font-semibold", i < 3 ? "text-glow-ink" : "text-muted")}>{i + 1}</span>
      <Avatar person={r.p} size={30} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{r.p!.id === me?.id ? "You" : fullName(r.p)}</span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-page"><span className="block h-full rounded-full bg-brand" style={{ width: `${(r.n / max) * 100}%` }} /></span>
      </span>
      <span className="num w-8 text-right font-semibold">{r.n}</span>
    </li>
  );
  return (
    <ol className="space-y-0.5">
      {shown.map((r, i) => <Row key={r.p!.id} r={r} i={i} />)}
      {compact && myAt >= 10 && <><li className="py-1 text-center text-muted">…</li><Row r={rows[myAt]} i={myAt} /></>}
    </ol>
  );
}
