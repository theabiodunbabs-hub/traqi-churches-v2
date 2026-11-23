"use client";

import { copyText } from "@/lib/share";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Download, ImagePlus, Mail, MapPin, Megaphone, Phone, Send, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Badge, Button, Empty, Field, PageHeader, Sheet, Tabs, cx, inputCls, toast } from "@/components/ui";
import { WhatsAppIcon } from "@/components/care";
import { uploadImage } from "@/lib/upload";
import { fullName, shortDate, ago } from "@/lib/format";
import type { ChurchInvite } from "@/lib/types";

const KINDS: [ChurchInvite["kind"], string][] = [["wedding", "Wedding"], ["naming", "Naming ceremony"], ["birthday", "Birthday"], ["burial", "Burial"], ["thanksgiving", "Thanksgiving"], ["other", "Other"]];
const AUDIENCE: [ChurchInvite["audience"], string][] = [["pastorate", "Pastorate only"], ["leaders", "Pastorate and leaders"], ["workforce", "The workforce"], ["church", "The whole church"]];
const WANTS: [ChurchInvite["wants"][number], string][] = [["officiate", "Officiate"], ["attend", "Attend only"], ["choir", "Choir to minister"]];
const kindName = (i: ChurchInvite) => (i.kind === "other" ? i.kindOther || "Occasion" : KINDS.find(([k]) => k === i.kind)?.[1] ?? "Occasion");
const t12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/**
 * Invite the church: members, workers and leaders tell the church about a wedding, naming, birthday, burial and more.
 * Only the admin and pastorate receive it. They announce it themselves and reach out to confirm.
 */
