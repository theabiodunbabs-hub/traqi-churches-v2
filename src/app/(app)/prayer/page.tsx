"use client";

import { useState } from "react";
import { Check, EyeOff, HandHeart, Lock, Plus, Settings2, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Badge, Button, Empty, PageHeader, Panel, Sheet, Tabs, Toggle, cx, toast } from "@/components/ui";
import { ago, fullName } from "@/lib/format";
import type { PrayerRequest } from "@/lib/types";

export default function Prayer() {
  const { me, access, state } = useStore();
  const [asking, setAsking] = useState(false);
  const [who, setWho] = useState(false);
  const [tab, setTab] = useState<"open" | "answered">("open");
  if (!me || !access) return null;
  const mine = state.prayers.filter((p) => p.personId === me.id).sort((a, b) => b.at.localeCompare(a.at));
  const all = [...state.prayers].sort((a, b) => b.at.localeCompare(a.at));
  const shown = all.filter((p) => (tab === "answered" ? !!p.answered : !p.answered));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Prayer" sub={access.seesPrayers ? "Requests from the church. Tap Prayed so they know someone stood with them." : "Share a prayer request with your pastors."}
        actions={<div className="flex gap-2">
          {access.isLead && <Button onClick={() => setWho(true)}><Settings2 size={15} /> Who sees these</Button>}
          <Button variant="primary" onClick={() => setAsking(true)}><Plus size={16} /> Prayer request</Button>
        </div>} />

      {mine.length > 0 && (
        <Panel title="Your requests" className="mb-6">
          <ul className="space-y-3">{mine.map((p) => <Mine key={p.id} p={p} />)}</ul>
        </Panel>
      )}

      {access.seesPrayers ? (
        <>
          <Tabs value={tab} onChange={setTab} className="mb-4" items={[
            { key: "open", label: "Praying for", count: all.filter((p) => !p.answered).length },
            { key: "answered", label: "Answered", count: all.filter((p) => p.answered).length },
          ]} />
          {shown.length === 0 ? <Empty title="Nothing here yet" body="New prayer requests will show here." /> : (
            <ul className="space-y-3">{shown.map((p) => <Request key={p.id} p={p} />)}</ul>
          )}
          <p className="mt-6 flex items-center gap-2 text-[13px] text-muted"><Lock size={13} /> Prayer requests are private to the people praying for them. They are never downloaded.</p>
        </>
      ) : mine.length === 0 && (
        <div className="rise rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><HandHeart size={26} /></span>
          <p className="mt-4 font-display text-xl font-semibold">We&apos;d love to pray with you</p>
          <p className="mx-auto mt-1 max-w-sm text-ink-soft">Your request goes to the pastors and the prayer team only. You&apos;ll see when someone has prayed.</p>
          <Button variant="primary" className="mt-5" onClick={() => setAsking(true)}><Plus size={16} /> Share a request</Button>
        </div>
      )}

      <Ask open={asking} onClose={() => setAsking(false)} />
      {access.isLead && <Viewers open={who} onClose={() => setWho(false)} />}
    </div>
  );
}

