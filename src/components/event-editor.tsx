"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown, ArrowUp, BookOpen, CalendarDays, Check, ChevronDown, Eye, HelpCircle, Image as ImageIcon, LayoutTemplate, Link2, ListChecks, Loader2, MapPin, Plus,
  Settings2, Sparkles, Trash2, Upload, Users, X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Field, Toggle, cx, inputCls, toast } from "./ui";
import { COVERS } from "./brand";
import { uploadImage } from "@/lib/upload";
import { PERSON_LABELS, cleanOptions, daysOf, peopleOf, slugify, suggestQuestions, themeOf, withDayPlan } from "@/lib/events";
import type { ChurchEvent, EventDay, EventPerson, EventQuestion, EventVenue, QuestionType, RegType } from "@/lib/types";

const TYPES: { k: QuestionType; label: string }[] = [
  { k: "text", label: "Short answer" }, { k: "long", label: "Paragraph" }, { k: "choice", label: "One choice" }, { k: "multi", label: "Tick all that apply" },
  { k: "yesno", label: "Yes or no" }, { k: "number", label: "Number" }, { k: "date", label: "Date" }, { k: "phone", label: "Phone number" }, { k: "email", label: "Email" },
];
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
const nextDate = (d: string) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

type Sec = "basics" | "days" | "look" | "people" | "venues" | "registration" | "form" | "extras" | "options";
const SECTIONS: { k: Sec; label: string; icon: typeof BookOpen }[] = [
  { k: "basics", label: "Theme and about", icon: BookOpen }, { k: "days", label: "Days and programme", icon: CalendarDays },
  { k: "look", label: "Flyer and look", icon: LayoutTemplate }, { k: "people", label: "Speakers and ministers", icon: Users },
  { k: "venues", label: "Venues", icon: MapPin }, { k: "registration", label: "Registration and link", icon: Link2 },
  { k: "form", label: "Registration form", icon: ListChecks }, { k: "extras", label: "FAQ, gallery and more", icon: HelpCircle },
  { k: "options", label: "Check-in, feedback, reminders", icon: Settings2 },
];

