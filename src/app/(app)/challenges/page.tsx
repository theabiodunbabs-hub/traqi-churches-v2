"use client";

import { copyText } from "@/lib/share";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Copy, Plus, Trophy, UserPlus, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Badge, Button, Empty, Field, PageHeader, Sheet, cx, inputCls, toast } from "@/components/ui";
import { WhatsAppIcon } from "@/components/care";
import { QR } from "@/components/public";
import { ExtraFollowersPicker, Leaderboard, MetSomeoneButton, cameToChurch } from "@/components/outreach";
import { fullName, shortDate, todayLagos } from "@/lib/format";
import { addDays } from "@/lib/seed-more";
import type { Challenge, ExtraFollowers } from "@/lib/types";

/** Soul-winning challenges: people join, log who they meet, and see how everyone is doing. */
function Challenges() {
  const { state, access, me, put, newId } = useStore();
  const q = useSearchParams();
  const [open, setOpen] = useState<string | null>(q.get("c") ?? q.get("join"));
  const [making, setMaking] = useState(false);
  if (!access || !me) return null;
  const canCreate = access.isPastoral || access.isAdmin || access.seesAllCases || state.groups.some((g) => (g.tags?.includes("outreach") || g.tags?.includes("followup")) && (g.leaderIds.includes(me.id) || g.assistants?.some((a) => a.personId === me.id)));
  const today = todayLagos();
  const list = [...state.challenges].sort((a, b) => b.start.localeCompare(a.start));
  const c = state.challenges.find((x) => x.id === open);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Soul-winning challenges" sub="Join a challenge, add everyone you meet, and watch the harvest grow."
        actions={canCreate && <Button variant="primary" onClick={() => setMaking(true)}><Plus size={16} /> New challenge</Button>} />
      {list.length === 0 ? <Empty title="No challenges yet" body={canCreate ? "Start one: give it a name, dates and an optional target." : "When the church starts a challenge, it shows here."} icon={<Trophy size={26} />} /> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((x) => {
            const met = state.outreachContacts.filter((k) => k.challengeId === x.id).length;
            const live = x.start <= today && x.end >= today;
            const joined = x.participantIds.includes(me.id);
            return (
              <li key={x.id}>
                <button type="button" onClick={() => setOpen(x.id)} className="card card-hover block w-full p-5 text-left">
                  <span className="flex items-center gap-2"><Trophy size={17} className="text-glow-ink" /><b className="flex-1 truncate font-display text-[17px] font-semibold">{x.name}</b>{live ? <Badge tone="good">On now</Badge> : x.end < today ? <Badge tone="neutral">Ended</Badge> : <Badge tone="brand">Coming</Badge>}</span>
                  <span className="mt-1 block text-[13px] text-muted">{shortDate(x.start)} to {shortDate(x.end)} · {x.participantIds.length} taking part{joined ? " · you're in" : ""}</span>
                  <span className="mt-3 flex items-end justify-between"><span><b className="num text-[28px] font-semibold">{met}</b><span className="text-[13px] text-muted"> met{x.target ? ` of ${x.target}` : ""}</span></span></span>
                  {x.target ? <span className="mt-2 block h-2 overflow-hidden rounded-full bg-page"><span className="block h-full rounded-full bg-good" style={{ width: `${Math.min(100, (met / x.target) * 100)}%` }} /></span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {c && <ChallengeSheet c={c} onClose={() => setOpen(null)} staff={canCreate} />}
      <NewChallenge open={making} onClose={() => setMaking(false)} onMake={(x) => { const id = newId("ch"); put("challenges", { ...x, id, createdById: me.id, at: new Date().toISOString(), participantIds: [me.id] }, `started the ${x.name} challenge`); setMaking(false); setOpen(id); toast(`${x.name} is ready. Share the link so people can join.`); }} />
    </div>
  );
}

function ChallengeSheet({ c, onClose, staff }: { c: Challenge; onClose: () => void; staff: boolean }) {
  const { state, me, put } = useStore();
  const [sharing, setSharing] = useState(false);
  const [adding, setAdding] = useState(false);
  if (!me) return null;
  const contacts = state.outreachContacts.filter((k) => k.challengeId === c.id);
  const mine = contacts.filter((k) => k.byId === me.id).length;
  const joined = c.participantIds.includes(me.id);
  const came = contacts.filter((k) => cameToChurch(state, k)).length;
  const today = todayLagos();
  const live = c.start <= today && c.end >= today;
  const link = `${typeof window !== "undefined" ? location.origin : ""}/challenges?join=${c.id}`;
  const join = () => { put("challenges", { ...c, participantIds: [...c.participantIds, me.id] }, `joined the ${c.name} challenge`); toast("You're in! Add everyone you meet."); };
  return (
    <Sheet open onClose={onClose} title={c.name} wide>
      {c.description && <p className="mb-4 text-[14.5px] text-ink-soft">{c.description}</p>}
      <div className="mb-5 grid grid-cols-3 gap-2">
        <Stat n={contacts.length} label={c.target ? `met of ${c.target}` : "met"} />
        <Stat n={came} label="came to church" />
        <Stat n={mine} label={c.targetEach ? `you, of ${c.targetEach}` : "by you"} />
      </div>
      <p className="mb-4 flex items-center gap-2 text-[13.5px] text-muted"><CalendarDays size={15} /> {shortDate(c.start)} to {shortDate(c.end)}</p>
      <div className="mb-6 flex flex-wrap gap-2">
        {joined ? (live && <MetSomeoneButton challengeId={c.id} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-[15px] font-semibold text-white shadow-sm" label="Add someone I met" />)
          : c.end >= today && <Button variant="primary" className="py-2.5" onClick={join}><UserPlus size={16} /> Join the challenge</Button>}
        {staff && <Button onClick={() => setSharing(true)}><Copy size={15} /> Link to join</Button>}
        {staff && <Button onClick={() => setAdding(true)}><Users size={15} /> Add people</Button>}
      </div>
      <h3 className="mb-2 font-display text-[17px] font-semibold">{staff ? "Everyone taking part" : "Top 10"}</h3>
      <Leaderboard contacts={contacts} ids={c.participantIds} compact={!staff} />

      <Sheet open={sharing} onClose={() => setSharing(false)} title="Invite people to join">
        <div className="text-center">
          <div className="mx-auto w-fit rounded-3xl bg-white p-3 ring-1 ring-line"><QR value={link} size={220} /></div>
          <div className="mt-4 flex items-center gap-1 rounded-xl bg-page p-1.5 pl-3 ring-1 ring-line"><span className="flex-1 truncate text-left text-[13px]">{link.replace(/^https?:\/\//, "")}</span><Button className="py-1.5" onClick={() => { void copyText(link).then((ok) => ok && toast("Link copied")); }}><Copy size={14} /> Copy</Button></div>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Join the ${c.name} challenge: ${link}`)}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 font-medium text-[#128c4a]"><WhatsAppIcon size={16} /> Share on WhatsApp</a>
        </div>
      </Sheet>
      <AddPeople open={adding} onClose={() => setAdding(false)} c={c} />
    </Sheet>
  );
}

/** Add people in one tap: all leaders, all workers, or a whole department. */
function AddPeople({ open, onClose, c }: { open: boolean; onClose: () => void; c: Challenge }) {
  const { state, put } = useStore();
  const add = (ids: string[], what: string) => { const next = [...new Set([...c.participantIds, ...ids])]; put("challenges", { ...c, participantIds: next }, `added ${what} to ${c.name}`); toast(`${next.length - c.participantIds.length} added`); };
  const leaders = [...new Set([...state.groups.flatMap((g) => g.leaderIds), ...state.people.filter((p) => p.stage === "leader").map((p) => p.id)])];
  const workers = state.people.filter((p) => p.stage === "worker" && !p.inactive).map((p) => p.id);
  const [q, setQ] = useState("");
  const found = q.trim() ? state.people.filter((p) => !p.isChild && !c.participantIds.includes(p.id) && fullName(p).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  return (
    <Sheet open={open} onClose={onClose} title="Add people to the challenge">
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Button onClick={() => add(leaders, "all leaders")}>All leaders</Button>
        <Button onClick={() => add(workers, "all workers")}>All workers</Button>
      </div>
      <p className="mb-2 text-sm font-medium">A whole department</p>
      <div className="mb-4 flex flex-wrap gap-1.5">{state.groups.filter((g) => g.kind === "department").map((g) => (
        <button type="button" key={g.id} onClick={() => add([...g.leaderIds, ...g.memberIds, ...state.groups.filter((u) => u.parentId === g.id).flatMap((u) => u.memberIds)], g.name)} className="min-h-10 rounded-full bg-surface px-3.5 text-[13.5px] ring-1 ring-line hover:ring-brand/40">{g.name}</button>
      ))}</div>
      <Field label="Or one person"><input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" /></Field>
      <ul className="mt-2 divide-y divide-line">{found.map((p) => <li key={p.id} className="flex items-center gap-3 py-2"><Avatar person={p} size={30} /><span className="flex-1">{fullName(p)}</span><Button className="py-1.5 text-[13px]" onClick={() => add([p.id], p.firstName)}>Add</Button></li>)}</ul>
    </Sheet>
  );
}

function NewChallenge({ open, onClose, onMake }: { open: boolean; onClose: () => void; onMake: (c: Omit<Challenge, "id" | "createdById" | "at" | "participantIds">) => void }) {
  const [f, setF] = useState({ name: "", description: "", start: todayLagos(), end: addDays(todayLagos(), 40), target: "", each: "" });
  const [extra, setExtra] = useState<ExtraFollowers>({});
  const [err, setErr] = useState("");
  const make = () => {
    if (f.name.trim().length < 3) return setErr("Give the challenge a name.");
    if (f.end < f.start) return setErr("The end date is before the start.");
    onMake({ name: f.name.trim(), description: f.description.trim() || undefined, start: f.start, end: f.end, target: Number(f.target) || undefined, targetEach: Number(f.each) || undefined, extraFollowers: extra });
    setF({ name: "", description: "", start: todayLagos(), end: addDays(todayLagos(), 40), target: "", each: "" }); setExtra({});
  };
  return (
    <Sheet open={open} onClose={onClose} title="New challenge" footer={<div className="space-y-2">{err && <p className="text-sm text-alert" role="alert">{err}</p>}<Button variant="primary" className="w-full py-3" onClick={make}>Start the challenge</Button></div>}>
      <div className="space-y-4">
        <Field label="Name"><input autoFocus className={inputCls} value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setErr(""); }} placeholder="40 Souls in 40 Days" /></Field>
        <Field label="What it's about (optional)"><textarea className={cx(inputCls, "min-h-20")} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts"><input type="date" className={inputCls} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="Ends"><input type="date" className={inputCls} value={f.end} min={f.start} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
          <Field label="Target for the church" hint="Optional"><input inputMode="numeric" className={inputCls} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value.replace(/\D/g, "") })} placeholder="40" /></Field>
          <Field label="Target for each person" hint="Optional"><input inputMode="numeric" className={inputCls} value={f.each} onChange={(e) => setF({ ...f, each: e.target.value.replace(/\D/g, "") })} placeholder="5" /></Field>
        </div>
        <ExtraFollowersPicker value={extra} onChange={setExtra} />
      </div>
    </Sheet>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return <div className="rounded-2xl bg-page p-3 text-center ring-1 ring-line"><p className="num text-[24px] font-semibold leading-none">{n}</p><p className="mt-1 text-[12px] text-muted">{label}</p></div>;
}

export default function ChallengesPage() { return <Suspense><Challenges /></Suspense>; }

