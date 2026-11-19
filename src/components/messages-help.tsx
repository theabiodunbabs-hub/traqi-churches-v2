"use client";

import Link from "next/link";
import { useState } from "react";
import { HandHeart, HeartHandshake, Headphones, LifeBuoy, MessageCircleHeart, Pencil, PlayCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Field, Sheet, inputCls, toast } from "./ui";

/** Where the church's sermons live. The church adds these once; members see one "Listen to messages" button. */
export const SERMON_PLATFORMS = ["YouTube", "Spotify", "Apple Podcasts", "Mixlr", "Telegram", "Facebook", "Website", "Other"];

/** "Listen to messages": last Sunday's message first, then every place the church keeps its sermons. */
export function ListenToMessages({ className }: { className?: string }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const p = state.church.profile;
  const links = p?.sermonLinks ?? [];
  if (!links.length && !p?.pinnedMessage?.url) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[13.5px] font-medium ring-1 ring-line hover:ring-brand/40"}><Headphones size={15} className="text-brand" /> Listen to messages</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Listen to messages">
        {p?.pinnedMessage?.url && (
          <a href={p.pinnedMessage.url} target="_blank" rel="noreferrer" className="mb-4 flex items-center gap-4 rounded-2xl bg-deep p-4 text-white">
            <PlayCircle size={34} className="shrink-0" />
            <span className="min-w-0"><span className="block text-[12px] uppercase tracking-wider text-white/75">Last Sunday</span><b className="block truncate text-[16px]">{p.pinnedMessage.title || "Latest message"}</b></span>
          </a>
        )}
        <ul className="space-y-2">{links.map((l) => (
          <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-2xl bg-page px-4 ring-1 ring-line hover:ring-brand/40"><Headphones size={17} className="text-brand" /><span className="flex-1 font-medium">{l.platform}</span><span className="text-[13px] text-muted">Open</span></a></li>
        ))}</ul>
      </Sheet>
    </>
  );
}

/** Media head, their assistants and the admin keep last Sunday's message up to date from their Home. */
export function LastMessageCard() {
  const { state, access, me, updateChurch } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", url: "" });
  if (!access || !me) return null;
  const mediaAssistant = state.groups.some((g) => g.tags?.includes("media") && g.assistants?.some((a) => a.personId === me.id));
  if (!access.isMediaHead && !mediaAssistant && !access.isAdmin) return null;
  const pm = state.church.profile?.pinnedMessage;
  return (
    <section className="card flex flex-wrap items-center gap-4 p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><PlayCircle size={21} /></span>
      <span className="min-w-[12rem] flex-1"><b className="block font-display text-[16px] font-semibold">Last Sunday&apos;s message</b><span className="text-[13.5px] text-ink-soft">{pm?.title ? `“${pm.title}”` : "Not added yet. Members see it under Listen to messages."}</span></span>
      <Button onClick={() => { setF({ title: pm?.title ?? "", url: pm?.url ?? "" }); setOpen(true); }}><Pencil size={14} /> {pm?.title ? "Change" : "Add"}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Last Sunday's message" footer={<Button variant="primary" className="w-full py-3" disabled={!f.url.trim()} onClick={() => { updateChurch({}, { pinnedMessage: { title: f.title.trim(), url: f.url.trim() } }, `added last Sunday's message: ${f.title.trim()}`); setOpen(false); toast("Members can listen now"); }}>Save</Button>}>
        <div className="space-y-4">
          <Field label="Title"><input autoFocus className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Walking in Purpose" /></Field>
          <Field label="Link"><input className={inputCls} inputMode="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://youtube.com/…" /></Field>
        </div>
      </Sheet>
    </section>
  );
}

/** "I need help": counselling with the pastorate, welfare support, or a prayer request. */
export function NeedHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const opts = [
    { href: "/counselling?new=1", icon: MessageCircleHeart, title: "Book a counselling session", body: "Talk to the pastorate about something on your heart." },
    { href: "/welfare?new=1", icon: HeartHandshake, title: "Ask for welfare support", body: "Food, rent, medical bills, school fees and more." },
    { href: "/prayer?new=1", icon: HandHeart, title: "Send a prayer request", body: "The pastors and prayer team will pray with you." },
  ];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}><LifeBuoy size={19} /> I need help</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="How can we help?">
        <ul className="space-y-2.5">{opts.map((o) => { const I = o.icon; return (
          <li key={o.href}><Link href={o.href} onClick={() => setOpen(false)} className="flex items-center gap-4 rounded-2xl bg-page p-4 ring-1 ring-line hover:ring-brand/40">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand"><I size={21} /></span>
            <span><b className="block font-medium">{o.title}</b><span className="text-[13.5px] text-ink-soft">{o.body}</span></span>
          </Link></li>
        ); })}</ul>
        <p className="mt-4 text-[12.5px] text-muted">What you share is kept private to the people who handle it.</p>
      </Sheet>
    </>
  );
}