export default function Invitations() {
  const { state, access, me, put } = useStore();
  const [making, setMaking] = useState(false);
  const [tab, setTab] = useState<"new" | "done">("new");
  const [open, setOpen] = useState<ChurchInvite | null>(null);
  useEffect(() => { if (new URLSearchParams(location.search).has("new")) setMaking(true); }, []);
  if (!access || !me) return null;
  const inbox = access.isPastoral || access.isAdmin;
  const mine = state.churchInvites.filter((i) => i.byId === me.id).sort((a, b) => b.at.localeCompare(a.at));
  const all = [...state.churchInvites].sort((a, b) => a.date.localeCompare(b.date));
  const list = inbox ? all.filter((i) => (tab === "new" ? i.status === "new" || i.status === "contacted" : i.status === "confirmed" || i.status === "declined")) : mine;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={inbox ? "Invitations to the church" : "Invite the church"} sub={inbox ? "Weddings, namings, birthdays and more that members have invited the church to." : "Tell the church about your wedding, naming, birthday or any special occasion."}
        actions={<Button variant="primary" onClick={() => setMaking(true)}><Send size={16} /> Invite the church</Button>} />
      {inbox && <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ key: "new", label: "To handle", count: all.filter((i) => i.status === "new" || i.status === "contacted").length }, { key: "done", label: "Done" }]} /></div>}
      {list.length === 0 ? <Empty title={inbox ? "Nothing waiting" : "No invitations yet"} body={inbox ? "When someone invites the church, it shows here." : "Tap “Invite the church” to tell the pastorate about your occasion."} icon={<Mail size={26} />} /> : (
        <ul className="space-y-3">
          {list.map((i) => {
            const by = state.people.find((p) => p.id === i.byId);
            return (
              <li key={i.id}>
                <button type="button" onClick={() => setOpen(i)} className="card card-hover flex w-full items-center gap-4 p-4 text-left">
                  {i.flyer ? <img src={i.flyer} alt="" className="size-16 shrink-0 rounded-xl object-cover" /> : <span className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft text-brand"><span className="text-[12px] font-semibold uppercase">{new Date(`${i.date}T12:00:00`).toLocaleDateString("en-GB", { month: "short" })}</span><span className="num text-[22px] font-semibold leading-none">{i.date.slice(8)}</span></span>}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-medium">{kindName(i)}{inbox && by ? `: ${fullName(by)}` : ""}</b>
                    <span className="block text-[13px] text-muted">{shortDate(i.date)}, {t12(i.time)}{i.venue ? ` · ${i.venue}` : ""}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5"><Badge tone="neutral">{AUDIENCE.find(([k]) => k === i.audience)?.[1]}</Badge>{i.announce && <Badge tone="brand">Announce in church</Badge>}</span>
                  </span>
                  <Badge tone={i.status === "confirmed" ? "good" : i.status === "declined" ? "neutral" : i.status === "contacted" ? "brand" : "glow"}>{i.status === "new" ? "New" : i.status === "contacted" ? "Contacted" : i.status === "confirmed" ? "Confirmed" : "Declined"}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <InviteForm open={making} onClose={() => setMaking(false)} />
      {open && <InviteDetail i={state.churchInvites.find((x) => x.id === open.id) ?? open} inbox={inbox} onClose={() => setOpen(null)} onStatus={(status, reply) => { put("churchInvites", { ...open, status, reply: reply ?? open.reply, handledById: me.id }, `marked the ${kindName(open)} invitation ${status}`); setOpen(null); toast("Updated"); }} />}
    </div>
  );
}

function InviteDetail({ i, inbox, onClose, onStatus }: { i: ChurchInvite; inbox: boolean; onClose: () => void; onStatus: (s: ChurchInvite["status"], reply?: string) => void }) {
  const { state, access } = useStore();
  const by = state.people.find((p) => p.id === i.byId);
  const contact = by && access?.canSeeContacts(by);
  const text = `${kindName(i)}${by ? ` (${fullName(by)})` : ""}\n${shortDate(i.date)}, ${t12(i.time)}\n${i.venue ?? ""}${i.link ? `\n${i.link}` : ""}\n\n${i.details}\n\nInvited: ${AUDIENCE.find(([k]) => k === i.audience)?.[1]}\nWould like: ${[...i.wants.map((w) => WANTS.find(([k]) => k === w)?.[1]), i.wantsOther].filter(Boolean).join(", ")}\nAnnounce in church: ${i.announce ? "Yes" : "No"}`;
  const download = () => {
    const a = document.createElement("a");
    if (i.flyer) { a.href = i.flyer; a.download = `${kindName(i)} invitation.jpg`; a.target = "_blank"; }
    else { a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = `${kindName(i)} invitation.txt`; }
    document.body.appendChild(a); a.click(); a.remove();
  };
  return (
    <Sheet open onClose={onClose} title={kindName(i)} wide>
      {i.flyer && <img src={i.flyer} alt="Invitation card" className="mb-4 max-h-[60vh] w-full rounded-2xl object-contain ring-1 ring-line" />}
      <div className="space-y-2 text-[14.5px]">
        <p className="flex items-center gap-2"><CalendarDays size={16} className="text-brand" />{shortDate(i.date)}, {t12(i.time)}</p>
        {i.venue && <p className="flex items-center gap-2"><MapPin size={16} className="text-brand" />{i.venue}</p>}
        {i.link && <a href={i.link} target="_blank" rel="noreferrer" className="block font-medium text-brand">{i.link}</a>}
        <p className="whitespace-pre-line rounded-2xl bg-page p-4 text-ink-soft">{i.details}</p>
        <p><b>Inviting:</b> {AUDIENCE.find(([k]) => k === i.audience)?.[1]}</p>
        <p><b>Would like the church to:</b> {[...i.wants.map((w) => WANTS.find(([k]) => k === w)?.[1]), i.wantsOther].filter(Boolean).join(", ") || "Not said"}</p>
        <p className="flex items-center gap-2"><Megaphone size={15} className="text-brand" />{i.announce ? "Would like it announced in church" : "No announcement needed"}</p>
        {i.reply && <p className="rounded-xl bg-brand-soft px-3 py-2 text-[13.5px]">Note: {i.reply}</p>}
      </div>
      {inbox && by && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl bg-page p-3 ring-1 ring-line">
          <Avatar person={by} size={34} /><span className="flex-1"><b className="block text-[14px]">{fullName(by)}</b><span className="text-[12.5px] text-muted">Sent {ago(i.at)}</span></span>
          {contact && <a href={`tel:${by.phone}`} className="flex size-10 items-center justify-center rounded-xl bg-surface ring-1 ring-line" aria-label="Call"><Phone size={16} /></a>}
          {contact && <a href={`https://wa.me/${by.phone.replace(/\D/g, "").replace(/^0/, "234")}?text=${encodeURIComponent(`Hello ${by.firstName}, thank you for inviting the church to your ${kindName(i).toLowerCase()}. `)}`} target="_blank" rel="noreferrer" className="flex size-10 items-center justify-center rounded-xl bg-[#25D366]/12 text-[#128c4a] ring-1 ring-[#25D366]/30" aria-label="WhatsApp"><WhatsAppIcon size={16} /></a>}
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={download}><Download size={15} /> Download</Button>
        <Button onClick={() => { void copyText(text, "Copy the details").then((ok) => ok && toast("Details copied, ready to announce")); }}>Copy details</Button>
        {inbox && i.status === "new" && <Button onClick={() => onStatus("contacted")}>Mark contacted</Button>}
        {inbox && i.status !== "confirmed" && <Button variant="primary" onClick={() => onStatus("confirmed")}>Confirmed</Button>}
        {inbox && i.status !== "declined" && i.status !== "confirmed" && <Button variant="ghost" onClick={() => onStatus("declined")}><X size={15} /> Can&apos;t honour</Button>}
      </div>
    </Sheet>
  );
}

function InviteForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, put, newId } = useStore();
  const blank = () => ({ kind: "wedding" as ChurchInvite["kind"], kindOther: "", details: "", date: "", time: "10:00", venue: "", link: "", audience: "church" as ChurchInvite["audience"], wants: ["attend"] as ChurchInvite["wants"], wantsOther: "", announce: true, flyer: "" });
  const [f, setF] = useState(blank());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const chip = (on: boolean) => cx("min-h-10 rounded-full px-3.5 text-[13.5px] ring-1", on ? "bg-deep text-white ring-deep" : "bg-surface ring-line");
  const send = () => {
    if (!me) return;
    if (f.kind === "other" && !f.kindOther.trim()) return setErr("Say what the occasion is.");
    if (f.details.trim().length < 10) return setErr("Add a few words about the occasion.");
    if (!f.date) return setErr("Choose the date.");
    put("churchInvites", { id: newId("ci"), byId: me.id, at: new Date().toISOString(), kind: f.kind, kindOther: f.kindOther.trim() || undefined, details: f.details.trim(), date: f.date, time: f.time, venue: f.venue.trim() || undefined, link: f.link.trim() || undefined, audience: f.audience, wants: f.wants, wantsOther: f.wantsOther.trim() || undefined, announce: f.announce, flyer: f.flyer || undefined, status: "new" }, "invited the church to an occasion");
    setF(blank()); setErr(""); onClose(); toast("Sent to the pastorate and admin. They'll reach out to you.");
  };
  return (
    <Sheet open={open} onClose={onClose} title="Invite the church" footer={<div className="space-y-2">{err && <p className="text-sm text-alert" role="alert">{err}</p>}<Button variant="primary" className="w-full py-3" disabled={busy} onClick={send}><Send size={16} /> Send invitation</Button></div>}>
      <div className="space-y-5">
        <Field label="What's the occasion?">
          <div className="flex flex-wrap gap-1.5">{KINDS.map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, kind: k })} className={chip(f.kind === k)}>{l}</button>)}</div>
          {f.kind === "other" && <input className={cx(inputCls, "mt-2")} value={f.kindOther} onChange={(e) => setF({ ...f, kindOther: e.target.value })} placeholder="House dedication" />}
        </Field>
        <Field label="Tell us about it"><textarea className={cx(inputCls, "min-h-24")} value={f.details} onChange={(e) => { setF({ ...f, details: e.target.value }); setErr(""); }} placeholder="The wedding of Ifeoma and Chidi. We'd be honoured to have the church celebrate with us." /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Time"><input type="time" className={inputCls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        </div>
        <Field label="Venue"><input className={inputCls} value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} placeholder="Church auditorium, then reception at…" /></Field>
        <Field label="Online link (optional)"><input className={inputCls} inputMode="url" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Who are you inviting?">
          <div className="grid grid-cols-2 gap-1.5">{AUDIENCE.map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, audience: k })} className={cx("min-h-11 rounded-xl px-2 text-sm ring-1", f.audience === k ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{l}</button>)}</div>
        </Field>
        <Field label="What would you like the church to do?" hint="Pick all that apply.">
          <div className="flex flex-wrap gap-1.5">{WANTS.map(([k, l]) => { const on = f.wants.includes(k); return <button type="button" key={k} onClick={() => setF({ ...f, wants: on ? f.wants.filter((x) => x !== k) : [...f.wants, k] })} className={chip(on)}>{l}</button>; })}</div>
          <input className={cx(inputCls, "mt-2")} value={f.wantsOther} onChange={(e) => setF({ ...f, wantsOther: e.target.value })} placeholder="Anything else you'd like us to know?" />
        </Field>
        <label className="flex items-center gap-3 rounded-xl bg-page p-3 text-[14px] ring-1 ring-line"><input type="checkbox" checked={f.announce} onChange={(e) => setF({ ...f, announce: e.target.checked })} className="size-5 accent-brand" />Please announce it in church</label>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Invitation card or flyer (optional)</span>
          {f.flyer ? <div className="relative w-fit"><img src={f.flyer} alt="Flyer" className="max-h-48 rounded-xl ring-1 ring-line" /><button type="button" onClick={() => setF({ ...f, flyer: "" })} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove flyer"><X size={14} /></button></div>
            : <Button onClick={() => file.current?.click()} disabled={busy}><ImagePlus size={15} /> {busy ? "Adding…" : "Add the card"}</Button>}
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; e.target.value = ""; if (!x) return; setBusy(true); try { setF((p) => ({ ...p, flyer: "" })); const url = await uploadImage(x, "flyer", 1200); setF((p) => ({ ...p, flyer: url })); } catch (er) { setErr(er instanceof Error ? er.message : "That picture didn't work."); } setBusy(false); }} />
        </div>
        <p className="text-[12.5px] text-muted">Only the pastorate and admin see this. They&apos;ll reach out to confirm.</p>
      </div>
    </Sheet>
  );
}

