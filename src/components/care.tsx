"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Phone, Star, X } from "lucide-react";
import type { Person, TemplateCategory } from "@/lib/types";
import { fill, hhmm12, telLink, waLink } from "@/lib/format";
import { cx, toast } from "./ui";

export function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

/**
 * One-tap reach-out buttons. WhatsApp opens on the worker's own phone with the message written.
 * When they come back to Traqi, they're asked how it went, so the follow-up record stays true.
 */
export function ReachOut({ person, message, compact, canContact = true, category }: { person: Person; message: string; compact?: boolean; canContact?: boolean; category?: TemplateCategory }) {
  const { startContact, state } = useStore();
  const [pick, setPick] = useState(false);
  if (!canContact) return null;
  const wa = person.whatsapp || person.phone;
  const church = state.church.name;
  const cat: TemplateCategory = category
    ?? (message === messages.welcome(person, church) ? (person.stage === "returning" ? "returning" : "welcome")
      : message === messages.birthday(person, church) ? "birthday" : message === messages.absent(person, church) ? "absence" : "general");
  const hasTemplates = state.templates.some((t) => t.category === cat);
  const base = "inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition active:scale-[.97]";
  return (
    <div className="flex shrink-0 gap-1.5">
      <a href={telLink(person.phone)} onClick={() => startContact(person.id, "call")} className={cx(base, "bg-page text-ink ring-1 ring-line hover:ring-ink/20", compact ? "size-11" : "h-11 px-4")} aria-label={`Call ${person.firstName}`}>
        <Phone size={16} />{!compact && "Call"}
      </a>
      <a href={waLink(wa, message)} onClick={(e) => { if (hasTemplates) { e.preventDefault(); setPick(true); } else startContact(person.id, "whatsapp"); }} target="_blank" rel="noreferrer" className={cx(base, "bg-[#e7f8ee] text-[#0f7a3d] hover:bg-[#d6f3e2]", compact ? "size-11" : "h-11 px-4")} aria-label={`WhatsApp ${person.firstName}`}>
        <WhatsAppIcon size={16} />{!compact && "WhatsApp"}
      </a>
      {pick && <TemplatePicker person={person} category={cat} onClose={() => setPick(false)} />}
    </div>
  );
}

/** Choose a ready-made message, tweak it, and open WhatsApp with it written. */
export function TemplatePicker({ person, category, onClose, vars = {}, onSent }: { person: Person; category: TemplateCategory; onClose: () => void; vars?: Record<string, string>; onSent?: () => void }) {
  const { state, me, startContact, put, newId } = useStore();
  const services = state.church.profile?.services?.filter((s) => s.kind === "sunday") ?? [];
  const values = { first_name: person.firstName, church_name: state.church.name, my_name: me?.firstName, service_time: services[0] ? hhmm12(services[0].start) : "", ...vars };
  const list = state.templates.filter((t) => t.category === category && (!t.ownerId || t.ownerId === me?.id))
    .sort((a, b) => Number(!!b.ownerId) - Number(!!a.ownerId) || Number(!!b.isDefault) - Number(!!a.isDefault));
  const [i, setI] = useState(0);
  const [text, setText] = useState(fill(list[0]?.body ?? "", values));
  const choose = (k: number) => { setI(k); setText(fill(list[k].body, values)); };
  const wa = person.whatsapp || person.phone;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label="Choose a message">
      <button aria-label="Close" className="fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative w-full max-w-lg rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-2"><WhatsAppIcon size={18} /><p className="font-display text-lg font-semibold">Message to {person.firstName}</p><button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-page" aria-label="Close"><X size={17} /></button></div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {list.map((t, k) => (
            <button key={t.id} onClick={() => choose(k)} className={cx("flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[13px] ring-1", i === k ? "bg-deep text-white ring-deep" : "bg-page ring-line")}>
              {t.ownerId && <Star size={12} className={i === k ? "fill-white" : "fill-glow text-glow"} />}{t.name}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-2xl bg-[#e7fbe9] p-3"><textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-32 w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none" aria-label="Message" /></div>
        <div className="mt-3 flex gap-2">
          {text !== fill(list[i]?.body ?? "", values) && <button onClick={() => {
            const body = text.split(person.firstName).join("{first_name}").split(state.church.name).join("{church_name}");
            put("templates", { id: newId("tp"), category, name: "My version", body, ownerId: me?.id });
            toast("Saved as your own version");
          }} className="rounded-xl px-3 py-2 text-[13px] font-medium text-brand hover:bg-brand-soft"><Star size={13} className="mr-1 inline" />Save as mine</button>}
          <a href={waLink(wa, text)} target="_blank" rel="noreferrer" onClick={() => { startContact(person.id, "whatsapp"); onSent?.(); onClose(); }}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"><WhatsAppIcon /> Open WhatsApp</a>
        </div>
      </div>
    </div>
  );
}