/** Everything about an event in one place, a section at a time. */
export function EventEditor({ e: initial, onSave, onDelete, onPreview }: { e: ChurchEvent; onSave: (e: ChurchEvent) => void; onDelete?: () => void; onPreview: (e: ChurchEvent) => void }) {
  const { state } = useStore();
  const [e, setE] = useState<ChurchEvent>(() => ({ ...initial, theme: themeOf(initial), people: peopleOf(initial), dayPlan: daysOf(initial) }));
  const [open, setOpen] = useState<Sec>("basics");
  const set = <K extends keyof ChurchEvent>(k: K, v: ChurchEvent[K]) => setE((x) => ({ ...x, [k]: v }));
  const plan = e.dayPlan ?? [];
  const setPlan = (p: EventDay[]) => setE((x) => withDayPlan(x, p));
  const taken = new Set(state.events.filter((x) => x.id !== e.id).map((x) => x.slug));
  const slugOk = !!e.slug && !taken.has(e.slug);
  const changed = JSON.stringify(e) !== JSON.stringify(initial);

  const save = () => {
    if (!e.title.trim()) return toast("Give the event a title");
    if (!plan.length) return toast("Add at least one day");
    if (!slugOk) return toast("Choose a different link: another event already uses that one");
    const bad = plan.find((d) => d.end <= d.start);
    if (bad) return toast(`On ${bad.date}, the end time is before the start time`);
    const q = e.questions.find((x) => (x.type === "choice" || x.type === "multi") && cleanOptions(x.options ?? []).length < 2);
    if (q) return toast(`“${q.label || "A question"}” needs at least two choices`);
    onSave({ ...withDayPlan(e, plan), tagline: e.theme ?? e.tagline, speakers: (e.people ?? []).map((p) => ({ name: p.name, role: p.label })),
      questions: e.questions.filter((x) => x.label.trim()).map((x) => ({ ...x, label: x.label.trim(), options: x.options ? cleanOptions(x.options) : undefined })) });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav className="hidden space-y-1 lg:sticky lg:top-6 lg:block lg:self-start" aria-label="Event sections">
        {SECTIONS.map((s) => (
          <button key={s.k} onClick={() => { setOpen(s.k); document.getElementById(`sec-${s.k}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            className={cx("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px]", open === s.k ? "bg-surface font-medium shadow-sm ring-1 ring-line" : "text-ink-soft hover:bg-surface/60")}>
            <s.icon size={16} className={open === s.k ? "text-brand" : ""} />{s.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 space-y-3 pb-28">
        <Section k="basics" open={open} setOpen={setOpen}>
          <Field label="Title"><input className={cx(inputCls, "font-display text-lg font-semibold")} value={e.title} onChange={(x) => set("title", x.target.value)} placeholder="Rise: Youth Conference 2027" /></Field>
          <Field label="Theme" hint="The word for this year, e.g. “Arise and Shine”."><input className={inputCls} value={e.theme ?? ""} onChange={(x) => set("theme", x.target.value)} /></Field>
          <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
            <Field label="Bible verse (optional)"><textarea rows={2} className={inputCls} value={e.verse?.text ?? ""} onChange={(x) => set("verse", x.target.value.trim() ? { text: x.target.value, ref: e.verse?.ref ?? "" } : undefined)} placeholder="Arise, shine; for your light has come!" /></Field>
            <Field label="Reference"><input className={inputCls} value={e.verse?.ref ?? ""} onChange={(x) => set("verse", { text: e.verse?.text ?? "", ref: x.target.value })} placeholder="Isaiah 60:1" /></Field>
          </div>
          <Field label="About the event"><textarea className={cx(inputCls, "min-h-32")} value={e.description} onChange={(x) => set("description", x.target.value)} placeholder="What will happen, who it's for, and why they should come." /></Field>
        </Section>

        <Section k="days" open={open} setOpen={setOpen}>
          <div>
            <span className="mb-1.5 block text-sm font-medium">Where</span>
            <div className="grid grid-cols-3 gap-1.5">{(["physical", "virtual", "hybrid"] as const).map((m) => (
              <button key={m} type="button" onClick={() => set("mode", m)} className={cx("rounded-xl py-2.5 text-sm ring-1", e.mode === m ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{m === "physical" ? "In person" : m === "virtual" ? "Online" : "Both"}</button>
            ))}</div>
          </div>
          {e.mode !== "physical" && <Field label="Online link" hint="YouTube, Zoom or similar. Shown in “Happening now” and sent to people who register online."><input className={inputCls} value={e.link ?? ""} onChange={(x) => set("link", x.target.value)} placeholder="https://youtube.com/@yourchurch/live" /></Field>}
          <ol className="space-y-3">
            {plan.map((d, i) => (
              <li key={i} className="rounded-2xl bg-page p-4 ring-1 ring-line">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-deep px-2 py-1 text-[12px] font-semibold text-white">Day {i + 1}</span>
                  <input className={cx(inputCls, "flex-1 bg-surface")} value={d.title ?? ""} onChange={(x) => setPlan(plan.map((y, j) => (j === i ? { ...y, title: x.target.value || undefined } : y)))} placeholder="Name for the day (optional), e.g. Opening night" />
                  {plan.length > 1 && <button type="button" onClick={() => setPlan(plan.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Remove day ${i + 1}`}><Trash2 size={15} /></button>}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Field label="Date"><input type="date" className={cx(inputCls, "bg-surface")} value={d.date} onChange={(x) => setPlan(plan.map((y, j) => (j === i ? { ...y, date: x.target.value } : y)))} /></Field>
                  <Field label="Starts"><input type="time" className={cx(inputCls, "bg-surface")} value={d.start} onChange={(x) => setPlan(plan.map((y, j) => (j === i ? { ...y, start: x.target.value } : y)))} /></Field>
                  <Field label="Ends"><input type="time" className={cx(inputCls, "bg-surface")} value={d.end} onChange={(x) => setPlan(plan.map((y, j) => (j === i ? { ...y, end: x.target.value } : y)))} /></Field>
                </div>
                <Sessions day={d} people={e.people ?? []} venues={e.venues ?? []} checkin={!!e.sessionCheckin} onChange={(sessions) => setPlan(plan.map((y, j) => (j === i ? { ...y, sessions } : y)))} />
              </li>
            ))}
          </ol>
          <Button onClick={() => { const last = plan.at(-1); setPlan([...plan, last ? { date: nextDate(last.date), start: last.start, end: last.end } : { date: new Date().toISOString().slice(0, 10), start: "10:00", end: "14:00" }]); }}><Plus size={15} /> Add a day</Button>
        </Section>

        <Section k="look" open={open} setOpen={setOpen}>
          <span className="block text-sm font-medium">Page template</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {([["flyer", "Flyer", "Your flyer front and centre, details beside it"], ["bold", "Bold", "Night-of-worship feel: dark, big type, the line-up"], ["elegant", "Elegant", "Calm and warm, for conventions, carols, dinners"]] as const).map(([k, n, d]) => (
              <button key={k} type="button" onClick={() => set("template", k)} className={cx("overflow-hidden rounded-2xl text-left ring-1 transition", (e.template ?? "flyer") === k ? "ring-2 ring-brand" : "ring-line hover:ring-ink/20")}>
                <TemplateThumb k={k} e={e} />
                <span className="block p-3"><b className="flex items-center justify-between text-[14.5px]">{n}{(e.template ?? "flyer") === k && <Check size={15} className="text-brand" />}</b><span className="text-[12.5px] text-muted">{d}</span></span>
              </button>
            ))}
          </div>
          <ImagePick label="Flyer" hint="Your designed flyer. Portrait works best." value={e.flyer} kind="flyer" size={1600} onChange={(v) => set("flyer", v)} />
          {!e.flyer && (
            <div>
              <span className="mb-1.5 block text-sm font-medium">No flyer yet? Pick colours</span>
              <div className="grid grid-cols-6 gap-2">{COVERS.map((cv, i) => <button key={i} type="button" onClick={() => set("cover", i)} aria-label={`Colours ${i + 1}`} className={cx("aspect-square rounded-xl", e.cover === i && "ring-4 ring-brand/40 ring-offset-2")} style={{ background: cv }} />)}</div>
            </div>
          )}
        </Section>

        <Section k="people" open={open} setOpen={setOpen}>
          <PeopleEditor people={e.people ?? []} onChange={(v) => set("people", v)} />
        </Section>

        <Section k="venues" open={open} setOpen={setOpen}>
          {e.mode === "virtual" ? <p className="text-sm text-muted">This event is online only.</p> : (
            <VenueEditor venues={e.venues ?? (e.venue ? [{ id: "v1", name: e.venue }] : [])} onChange={(v) => setE((x) => ({ ...x, venues: v, venue: v[0] ? [v[0].name, v[0].address].filter(Boolean).join(", ") : undefined }))} />
          )}
        </Section>

        <Section k="registration" open={open} setOpen={setOpen}>
          <div>
            <span className="mb-1.5 block text-sm font-medium">Ways to register</span>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {([["individual", "Just me"], ["group", "Me and others"], ["online", "Online"]] as [RegType, string][]).filter(([k]) => k !== "online" || e.mode !== "physical").map(([k, l]) => {
                const cur = e.regTypes?.length ? e.regTypes : ["individual" as RegType];
                const on = cur.includes(k);
                return <button key={k} type="button" onClick={() => { const next = on ? cur.filter((x) => x !== k) : [...cur, k]; if (next.length) setE((x) => ({ ...x, regTypes: next, groupReg: next.includes("group") })); }} className={cx("flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ring-1", on ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>
                  <span className={cx("flex size-4.5 items-center justify-center rounded", on ? "bg-brand text-white" : "ring-1 ring-line")}>{on && <Check size={11} />}</span>{l}
                </button>;
              })}
            </div>
            <p className="mt-1.5 text-[12.5px] text-muted">With “Me and others”, each person gets their own ticket and answers the same questions.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Places" hint="Empty for no limit."><input inputMode="numeric" className={inputCls} value={e.capacity ?? ""} onChange={(x) => set("capacity", Number(x.target.value.replace(/\D/g, "")) || undefined)} /></Field>
            <Field label="Registration closes"><input type="date" className={inputCls} value={e.closesAt?.slice(0, 10) ?? ""} onChange={(x) => set("closesAt", x.target.value ? new Date(`${x.target.value}T23:59:00+01:00`).toISOString() : undefined)} /></Field>
          </div>
          <Field label="Link" hint={slugOk ? "Letters, numbers and dashes. Changing it after sharing breaks the old link." : "Another event already uses this link."}>
            <div className={cx("flex items-center overflow-hidden rounded-xl ring-1", slugOk ? "ring-line" : "ring-alert")}>
              <span className="shrink-0 bg-page px-3 py-2.5 text-[14px] text-muted">traqi.space/{state.church.slug}/</span>
              <input className="min-w-0 flex-1 bg-surface px-2 py-2.5 text-[15px] outline-none" value={e.slug} onChange={(x) => set("slug", slugify(x.target.value) || x.target.value.toLowerCase())} />
              <button type="button" onClick={() => set("slug", slugify(e.title))} className="shrink-0 px-3 text-[13px] font-medium text-brand">From title</button>
            </div>
          </Field>
          <div className="space-y-2">
            {([["needsApproval", "Approve each registration yourself"], ["followup", "Send people new to the church to follow-up"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line">{l}<Toggle label={l} on={!!e[k]} onChange={(v) => set(k, v)} /></label>
            ))}
          </div>
        </Section>

        <Section k="form" open={open} setOpen={setOpen}>
          <FormBuilder e={e} questions={e.questions} onChange={(q) => set("questions", q)} />
        </Section>

        <Section k="extras" open={open} setOpen={setOpen}>
          <p className="text-[13.5px] text-muted">All optional. Anything you leave empty doesn&apos;t show. Your media team can fill these in.</p>
          <PairList title="Frequently asked questions" items={(e.faq ?? []).map((f) => [f.q, f.a])} labels={["Question", "Answer"]} long onChange={(v) => set("faq", v.length ? v.map(([q, a]) => ({ q, a })) : undefined)}
            ideas={[["Is it free?", "Yes. Registration is free."], ["Can I bring my children?", ""], ["Is there parking?", ""], ["Will it be streamed online?", ""], ["What should I wear?", ""]]} />
          <Gallery images={e.gallery ?? []} onChange={(g) => set("gallery", g.length ? g : undefined)} />
          <PairList title="Where to stay (for people coming from far)" items={(e.stay ?? []).map((s) => [s.name, s.note ?? "", s.url ?? "", s.phone ?? ""])} labels={["Name", "Note", "Booking link", "Phone"]} onChange={(v) => set("stay", v.length ? v.map(([name, note, url, phone]) => ({ name, note: note || undefined, url: url || undefined, phone: phone || undefined })) : undefined)} />
          <div className="rounded-2xl bg-page p-4 ring-1 ring-line">
            <p className="mb-2 text-sm font-medium">Give button</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={cx(inputCls, "bg-surface")} placeholder="Label, e.g. Support Rise" value={e.give?.label ?? ""} onChange={(x) => set("give", { ...e.give, label: x.target.value || undefined })} />
              <input className={cx(inputCls, "bg-surface")} placeholder="Online giving link (optional)" value={e.give?.url ?? ""} onChange={(x) => set("give", { ...e.give, url: x.target.value || undefined })} />
              <input className={cx(inputCls, "bg-surface")} placeholder="Bank" value={e.give?.bank ?? ""} onChange={(x) => set("give", { ...e.give, bank: x.target.value || undefined })} />
              <input className={cx(inputCls, "bg-surface")} placeholder="Account number" inputMode="numeric" value={e.give?.account ?? ""} onChange={(x) => set("give", { ...e.give, account: x.target.value.replace(/\D/g, "") || undefined })} />
              <input className={cx(inputCls, "bg-surface sm:col-span-2")} placeholder="Account name" value={e.give?.accountName ?? ""} onChange={(x) => set("give", { ...e.give, accountName: x.target.value || undefined })} />
            </div>
          </div>
          <div className="rounded-2xl bg-page p-4 ring-1 ring-line">
            <p className="mb-2 text-sm font-medium">Guest services contact</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["name", "phone", "whatsapp", "email"] as const).map((k) => <input key={k} className={cx(inputCls, "bg-surface")} placeholder={{ name: "Team name, e.g. Rise guest services", phone: "Phone", whatsapp: "WhatsApp number", email: "Email" }[k]} value={e.contact?.[k] ?? ""} onChange={(x) => set("contact", { ...e.contact, [k]: x.target.value || undefined })} />)}
            </div>
          </div>
          <div className="rounded-2xl bg-page p-4 ring-1 ring-line">
            <label className="flex items-center justify-between gap-3 text-sm"><span><b className="font-medium">Partner logos</b><span className="block text-[12.5px] text-muted">Off unless you switch it on</span></span><Toggle label="Show partner logos" on={!!e.showPartners} onChange={(v) => set("showPartners", v)} /></label>
            {e.showPartners && <Partners items={e.partners ?? []} onChange={(p) => set("partners", p)} />}
          </div>
        </Section>

        <Section k="options" open={open} setOpen={setOpen}>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-page p-3 text-sm ring-1 ring-line"><span><b className="font-medium">Check in to each session</b><span className="block text-[12.5px] text-muted">Ushers check people into sessions, not just the day</span></span><Toggle label="Session check-in" on={!!e.sessionCheckin} onChange={(v) => set("sessionCheckin", v)} /></label>
          <div className="rounded-xl bg-page p-3 ring-1 ring-line">
            <label className="flex items-center justify-between gap-3 text-sm"><span><b className="font-medium">Feedback form after the event</b><span className="block text-[12.5px] text-muted">Appears on the event page when it ends</span></span>
              <Toggle label="Feedback form" on={!!e.feedback?.on} onChange={(v) => set("feedback", { on: v, questions: e.feedback?.questions?.length ? e.feedback.questions : [{ id: "f1", label: "How would you rate it?", type: "choice", options: ["Excellent", "Good", "Okay", "Poor"] }, { id: "f2", label: "What blessed you most?", type: "long" }] })} /></label>
            {e.feedback?.on && <div className="mt-3"><FormBuilder e={e} questions={e.feedback.questions} onChange={(q) => set("feedback", { on: true, questions: q })} compact /></div>}
          </div>
          <div className="rounded-xl bg-page p-3 ring-1 ring-line">
            <p className="text-sm font-medium">Reminders to people who registered</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["email", "whatsapp"] as const).map((k) => (
                <label key={k} className="flex items-center justify-between gap-2 rounded-xl bg-surface p-2.5 text-sm ring-1 ring-line">{k === "email" ? "Email" : "WhatsApp message"}<Toggle label={`${k} reminders`} on={!!e.reminders?.[k]} onChange={(v) => set("reminders", { email: e.reminders?.email ?? false, whatsapp: e.reminders?.whatsapp ?? false, daysBefore: e.reminders?.daysBefore ?? [1], [k]: v })} /></label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">{[7, 3, 1].map((n) => { const on = (e.reminders?.daysBefore ?? [1]).includes(n); return (
              <button key={n} type="button" onClick={() => { const cur = e.reminders?.daysBefore ?? [1]; set("reminders", { email: e.reminders?.email ?? false, whatsapp: e.reminders?.whatsapp ?? false, daysBefore: on ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => b - a) }); }}
                className={cx("rounded-full px-3 py-1.5 text-[13px] ring-1", on ? "bg-deep text-white ring-deep" : "bg-surface ring-line")}>{n === 1 ? "The day before" : `${n} days before`}</button>
            ); })}</div>
            <p className="mt-2 text-[12.5px] text-muted">Emails go out once email sending is switched on. WhatsApp reminders are prepared for you to send from the event&apos;s Share tab.</p>
          </div>
        </Section>
      </div>

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-[64px] z-30 border-t border-line bg-surface/92 px-4 py-3 backdrop-blur md:bottom-0 md:left-[272px]">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <p className="hidden flex-1 text-[13px] text-muted sm:block">{changed ? "Unsaved changes" : "All saved"} · Changing the dates or venue of a published event sends it back to a pastor.</p>
          {onDelete && <Button variant="ghost" className="text-alert" onClick={onDelete}><Trash2 size={15} /> Delete</Button>}
          <Button onClick={() => onPreview(withDayPlan(e, plan))}><Eye size={15} /> Preview</Button>
          <Button variant="primary" className="flex-1 sm:flex-none" onClick={save}><Check size={16} /> Save event</Button>
        </div>
      </div>
    </div>
  );
}

