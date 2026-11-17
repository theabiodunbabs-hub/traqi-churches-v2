"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Confetti, Field, Sheet, cx, inputCls, toast } from "./ui";
import type { SeedState } from "@/lib/seed";
import type { OutreachContact, Person } from "@/lib/types";

const digits = (s: string) => s.replace(/\D/g, "").replace(/^234/, "0");

/** Someone already in Traqi with the same phone number. */
export const knownAs = (s: SeedState, phone: string): Person | undefined => { const d = digits(phone); return d.length >= 10 ? s.people.find((p) => digits(p.phone) === d) : undefined; };
/** They came to church after we met them: someone with their number whose first visit was on or after that day. */
export const cameToChurch = (s: SeedState, c: OutreachContact) => { const p = knownAs(s, c.phone); return p && p.firstVisit >= c.at.slice(0, 10) ? p : undefined; };

/**
 * "I met someone": 20 seconds for anyone in the church. Name, phone, area and a note,
 * tagged to an outreach when they came from its link, and only with the person's agreement.
 */
export function MetSomeone({ open, onClose, outreachId }: { open: boolean; onClose: () => void; outreachId?: string }) {
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
      put("outreachContacts", { id: newId("oc"), name: f.name.trim(), phone: f.phone.trim(), area: f.area.trim() || undefined, note: f.note.trim() || undefined, outreachId: f.outreach || undefined, byId: me.id, at: new Date().toISOString(), consent: true, status: "new" }, `added ${f.name.trim()}, met${f.outreach ? ` at ${state.outreaches.find((o) => o.id === f.outreach)?.name}` : " personally"}`);
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
          {outreaches.length > 0 && (
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
export function MetSomeoneButton({ className, outreachId }: { className?: string; outreachId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[13.5px] font-medium ring-1 ring-line hover:ring-brand/40"}><UserPlus size={15} className="text-brand" /> I met someone</button>
      <MetSomeone open={open} onClose={() => { setOpen(false); }} outreachId={outreachId} />
    </>
  );
}

