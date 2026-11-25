"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Plus, UserPlus, Users, X } from "lucide-react";
import { PeopleAdder } from "@/components/people-adder";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Badge, Button, Empty, Field, PageHeader, Sheet, Tabs, cx, inputCls } from "@/components/ui";
import { COVERS } from "@/components/brand";
import { eventWhen } from "@/components/event-page";
import { STATE_BADGE, canCreateEvents, eventCounts, eventState } from "@/lib/domain";
import { addDays, at } from "@/lib/seed-more";
import { dayName, fullName, todayLagos } from "@/lib/format";
import type { ChurchEvent } from "@/lib/types";
import { themeOf } from "@/lib/events";
import { suggestedFaq } from "@/lib/event-page";
import { ColorField, LookPicker } from "@/components/event-editor-page";
import { uploadImage } from "@/lib/upload";
import { committeeRights } from "@/lib/event-mgmt";

export default function Events() {
  const { state, access, me, put, newId } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "drafts" | "past">("upcoming");
  const [making, setMaking] = useState(false);
  if (!access || !me) return null;
  const creator = canCreateEvents(access);
  const coOrg = (e: ChurchEvent) => e.coOrganisers.some((c) => c.status === "approved" && access.leads.has(c.groupId));
  const mine = (e: ChurchEvent) => creator || e.createdById === me.id || coOrg(e) || access.isPastoral || committeeRights(e, access).sees;
  const all = state.events.filter((e) => e.status === "published" || mine(e)).sort((a, b) => a.start.localeCompare(b.start));
  const list = all.filter((e) => { const s = eventState(e); return tab === "drafts" ? s === "draft" || s === "pending" : tab === "past" ? s === "past" : s === "upcoming" || s === "live"; });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Events" sub="Conferences, retreats and special services, each with its own page and registration." actions={creator && <Button variant="primary" onClick={() => setMaking(true)}><Plus size={16} /> New event</Button>} />
      <Tabs className="mb-5" value={tab} onChange={setTab} items={[
        { key: "upcoming", label: "Coming up", count: all.filter((e) => ["upcoming", "live"].includes(eventState(e))).length },
        ...(creator || access.isPastoral ? [{ key: "drafts" as const, label: "Drafts and approvals", count: all.filter((e) => ["draft", "pending"].includes(eventState(e))).length }] : []),
        { key: "past", label: "Past" },
      ]} />
      {list.length === 0 ? (
        <Empty title={tab === "upcoming" ? "No events coming up" : "Nothing here"} body="When an event is approved, it shows up here with its own page to share." icon={<CalendarDays size={26} />} action={creator && tab !== "past" && <Button variant="primary" onClick={() => setMaking(true)}>Create an event</Button>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {list.map((e) => {
            const s = eventState(e); const b = STATE_BADGE[s]; const c = eventCounts(state, e);
            return (
              <Link key={e.id} href={`/events/${e.id}`} className="card card-hover group overflow-hidden">
                <div className="relative h-40 p-5 text-white" style={{ background: e.flyer ? `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.7)), url(${e.flyer}) center/cover` : COVERS[e.cover % COVERS.length] }}>
                  <div className="absolute left-5 top-5 rounded-2xl bg-white/95 px-3 py-2 text-center text-on-light shadow-lg">
                    <p className="text-[11px] font-bold uppercase text-alert">{dayName(e.start, { month: "short" })}</p>
                    <p className="num text-2xl font-semibold leading-none">{dayName(e.start, { day: "numeric" })}</p>
                  </div>
                  <div className="absolute right-4 top-4"><Badge tone={b.tone}>{b.label}</Badge></div>
                  <p className="absolute bottom-4 left-5 right-5 font-display text-[26px] font-semibold leading-tight tracking-tight">{e.title}</p>
                </div>
                <div className="p-5">
                  <p className="line-clamp-1 text-[14.5px] text-ink-soft">{themeOf(e) || "No theme yet"}</p>
                  <div className="mt-3 flex items-center justify-between text-[13px] text-muted">
                    <span>{eventWhen(e)}{e.days.length > 1 ? ` · ${e.days.length} days` : ""}</span>
                    {e.status === "published" && <span className="flex items-center gap-1.5 font-medium text-ink"><Users size={14} /> {c.people}{e.capacity ? ` / ${e.capacity}` : ""}</span>}
                  </div>
                  {e.capacity && e.status === "published" && <div className="mt-3 h-1.5 rounded-full bg-page"><div className="h-full rounded-full bg-gradient-to-r from-brand to-glow" style={{ width: `${Math.min(100, (c.people / e.capacity) * 100)}%` }} /></div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {!creator && access.leads.size > 0 && <p className="mt-6 text-center text-[13px] text-muted">Want your department to help run an event? Open it and request to co-organise.</p>}
      <NewEvent open={making} onClose={() => setMaking(false)} />
    </div>
  );
}

/** Start an event: name, dates, the brief and targets, and (for the pastorate or admin) the committee. Everything else can come later. */
function NewEvent({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, me, access, put, newId } = useStore();
  const router = useRouter();
  const start = addDays(todayLagos(), 21);
  const [f, setF] = useState({ title: "", theme: "", from: start, to: start, time: "10:00", ends: "14:00", reg: true, description: "", goals: "", budget: "", target: "" });
  // Quick start: what and when → where → picture → look and colour
  const [step, setStep] = useState(0);
  const [more, setMore] = useState(false);
  const addr0 = state.church.profile?.address ?? "";
  const [where, setWhere] = useState({ mode: "physical" as ChurchEvent["mode"], venue: "Main auditorium", address: addr0, link: "" });
  const [pic, setPic] = useState<{ kind: "picture" | "flyer"; src?: string }>({ kind: "flyer" });
  const [busyPic, setBusyPic] = useState(false);
  const [look, setLook] = useState<NonNullable<ChurchEvent["template"]>>("flyer");
  const [main, setMain] = useState<string | undefined>(undefined);
  const churchColor = state.church.profile?.color ?? "#4f46e5";
  const [committee, setCommittee] = useState<string[]>([]);
  const [headId, setHeadId] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  if (!me || !access) return null;
  const appoints = access.isPastoral || access.isAdmin;
  const make = () => {
    if (f.title.trim().length < 3) return setErr("Give the event a name.");
    if (!f.from) return setErr("Choose the date it starts.");
    const to = f.to && f.to >= f.from ? f.to : f.from;
    const dates: string[] = []; for (let d = f.from; d <= to && dates.length < 14; d = addDays(d, 1)) dates.push(d);
    const now = new Date().toISOString();
    const e: ChurchEvent = {
      id: newId("ev"), slug: f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `event-${Date.now().toString(36).slice(-4)}`,
      title: f.title.trim(), tagline: "", theme: f.theme.trim(), description: f.description.trim(), cover: state.events.length % COVERS.length,
      start: at(dates[0], f.time), end: at(dates.at(-1)!, f.ends), days: dates, dayPlan: dates.map((d) => ({ date: d, start: f.time, end: f.ends })),
      mode: where.mode, link: where.mode !== "physical" ? where.link.trim() || undefined : undefined,
      template: look, regTypes: where.mode === "hybrid" ? ["individual", "online"] : where.mode === "virtual" ? ["online"] : ["individual"], registration: f.reg,
      flyer: pic.src, page: { media: pic.src ? { kind: pic.kind } : undefined, main },
      venue: where.mode !== "virtual" ? where.address.trim() || undefined : undefined,
      venues: where.mode !== "virtual" && (where.venue.trim() || where.address.trim()) ? [{ id: "v1", name: where.venue.trim() || "Main auditorium", address: where.address.trim() || undefined, directions: where.address.trim() === addr0 ? state.church.profile?.directions : undefined }] : [],
      people: [], speakers: [], schedule: [],
      contact: { name: `${state.church.name} guest services` },
      groupReg: false, needsApproval: false, followup: true, questions: [], status: "draft", createdById: me.id, coOrganisers: [], createdAt: now,
      goals: f.goals.trim() || undefined, targetBudget: Number(f.budget.replace(/\D/g, "")) || undefined, regTarget: Number(f.target.replace(/\D/g, "")) || undefined,
      committee: appoints && committee.length ? { members: committee.map((personId) => ({ personId, addedById: me.id, addedAt: now })), headId: headId || undefined, assistantId: assistantId || undefined, messages: [], meetings: [] } : undefined,
    };
    // Questions people usually ask, written from these settings; the organiser edits or deletes any
    e.faq = suggestedFaq(e);
    put("events", e, `started ${e.title}${e.committee ? ` and appointed a committee of ${committee.length}` : ""}`);
    onClose(); router.push(`/events/${e.id}${e.committee ? "?tab=committee" : ""}`);
  };
  const nameOf = (id: string) => fullName(state.people.find((p) => p.id === id));
  return (
    <Sheet open={open} onClose={onClose} title={["What and when", "Where", "Picture", "Look and colour"][step]} footer={<div className="space-y-2">
      {err && <p className="text-sm text-alert" role="alert">{err}</p>}
      <div className="flex items-center gap-1.5 pb-1" aria-label={`Step ${step + 1} of 4`}>{[0, 1, 2, 3].map((i) => <span key={i} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand" : "bg-line")} />)}</div>
      <div className="flex gap-2">
        {step > 0 && <Button className="flex-1 py-3" onClick={() => { setErr(""); setStep(step - 1); }}>Back</Button>}
        {step < 3 ? <Button variant="primary" className="flex-1 py-3" onClick={() => {
          if (step === 0) { if (f.title.trim().length < 3) return setErr("Give the event a name."); if (!f.from) return setErr("Choose the date it starts."); }
          if (step === 1 && where.mode !== "physical" && where.link.trim() && !/^https?:\/\//.test(where.link.trim())) return setErr("The online link should start with https://");
          setErr(""); setStep(step + 1);
        }}>Next</Button> : <Button variant="primary" className="flex-1 py-3" onClick={make}>Create the event</Button>}
      </div>
    </div>}>
      {step === 0 && (
      <div className="space-y-4">
        <Field label="Name"><input autoFocus className={inputCls} value={f.title} onChange={(e) => { setF({ ...f, title: e.target.value }); setErr(""); }} placeholder="Youth Conference 2027" /></Field>
        <Field label="Theme (optional)" hint="A short line, e.g. “Arise and Shine”. It sits under the title."><input className={inputCls} value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts"><input type="date" className={inputCls} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: f.to < e.target.value ? e.target.value : f.to })} /></Field>
          <Field label="Ends"><input type="date" className={inputCls} value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <Field label="From"><input type="time" className={inputCls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
          <Field label="Until"><input type="time" className={inputCls} value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} /></Field>
        </div>
        <Field label="Do people need to register?">
          <div className="grid grid-cols-2 gap-2">{([[true, "Yes"], [false, "No, they just come"]] as const).map(([v, l]) => (
            <button type="button" key={l} onClick={() => setF({ ...f, reg: v })} className={cx("min-h-11 rounded-xl px-3 text-sm ring-1", f.reg === v ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{l}</button>
          ))}</div>
        </Field>
        <button type="button" onClick={() => setMore(!more)} className="text-[14px] font-medium text-brand">{more ? "Hide" : "More (optional): brief, goals, budget, committee"}</button>
        {more && <div className="space-y-4">
        <Field label="Brief (optional)"><textarea rows={3} className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What the event is and who it's for" /></Field>
        <Field label="Goals and objectives (optional)"><textarea rows={2} className={inputCls} value={f.goals} onChange={(e) => setF({ ...f, goals: e.target.value })} placeholder="What success looks like" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target budget" hint="If known"><input inputMode="numeric" className={inputCls} value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Field>
          <Field label="Registration target" hint="e.g. 1,000"><input inputMode="numeric" className={inputCls} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
        </div>
        {appoints && (
          <Field label="Event committee (optional)" hint="Each person is notified and gets the committee page on their Home. The head can add more people later.">
            {committee.length > 0 && <ul className="mb-2 flex flex-wrap gap-1.5">{committee.map((id) => <li key={id} className="flex items-center gap-1 rounded-full bg-page px-3 py-1 text-[13px] ring-1 ring-line">{nameOf(id)}<button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => { setCommittee(committee.filter((x) => x !== id)); if (headId === id) setHeadId(""); if (assistantId === id) setAssistantId(""); }} className="text-muted"><X size={13} /></button></li>)}</ul>}
            <Button onClick={() => setAdding(true)}><UserPlus size={15} /> Appoint members</Button>
            {committee.length > 0 && <div className="mt-2 grid grid-cols-2 gap-2">
              <select aria-label="Committee head" className={inputCls} value={headId} onChange={(e) => setHeadId(e.target.value)}><option value="">Head…</option>{committee.filter((id) => id !== assistantId).map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}</select>
              <select aria-label="Assistant head" className={inputCls} value={assistantId} onChange={(e) => setAssistantId(e.target.value)}><option value="">Assistant…</option>{committee.filter((id) => id !== headId).map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}</select>
            </div>}
          </Field>
        )}
        </div>}
      </div>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <Field label="How will people attend?">
            <div className="grid grid-cols-3 gap-2">{([["physical", "In person"], ["hybrid", "Both"], ["virtual", "Online"]] as const).map(([v, l]) => (
              <button type="button" key={v} onClick={() => setWhere({ ...where, mode: v })} className={cx("min-h-11 rounded-xl px-2 text-sm ring-1", where.mode === v ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{l}</button>
            ))}</div>
          </Field>
          {where.mode !== "virtual" && <>
            <Field label="Venue"><input className={inputCls} value={where.venue} onChange={(e) => setWhere({ ...where, venue: e.target.value })} placeholder="Main auditorium" /></Field>
            <Field label="Address" hint="Used for the map and directions on the page."><input className={inputCls} value={where.address} onChange={(e) => setWhere({ ...where, address: e.target.value })} /></Field>
          </>}
          {where.mode !== "physical" && <Field label="Online link (optional for now)" hint="YouTube, Zoom, Facebook Live…"><input className={inputCls} value={where.link} onChange={(e) => { setWhere({ ...where, link: e.target.value }); setErr(""); }} placeholder="https://" /></Field>}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">{([["picture", "A photo", "Full-screen behind the title"], ["flyer", "A flyer", "Your designed flyer, beside the title"]] as const).map(([k2, l, d]) => (
            <button type="button" key={k2} onClick={() => setPic({ ...pic, kind: k2 })} className={cx("rounded-2xl p-3 text-left ring-1", pic.kind === k2 ? "bg-brand-soft ring-2 ring-brand" : "bg-page ring-line")}><b className="block text-[14px]">{l}</b><span className="text-[12px] text-muted">{d}</span></button>
          ))}</div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-page p-4 text-center text-[14px] text-muted ring-1 ring-dashed ring-line hover:ring-brand/40" style={{ minHeight: 180 }}>
            {busyPic ? "Uploading…" : pic.src ? <img src={pic.src} alt="" className={cx("max-h-64 rounded-xl", pic.kind === "picture" ? "w-full object-cover" : "object-contain")} /> : <><span className="font-medium text-brand">Choose a {pic.kind === "picture" ? "photo" : "flyer"}</span><span className="text-[12.5px]">{pic.kind === "picture" ? "Landscape and sharp works best." : "Portrait works best."}</span></>}
            <input type="file" accept="image/*" hidden onChange={async (x) => { const file = x.target.files?.[0]; if (!file) return; setBusyPic(true); try { setPic({ ...pic, src: await uploadImage(file, "flyer", 1800) }); } catch (y) { setErr(y instanceof Error ? y.message : "That picture didn't upload"); } setBusyPic(false); }} />
          </label>
          <p className="text-[13px] text-muted">No picture yet? Skip this. The look has its own background art, and you can add a picture, a carousel or a short video later.</p>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-5">
          <LookPicker e={{ ...({} as ChurchEvent), title: f.title, template: look, page: { main } }} churchColor={churchColor} onPick={setLook} />
          <div>
            <span className="mb-1.5 block text-sm font-medium">Main colour</span>
            <ColorField label="Main colour" value={main ?? churchColor} onChange={(v) => setMain(v)} />
            <p className="mt-1.5 text-[12.5px] text-muted">The church colour to start with. Paste any colour code. You can fine-tune colours later.</p>
          </div>
          <p className="rounded-xl bg-page px-3.5 py-3 text-[13.5px] text-ink-soft">We&apos;ll write the usual questions and answers for you. Add speakers, the programme and the rest whenever you&apos;re ready.</p>
        </div>
      )}
      <PeopleAdder open={adding} onClose={() => setAdding(false)} title="Appoint to the committee" exclude={committee} onAdd={(ids) => setCommittee([...new Set([...committee, ...ids])])} />
    </Sheet>
  );
}