function Section({ k, open, setOpen, children }: { k: Sec; open: Sec; setOpen: (s: Sec) => void; children: ReactNode }) {
  const s = SECTIONS.find((x) => x.k === k)!;
  const isOpen = open === k;
  return (
    <section id={`sec-${k}`} className="card scroll-mt-20 overflow-hidden p-0">
      <button type="button" onClick={() => setOpen(isOpen ? ("" as Sec) : k)} className="flex w-full items-center gap-3 px-5 py-4 text-left" aria-expanded={isOpen}>
        <span className={cx("flex size-9 items-center justify-center rounded-xl", isOpen ? "bg-brand text-white" : "bg-page text-ink-soft ring-1 ring-line")}><s.icon size={17} /></span>
        <span className="flex-1 font-display text-[16.5px] font-semibold">{s.label}</span>
        <ChevronDown size={18} className={cx("text-muted transition", isOpen && "rotate-180")} />
      </button>
      {isOpen && <div className="space-y-4 border-t border-line px-5 py-5">{children}</div>}
    </section>
  );
}

function TemplateThumb({ k, e }: { k: "flyer" | "bold" | "elegant"; e: ChurchEvent }) {
  const bg = COVERS[e.cover % COVERS.length];
  if (k === "bold") return <div className="flex h-24 flex-col justify-end bg-[#0b0a12] p-3" style={{ backgroundImage: "radial-gradient(120px 80px at 90% 0%, var(--color-brand), transparent 70%)" }}><span className="h-2 w-3/4 rounded bg-white" /><span className="mt-1 h-2 w-1/2 rounded bg-white/70" /><span className="mt-2 flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="size-3 rounded-full bg-white/50" />)}</span></div>;
  if (k === "elegant") return <div className="flex h-24 flex-col items-center justify-center bg-[#fbf8f2]"><span className="h-px w-8 bg-brand/50" /><span className="mt-2 h-2.5 w-24 rounded bg-[#1f1a14]" /><span className="mt-1.5 h-1.5 w-16 rounded bg-[#1f1a14]/40" /><span className="mt-2 h-px w-8 bg-brand/50" /></div>;
  return <div className="flex h-24 items-center gap-2 bg-[#f7f6fb] p-3"><span className="h-full w-14 -rotate-2 rounded-md shadow" style={e.flyer ? { background: `url(${e.flyer}) center/cover` } : { background: bg }} /><span className="flex-1 space-y-1.5"><span className="block h-2 w-full rounded bg-[#17151f]" /><span className="block h-1.5 w-2/3 rounded bg-[#17151f]/40" /><span className="block h-3 w-12 rounded-full bg-brand" /></span></div>;
}