const OUTCOMES = {
  call: [
    { text: "Spoke with them", reached: true },
    { text: "No answer", reached: false },
    { text: "Number switched off or wrong", reached: false },
  ],
  whatsapp: [
    { text: "Sent, they replied", reached: true },
    { text: "Sent, no reply yet", reached: false },
    { text: "Didn't send it", reached: false },
  ],
};

/** Shown when someone returns from a call or WhatsApp chat started in Traqi. */
export function ContactPrompt() {
  const { state, person, finishContact } = useStore();
  const pc = state.pendingContact;
  const [show, setShow] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!pc) { setShow(false); return; }
    const age = Date.now() - new Date(pc.at).getTime();
    if (age > 1000 * 60 * 60 * 6) { finishContact(null); return; } // stale: forget it
    const open = () => setShow(true);
    const onVis = () => { if (document.visibilityState === "visible") open(); };
    const t = setTimeout(open, Math.max(0, 5000 - age));
    window.addEventListener("focus", open);
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t); window.removeEventListener("focus", open); document.removeEventListener("visibilitychange", onVis); };
  }, [pc, finishContact]);

  if (!pc || !show) return null;
  const p = person(pc.personId);
  if (!p) return null;
  const save = (o: { text: string; reached: boolean }) => { finishContact(note.trim() ? `${o.text}. ${note.trim()}` : o.text, o.reached); setNote(""); setShow(false); };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label="How did it go?">
      <button aria-label="Close" className="fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => { finishContact(null); setShow(false); }} />
      <div className="rise relative w-full max-w-md rounded-t-3xl bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <p className="text-sm text-muted">{pc.method === "call" ? "You called" : "You opened WhatsApp with"} {p.firstName}</p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">How did it go?</h2>
        <div className="mt-5 space-y-2">
          {OUTCOMES[pc.method].map((o) => (
            <button key={o.text} onClick={() => save(o)}
              className={cx("flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-[15px] font-medium ring-1 transition active:scale-[.99]",
                o.reached ? "bg-good-soft text-good ring-good/20 hover:ring-good/40" : "bg-page text-ink ring-line hover:ring-ink/20")}>
              <span className={cx("size-2.5 rounded-full", o.reached ? "bg-good" : "bg-muted/50")} />{o.text}
            </button>
          ))}
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional): coming on Sunday"
          className="mt-4 w-full rounded-xl bg-page px-3.5 py-3 text-[15px] ring-1 ring-line outline-none placeholder:text-muted focus:bg-surface focus:ring-2 focus:ring-brand" />
        <button onClick={() => { finishContact(null); setShow(false); }} className="mt-3 w-full py-2 text-sm text-muted hover:text-ink">Skip for now</button>
      </div>
    </div>
  );
}

export const messages = {
  welcome: (p: Person, church: string) => `Hello ${p.firstName}, it was lovely having you at ${church}. We'd love to see you again this Sunday. Is there anything we can pray with you about?`,
  birthday: (p: Person, church: string) => `Happy birthday, ${p.firstName}! Everyone at ${church} is celebrating you today. May this new year bring you joy and God's favour.`,
  absent: (p: Person, church: string) => `Hi ${p.firstName}, we've missed you at ${church} these past few weeks. Just checking in. How are you doing?`,
};

export function ReasonTag({ tone, children }: { tone: "alert" | "glow" | "brand" | "muted"; children: React.ReactNode }) {
  const t = { alert: "bg-alert-soft text-alert", glow: "bg-glow-soft text-glow-ink", brand: "bg-brand-soft text-brand", muted: "bg-page text-ink-soft" }[tone];
  return <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium", t)}>{children}</span>;
}

export function ProfileLink({ id, children }: { id: string; children: React.ReactNode }) {
  return <Link href={`/people/${id}`} className="font-medium hover:text-brand">{children}</Link>;
}
