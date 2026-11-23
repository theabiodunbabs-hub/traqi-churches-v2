"use client";

import { copyText } from "@/lib/share";

import Link from "next/link";
import { useState } from "react";
import { Copy, Megaphone, Phone, Plus, QrCode } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Badge, Button, Empty, Field, PageHeader, Sheet, Tabs, cx, inputCls, toast } from "@/components/ui";
import { WhatsAppIcon } from "@/components/care";
import { QR } from "@/components/public";
import { DownloadButton } from "@/components/download";
import { ExtraFollowersPicker, Leaderboard, MetSomeoneButton, cameToChurch, contactPool, knownAs } from "@/components/outreach";
import { isFollowLead } from "@/lib/metrics";
import { outreachSheet } from "@/lib/exports";
import { ago, fullName, shortDate, todayLagos } from "@/lib/format";
import type { ExtraFollowers, Outreach, OutreachContact } from "@/lib/types";

type Col = "call" | "touch" | "came";

/** Everyone met at outreaches or invited by members, at a glance, for the follow-up and outreach teams. */
export default function OutreachPage() {
  const { state, access, me, put, newId } = useStore();
  const [tab, setTab] = useState<Col>("call");
  const [only, setOnly] = useState<string>("");
  const [making, setMaking] = useState(false);
  const [sharing, setSharing] = useState<Outreach | null>(null);
  const [assigning, setAssigning] = useState<OutreachContact | null>(null);
  if (!access || !me) return null;
  const lead = access.assignsCases || isFollowLead(state, access);
  const staff = access.seesAllCases || lead || access.isAdmin;
  const mine = (c: OutreachContact) => c.assigneeId === me.id || c.byId === me.id;
  const all = state.outreachContacts.filter((c) => staff || mine(c));
  const list = all.filter((c) => !only || (only === "own" ? !c.outreachId : c.outreachId === only));
  const col = (c: OutreachContact): Col => (cameToChurch(state, c) ? "came" : c.status === "reached" ? "touch" : "call");
  const shown = list.filter((c) => col(c) === tab).sort((a, b) => b.at.localeCompare(a.at));
  const count = (k: Col) => list.filter((c) => col(c) === k).length;
  const link = (o: Outreach) => `${typeof window !== "undefined" ? location.origin : ""}/met?o=${o.id}`;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Outreach" sub="People met at outreaches and invited by members. Everyone here agreed to be contacted."
        actions={<>
          {staff && <DownloadButton what="Outreach contacts" sheets={() => [outreachSheet(state, list)]} />}
          {staff && <Button onClick={() => setMaking(true)}><Plus size={16} /> New outreach</Button>}
          <MetSomeoneButton className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-3.5 text-sm font-medium text-white shadow-sm" />
        </>} />

      {state.outreaches.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...state.outreaches].sort((a, b) => b.date.localeCompare(a.date)).map((o) => {
            const cs = state.outreachContacts.filter((c) => c.outreachId === o.id);
            const came = cs.filter((c) => cameToChurch(state, c)).length;
            return (
              <div key={o.id} className={cx("card p-4", only === o.id && "ring-2 ring-brand")}>
                <button type="button" onClick={() => setOnly(only === o.id ? "" : o.id)} className="block w-full text-left">
                  <span className="flex items-center gap-2"><Megaphone size={16} className="text-brand" /><b className="truncate font-medium">{o.name}</b></span>
                  <span className="mt-0.5 block text-[13px] text-muted">{shortDate(o.date)}{o.area ? ` · ${o.area}` : ""}</span>
                  <span className="mt-3 flex gap-4 text-[13.5px]"><span><b className="num text-[18px]">{cs.length}</b> met</span><span><b className="num text-[18px]">{cs.filter((c) => c.status === "reached").length}</b> reached</span><span><b className="num text-[18px] text-good">{came}</b> came</span></span>
                </button>
                {staff && <Button className="mt-3 w-full py-2 text-[13px]" onClick={() => setSharing(o)}><QrCode size={14} /> Link for the team</Button>}
              </div>
            );
          })}
        </div>
      )}

      {staff && list.length > 0 && (
        <details className="mb-6 rounded-3xl bg-surface p-5 ring-1 ring-line">
          <summary className="cursor-pointer font-display text-[17px] font-semibold">Who met the most people {only ? "here" : ""}</summary>
          <div className="mt-3"><Leaderboard contacts={list} /></div>
        </details>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={tab} onChange={setTab} items={[{ key: "call", label: "To call", count: count("call") }, { key: "touch", label: "In touch", count: count("touch") }, { key: "came", label: "Came to church", count: count("came") }]} />
        {only && <button type="button" onClick={() => setOnly("")} className="min-h-10 rounded-xl px-3 text-sm font-medium text-brand">Show everyone</button>}
        {!only && staff && <button type="button" onClick={() => setOnly("own")} className="min-h-10 rounded-xl px-3 text-sm text-ink-soft">Only people met personally</button>}
      </div>

      {shown.length === 0 ? (
        <Empty title={tab === "call" ? "Nobody waiting for a call" : tab === "touch" ? "Nobody here yet" : "Nobody yet"} body={tab === "came" ? "When someone you met comes to church, they show here by themselves." : "Tap “I met someone” to add a person you met or invited."} icon={<Megaphone size={26} />} />
      ) : (
        <ul className="space-y-2.5">
          {shown.map((c) => {
            const by = state.people.find((p) => p.id === c.byId);
            const who = state.people.find((p) => p.id === c.assigneeId);
            const known = knownAs(state, c.phone);
            const came = cameToChurch(state, c);
            const wa = `https://wa.me/${c.phone.replace(/\D/g, "").replace(/^0/, "234")}?text=${encodeURIComponent(`Hello ${c.name.split(" ")[0]}, it was lovely meeting you. This is ${me.firstName} from ${state.church.name}. We'd love to see you this Sunday!`)}`;
            return (
              <li key={c.id} className="card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-j1 font-display text-sm font-semibold text-on-light">{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-[13px] text-muted">{[c.area, c.outreachId ? state.outreaches.find((o) => o.id === c.outreachId)?.name : "Met personally", `by ${by ? fullName(by) : "someone"}`, ago(c.at)].filter(Boolean).join(" · ")}</p>
                    {c.note && <p className="mt-2 whitespace-pre-line rounded-lg bg-page px-3 py-2 text-[13.5px] text-ink-soft">{c.note}</p>}
                    {c.contacts?.at(-1) && <p className="mt-2 text-[13px] text-ink-soft">Last: {c.contacts.at(-1)!.outcome}</p>}
                    {came ? <p className="mt-2"><Link href={`/people/${came.id}`} className="text-[13.5px] font-medium text-good">Came to church: open {came.firstName}&apos;s record</Link></p>
                      : known && <p className="mt-2 text-[13px] text-glow-ink">Already in Traqi as <Link href={`/people/${known.id}`} className="font-medium underline">{fullName(known)}</Link></p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a href={`tel:${c.phone}`} className="flex size-10 items-center justify-center rounded-xl bg-page ring-1 ring-line" aria-label={`Call ${c.name}`}><Phone size={16} /></a>
                    <a href={wa} target="_blank" rel="noreferrer" className="flex size-10 items-center justify-center rounded-xl bg-[#25D366]/12 text-[#128c4a] ring-1 ring-[#25D366]/30" aria-label={`WhatsApp ${c.name}`}><WhatsAppIcon size={16} /></a>
                    {c.status === "new" && !came && <Button className="py-2" onClick={async () => { put("outreachContacts", { ...c, status: "reached", contacts: [...(c.contacts ?? []), { at: new Date().toISOString(), byId: me.id, outcome: "Reached" }] }, `reached ${c.name}`); toast(`${c.name.split(" ")[0]} moved to In touch`); }}>Reached</Button>}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[13px]">
                  {who ? <span className="flex items-center gap-1.5 text-ink-soft"><Avatar person={who} size={20} />{who.id === me.id ? "You're following up" : `${who.firstName} is following up`}</span> : <Badge tone="glow">Waiting for someone</Badge>}
                  {(lead || access.isPastoral) && <button type="button" onClick={() => setAssigning(c)} className="ml-auto min-h-9 rounded-lg px-2.5 font-medium text-brand hover:bg-brand-soft">{who ? "Change" : "Assign"}</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* New outreach */}
      <NewOutreach open={making} onClose={() => setMaking(false)} onMake={(o) => { put("outreaches", { ...o, id: newId("or"), createdById: me.id, at: new Date().toISOString() }, `planned ${o.name}`); setMaking(false); toast(`${o.name} is ready. Share its link with the team.`); }} />

      {/* Link and QR for the team */}
      <Sheet open={!!sharing} onClose={() => setSharing(null)} title={sharing?.name ?? ""}>
        {sharing && (
          <div className="text-center">
            <p className="mb-4 text-[14px] text-ink-soft">Everyone on the outreach opens this link (or scans the code) and adds people as they meet them. Each one is tagged to {sharing.name}.</p>
            <div className="mx-auto w-fit rounded-3xl bg-white p-3 ring-1 ring-line"><QR value={link(sharing)} size={220} /></div>
            <div className="mt-4 flex items-center gap-1 rounded-xl bg-page p-1.5 pl-3 ring-1 ring-line"><span className="flex-1 truncate text-left text-[13px]">{link(sharing).replace(/^https?:\/\//, "")}</span><Button className="py-1.5" onClick={() => { void copyText(link(sharing)).then((ok) => ok && toast("Link copied")); }}><Copy size={14} /> Copy</Button></div>
            <a href={`https://wa.me/?text=${encodeURIComponent(`For ${sharing.name}: add everyone you meet here ${link(sharing)}`)}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 font-medium text-[#128c4a]"><WhatsAppIcon size={16} /> Send to the team&apos;s WhatsApp</a>
          </div>
        )}
      </Sheet>

      {/* Assign to someone on the follow-up team */}
      <Sheet open={!!assigning} onClose={() => setAssigning(null)} title={`Who will follow up ${assigning?.name.split(" ")[0] ?? ""}?`}>
        <ul className="divide-y divide-line">
          {contactPool(state, assigning?.outreachId ? state.outreaches.find((o) => o.id === assigning.outreachId)?.extraFollowers : assigning?.challengeId ? state.challenges.find((c) => c.id === assigning.challengeId)?.extraFollowers : undefined).map((id) => state.people.find((p) => p.id === id)).filter(Boolean).map((p) => (
            <li key={p!.id}><button type="button" onClick={() => { put("outreachContacts", { ...assigning!, assigneeId: p!.id }, `asked ${p!.firstName} to follow up ${assigning!.name}`); setAssigning(null); toast(`${p!.firstName} will follow up`); }} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-page">
              <Avatar person={p} size={34} /><span className="flex-1 font-medium">{fullName(p)}</span><span className="text-[12.5px] text-muted">{state.outreachContacts.filter((c) => c.assigneeId === p!.id && c.status === "new").length} to call</span>
            </button></li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

function NewOutreach({ open, onClose, onMake }: { open: boolean; onClose: () => void; onMake: (o: Pick<Outreach, "name" | "date" | "area" | "extraFollowers">) => void }) {
  const [f, setF] = useState({ name: "", date: todayLagos(), area: "" });
  const [extra, setExtra] = useState<ExtraFollowers>({});
  const [err, setErr] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="New outreach" footer={<div className="space-y-2">{err && <p className="text-sm text-alert" role="alert">{err}</p>}<Button variant="primary" className="w-full py-3" onClick={() => { if (f.name.trim().length < 3) return setErr("Give it a name."); onMake({ name: f.name.trim(), date: f.date, area: f.area.trim() || undefined, extraFollowers: extra }); setF({ name: "", date: todayLagos(), area: "" }); setExtra({}); }}>Create</Button></div>}>
      <div className="space-y-4">
        <Field label="Name"><input autoFocus className={inputCls} value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setErr(""); }} placeholder="Ojota Market Evangelism" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Area (optional)"><input className={inputCls} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Ojota" /></Field>
        </div>
        <ExtraFollowersPicker value={extra} onChange={setExtra} />
        <p className="rounded-xl bg-page px-3.5 py-3 text-[13.5px] text-ink-soft">You&apos;ll get a link and QR code for the team. Everyone they meet is added to it and given someone to follow them up straight away.</p>
      </div>
    </Sheet>
  );
}