function ImagePick({ label, hint, value, kind, size, onChange, round }: { label: string; hint?: string; value?: string; kind: "flyer" | "speaker" | "logo"; size: number; onChange: (v?: string) => void; round?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => { if (!f) return; setBusy(true); try { onChange(await uploadImage(f, kind, size)); } catch (x) { toast(x instanceof Error ? x.message : "That picture didn't upload"); } setBusy(false); };
  return (
    <div>
      {label && <span className="mb-1.5 block text-sm font-medium">{label}</span>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => ref.current?.click()} className={cx("relative flex shrink-0 items-center justify-center overflow-hidden bg-page text-muted ring-1 ring-line hover:ring-brand/40", round ? "size-16 rounded-full" : "h-28 w-22 rounded-xl")}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <Upload size={18} />}
        </button>
        <div className="min-w-0 text-[13px] text-muted">
          {hint && <p>{hint}</p>}
          <div className="mt-1 flex gap-3 font-medium"><button type="button" className="text-brand" onClick={() => ref.current?.click()}>{value ? "Change" : "Upload"}</button>{value && <button type="button" className="text-alert" onClick={() => onChange(undefined)}>Remove</button>}</div>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(x) => { void pick(x.target.files?.[0]); x.target.value = ""; }} />
    </div>
  );
}