function Mine({ p }: { p: PrayerRequest }) {
  const { put } = useStore();
  return (
    <li className="rounded-2xl bg-page p-4 ring-1 ring-line">
      <p className="text-[15px]">{p.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        <span>{ago(p.at)}</span>
        {p.prayed.length > 0 ? <Badge tone="good"><Check size={11} /> Prayed{p.prayed.length > 1 ? ` · ${p.prayed.length} people` : ""}</Badge> : <Badge tone="neutral">Sent</Badge>}
        {p.answered ? <Badge tone="glow"><Sparkles size={11} /> Answered</Badge>
          : <button className="ml-auto font-medium text-brand" onClick={() => put("prayers", { ...p, answered: new Date().toISOString() }, "marked their prayer request answered")}>God answered this</button>}
      </div>
    </li>
  );
}

function Request({ p }: { p: PrayerRequest }) {
  const { me, person, put } = useStore();
  const who = person(p.personId);
  const iPrayed = p.prayed.some((x) => x.byId === me?.id);
  return (
    <li className="rise rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center gap-3">
        {p.anonymous ? <span className="flex size-9 items-center justify-center rounded-full bg-page text-muted ring-1 ring-line"><EyeOff size={15} /></span> : <Avatar person={who} size={36} />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{p.anonymous ? "Someone in the church" : fullName(who)}</p>
          <p className="text-[12.5px] text-muted">{ago(p.at)}{p.prayed.length ? ` · prayed for by ${p.prayed.length}` : ""}</p>
        </div>
        {p.answered && <Badge tone="glow"><Sparkles size={11} /> Answered</Badge>}
      </div>
      <p className="mt-3 text-[15.5px] leading-relaxed">{p.body}</p>
      {!p.answered && (
        <Button variant={iPrayed ? "secondary" : "primary"} className="mt-4" disabled={iPrayed}
          onClick={() => { put("prayers", { ...p, prayed: [...p.prayed, { byId: me!.id, at: new Date().toISOString() }] }, "prayed for a prayer request"); toast("Thank you for praying"); }}>
          {iPrayed ? <><Check size={15} /> You prayed</> : <><HandHeart size={15} /> Prayed</>}
        </Button>
      )}
    </li>
  );
}

function Ask({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, put, newId } = useStore();
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const close = () => { setBody(""); setAnon(false); onClose(); };
  const send = () => {
    if (!me || body.trim().length < 3) return;
    put("prayers", { id: newId("pry"), personId: me.id, body: body.trim(), at: new Date().toISOString(), anonymous: anon || undefined, prayed: [] }, "shared a prayer request");
    toast("Sent. The pastors will pray with you.");
    close();
  };
  return (
    <Sheet open={open} onClose={close} title="Prayer request" footer={<Button variant="primary" className="w-full py-3" onClick={send} disabled={body.trim().length < 3}>Send</Button>}>
      <div className="space-y-4">
        <textarea autoFocus rows={6} className="w-full rounded-2xl bg-page px-4 py-3 text-[15.5px] ring-1 ring-line outline-none focus:bg-surface focus:ring-2 focus:ring-brand"
          placeholder="What would you like us to pray about?" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex items-center gap-3 rounded-2xl bg-page px-4 py-3 ring-1 ring-line">
          <span className="flex-1"><span className="block text-[15px]">Don&apos;t show my name</span><span className="block text-[12.5px] text-muted">The prayer team sees the request without your name</span></span>
          <Toggle label="Don't show my name" on={anon} onChange={setAnon} />
        </div>
        <p className="flex items-center gap-2 text-[13px] text-muted"><Lock size={13} /> Seen only by the pastors and the prayer team.</p>
      </div>
    </Sheet>
  );
}

function Viewers({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, person, updateChurch } = useStore();
  const ids = state.church.profile?.prayerViewers ?? [];
  const leaders = state.people.filter((p) => !p.isChild && !p.inactive && (p.isLeader || ["worker", "leader"].includes(p.stage)));
  const toggle = (id: string) => updateChurch({}, { prayerViewers: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] }, "changed who sees prayer requests");
  return (
    <Sheet open={open} onClose={onClose} title="Who sees prayer requests">
      <p className="mb-4 text-sm text-ink-soft">You, the pastors and the Membership Ministry leaders always see them. Add anyone else, like a prayer team.</p>
      <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
        {leaders.map((p) => (
          <li key={p.id} className={cx("flex items-center gap-3 px-3 py-2.5", ids.includes(p.id) && "bg-brand-soft/50")}>
            <Avatar person={person(p.id)} size={30} /><span className="flex-1 text-sm font-medium">{fullName(p)}</span>
            <Toggle label={`Let ${p.firstName} see prayer requests`} on={ids.includes(p.id)} onChange={() => toggle(p.id)} />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