function Sessions({ day, people, venues, checkin, onChange }: { day: EventDay; people: EventPerson[]; venues: EventVenue[]; checkin: boolean; onChange: (s: EventDay["sessions"]) => void }) {
  const list = day.sessions ?? [];
  const upd = (i: number, patch: Partial<NonNullable<EventDay["sessions"]>[number]>) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="mt-3">
      {list.length > 0 && <p className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-wider text-muted">Sessions</p>}
      <ul className="space-y-2">
        {list.map((s, i) => (
          <li key={s.id} className="rounded-xl bg-surface p-2.5 ring-1 ring-line">
            <div className="flex flex-wrap gap-1.5">
              <input type="time" className={cx(inputCls, "w-28")} value={s.start} onChange={(x) => upd(i, { start: x.target.value })} aria-label="Starts" />
              <input type="time" className={cx(inputCls, "w-28")} value={s.end ?? ""} onChange={(x) => upd(i, { end: x.target.value || undefined })} aria-label="Ends" />
              <input className={cx(inputCls, "min-w-40 flex-1")} value={s.title} onChange={(x) => upd(i, { title: x.target.value })} placeholder="Praise and worship" />
              <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="rounded-lg px-2 text-muted hover:bg-page" aria-label="Remove session"><X size={15} /></button>
            </div>
            {(people.length > 0 || venues.length > 1) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {people.map((p) => { const on = s.personIds?.includes(p.id); return <button key={p.id} type="button" onClick={() => upd(i, { personIds: on ? s.personIds!.filter((x) => x !== p.id) : [...(s.personIds ?? []), p.id] })} className={cx("rounded-full px-2.5 py-1 text-[12px] ring-1", on ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page text-ink-soft ring-line")}>{p.name}</button>; })}
                {venues.length > 1 && <select className="rounded-full bg-page px-2.5 py-1 text-[12px] ring-1 ring-line" value={s.venueId ?? ""} onChange={(x) => upd(i, { venueId: x.target.value || undefined })}><option value="">Main venue</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>}
                {checkin && <label className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">Check-in<Toggle label="Check in to this session" on={s.checkin !== false} onChange={(v) => upd(i, { checkin: v })} /></label>}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onChange([...list, { id: uid("s"), start: list.at(-1)?.end ?? day.start, title: "" }])} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand"><Plus size={14} /> Add a session</button>
    </div>
  );
}

function PeopleEditor({ people, onChange }: { people: EventPerson[]; onChange: (p: EventPerson[]) => void }) {
  const upd = (i: number, patch: Partial<EventPerson>) => onChange(people.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const [custom, setCustom] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {people.map((p, i) => (
        <div key={p.id} className="rounded-2xl bg-page p-4 ring-1 ring-line">
          <div className="flex gap-3">
            <ImagePick label="" value={p.photo} kind="speaker" size={600} round onChange={(v) => upd(i, { photo: v })} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-2">
                <input className={cx(inputCls, "flex-1 bg-surface")} value={p.name} onChange={(x) => upd(i, { name: x.target.value })} placeholder="Name, e.g. Pastor Ade Bello" />
                <button type="button" onClick={() => onChange(people.filter((_, j) => j !== i))} className="rounded-lg px-2 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Remove ${p.name || "person"}`}><Trash2 size={15} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PERSON_LABELS.map((l) => <button key={l} type="button" onClick={() => { upd(i, { label: l }); setCustom(null); }} className={cx("rounded-full px-2.5 py-1 text-[12.5px] ring-1", p.label === l ? "bg-deep text-white ring-deep" : "bg-surface text-ink-soft ring-line")}>{l}</button>)}
                {custom === i || !PERSON_LABELS.includes(p.label) ? <input autoFocus={custom === i} className="w-36 rounded-full bg-surface px-3 py-1 text-[12.5px] ring-1 ring-brand outline-none" value={PERSON_LABELS.includes(p.label) ? "" : p.label} onChange={(x) => upd(i, { label: x.target.value })} placeholder="Your own label" />
                  : <button type="button" onClick={() => setCustom(i)} className="rounded-full px-2.5 py-1 text-[12.5px] text-brand border border-dashed border-brand/50">+ Own label</button>}
              </div>
              <input className={cx(inputCls, "bg-surface")} value={p.from ?? ""} onChange={(x) => upd(i, { from: x.target.value || undefined })} placeholder="Church or organisation (optional)" />
              <textarea rows={2} className={cx(inputCls, "bg-surface")} value={p.bio ?? ""} onChange={(x) => upd(i, { bio: x.target.value || undefined })} placeholder="A short bio (optional)" />
            </div>
          </div>
        </div>
      ))}
      <Button onClick={() => onChange([...people, { id: uid("pp"), name: "", label: people.length ? "Music minister" : "Speaker" }])}><Plus size={15} /> Add a person</Button>
    </div>
  );
}

function VenueEditor({ venues, onChange }: { venues: EventVenue[]; onChange: (v: EventVenue[]) => void }) {
  const upd = (i: number, patch: Partial<EventVenue>) => onChange(venues.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div className="space-y-3">
      {venues.map((v, i) => (
        <div key={v.id} className="space-y-2 rounded-2xl bg-page p-4 ring-1 ring-line">
          <div className="flex gap-2">
            <input className={cx(inputCls, "flex-1 bg-surface")} value={v.name} onChange={(x) => upd(i, { name: x.target.value })} placeholder={i === 0 ? "Main auditorium" : "Overflow hall"} />
            <button type="button" onClick={() => onChange(venues.filter((_, j) => j !== i))} className="rounded-lg px-2 text-muted hover:bg-alert-soft hover:text-alert" aria-label="Remove venue"><Trash2 size={15} /></button>
          </div>
          <input className={cx(inputCls, "bg-surface")} value={v.address ?? ""} onChange={(x) => upd(i, { address: x.target.value || undefined })} placeholder="Address" />
          <textarea rows={2} className={cx(inputCls, "bg-surface")} value={v.directions ?? ""} onChange={(x) => upd(i, { directions: x.target.value || undefined })} placeholder="Directions, e.g. Enter through Gate B; parking opposite" />
          <div className="flex flex-wrap items-center gap-2">
            <input className={cx(inputCls, "min-w-48 flex-1 bg-surface")} value={v.mapUrl ?? ""} onChange={(x) => upd(i, { mapUrl: x.target.value || undefined })} placeholder="Google Maps link (optional)" />
            <label className="flex items-center gap-2 text-[13px]">Overflow<Toggle label="Overflow venue" on={!!v.overflow} onChange={(o) => upd(i, { overflow: o })} /></label>
          </div>
        </div>
      ))}
      <Button onClick={() => onChange([...venues, { id: uid("v"), name: "" }])}><Plus size={15} /> Add a venue</Button>
    </div>
  );
}

/** A Google Forms-style builder: question types, choices one per line, required, and suggestions. */
function FormBuilder({ e, questions, onChange, compact }: { e: ChurchEvent; questions: EventQuestion[]; onChange: (q: EventQuestion[]) => void; compact?: boolean }) {
  const ideas = useMemo(() => (compact ? [] : suggestQuestions(e, questions)), [e, questions, compact]);
  const upd = (i: number, patch: Partial<EventQuestion>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) => { const n = [...questions]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };
  return (
    <div className="space-y-3">
      {!compact && <p className="text-[13.5px] text-muted">Name and phone number are always asked. Add anything else here.</p>}
      {ideas.length > 0 && (
        <div className="rounded-2xl bg-brand-soft/50 p-3 ring-1 ring-brand/20">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-brand"><Sparkles size={14} /> Suggested for {e.title || "this event"}</p>
          <div className="flex flex-wrap gap-1.5">{ideas.map((s) => (
            <button key={s.id} type="button" onClick={() => onChange([...questions, { id: uid("q"), label: s.label, type: s.type, options: s.options, perPerson: s.perPerson }])} className="rounded-full bg-surface px-3 py-1.5 text-[13px] ring-1 ring-line hover:ring-brand/50" title={s.why}>
              <Plus size={12} className="mr-1 inline text-brand" />{s.label}
            </button>
          ))}</div>
        </div>
      )}
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-2xl bg-page p-4 ring-1 ring-line">
          <div className="flex gap-2">
            <input className={cx(inputCls, "flex-1 bg-surface font-medium")} value={q.label} onChange={(x) => upd(i, { label: x.target.value })} placeholder="Question" />
            <select className={cx(inputCls, "w-40 bg-surface")} value={q.type} onChange={(x) => { const t = x.target.value as QuestionType; upd(i, { type: t, options: t === "choice" || t === "multi" ? (q.options?.length ? q.options : ["", ""]) : undefined }); }}>
              {TYPES.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
            </select>
          </div>
          {(q.type === "choice" || q.type === "multi") && (
            <div className="mt-2 space-y-1.5">
              {(q.options ?? []).map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className={cx("size-4 shrink-0 ring-2 ring-line", q.type === "multi" ? "rounded" : "rounded-full")} />
                  <input className={cx(inputCls, "flex-1 bg-surface py-2")} value={o} placeholder={`Choice ${k + 1}`}
                    onChange={(x) => upd(i, { options: (q.options ?? []).map((y, j) => (j === k ? x.target.value : y)) })}
                    onKeyDown={(x) => { if (x.key === "Enter") { x.preventDefault(); upd(i, { options: [...(q.options ?? []), ""] }); } }}
                    onPaste={(x) => { const t = x.clipboardData.getData("text"); if (t.includes("\n")) { x.preventDefault(); const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean); const cur = [...(q.options ?? [])]; cur.splice(k, 1, ...lines); upd(i, { options: cur }); } }} />
                  <button type="button" onClick={() => upd(i, { options: (q.options ?? []).filter((_, j) => j !== k) })} className="rounded-lg p-1.5 text-muted hover:bg-surface" aria-label="Remove choice"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => upd(i, { options: [...(q.options ?? []), ""] })} className="ml-6 text-[13px] font-medium text-brand">+ Add a choice</button>
              <p className="ml-6 text-[12px] text-muted">Each choice on its own line, so commas inside a choice are fine. Pasting a list fills several at once.</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[13px]">
            <label className="flex items-center gap-2">Required<Toggle label="Required" on={!!q.required} onChange={(v) => upd(i, { required: v })} /></label>
            <input className="min-w-40 flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-[13px] ring-1 ring-line outline-none" value={q.help ?? ""} onChange={(x) => upd(i, { help: x.target.value || undefined })} placeholder="Help text (optional)" />
            <span className="ml-auto flex gap-0.5">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg p-1.5 text-muted hover:bg-surface disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button>
              <button type="button" disabled={i === questions.length - 1} onClick={() => move(i, 1)} className="rounded-lg p-1.5 text-muted hover:bg-surface disabled:opacity-30" aria-label="Move down"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => onChange(questions.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-muted hover:bg-alert-soft hover:text-alert" aria-label="Delete question"><Trash2 size={14} /></button>
            </span>
          </div>
        </div>
      ))}
      <Button onClick={() => onChange([...questions, { id: uid("q"), label: "", type: "text" }])}><Plus size={15} /> Add a question</Button>
    </div>
  );
}

function PairList({ title, items, labels, onChange, long, ideas }: { title: string; items: string[][]; labels: string[]; onChange: (v: string[][]) => void; long?: boolean; ideas?: string[][] }) {
  const unused = (ideas ?? []).filter((x) => !items.some((y) => y[0] === x[0]));
  return (
    <div className="rounded-2xl bg-page p-4 ring-1 ring-line">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="space-y-2">{items.map((it, i) => (
        <div key={i} className="flex gap-1.5">
          <div className={cx("grid flex-1 gap-1.5", labels.length > 2 ? "sm:grid-cols-2" : long ? "" : "sm:grid-cols-2")}>
            {labels.map((l, k) => long && k === 1
              ? <textarea key={k} rows={2} className={cx(inputCls, "bg-surface")} value={it[k] ?? ""} placeholder={l} onChange={(x) => onChange(items.map((y, j) => (j === i ? y.map((z, m) => (m === k ? x.target.value : z)) : y)))} />
              : <input key={k} className={cx(inputCls, "bg-surface")} value={it[k] ?? ""} placeholder={l} onChange={(x) => onChange(items.map((y, j) => (j === i ? labels.map((_, m) => (m === k ? x.target.value : y[m] ?? "")) : y)))} />)}
          </div>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="self-start rounded-lg p-2.5 text-muted hover:bg-surface" aria-label="Remove"><X size={15} /></button>
        </div>
      ))}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => onChange([...items, labels.map(() => "")])} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand"><Plus size={14} /> Add</button>
        {unused.slice(0, 4).map((x) => <button key={x[0]} type="button" onClick={() => onChange([...items, labels.map((_, k) => x[k] ?? "")])} className="rounded-full bg-surface px-2.5 py-1 text-[12px] text-ink-soft ring-1 ring-line hover:text-ink">{x[0]}</button>)}
      </div>
    </div>
  );
}

function Gallery({ images, onChange }: { images: string[]; onChange: (g: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    const out: string[] = [];
    for (const f of Array.from(files).slice(0, 12)) { try { out.push(await uploadImage(f, "flyer", 1400)); } catch { /* skip */ } }
    onChange([...images, ...out]); setBusy(false);
  };
  return (
    <div className="rounded-2xl bg-page p-4 ring-1 ring-line">
      <p className="mb-2 text-sm font-medium">Gallery: photos from past editions</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {images.map((g, i) => <div key={i} className="group relative aspect-square overflow-hidden rounded-xl"><img src={g} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100" aria-label="Remove photo"><X size={12} /></button></div>)}
        <button type="button" onClick={() => ref.current?.click()} className="flex aspect-square items-center justify-center rounded-xl bg-surface text-muted border border-dashed border-line hover:text-brand">{busy ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}</button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(x) => { void add(x.target.files); x.target.value = ""; }} />
    </div>
  );
}

function Partners({ items, onChange }: { items: { name: string; logo?: string }[]; onChange: (p: { name: string; logo?: string }[]) => void }) {
  return (
    <div className="mt-3 space-y-2">
      {items.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <ImagePick label="" value={p.logo} kind="logo" size={400} round onChange={(v) => onChange(items.map((x, j) => (j === i ? { ...x, logo: v } : x)))} />
          <input className={cx(inputCls, "flex-1 bg-surface")} value={p.name} onChange={(x) => onChange(items.map((y, j) => (j === i ? { ...y, name: x.target.value } : y)))} placeholder="Partner name" />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:bg-surface" aria-label="Remove partner"><X size={15} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { name: "" }])} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand"><Plus size={14} /> Add a partner</button>
    </div>
  );
}
