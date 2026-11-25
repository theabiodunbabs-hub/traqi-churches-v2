"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, FileImage, Film, Pipette, Sparkles, GalleryHorizontal, Image as ImageIcon, Link2, Loader2, Lock, Plus, Trash2, Upload, X } from "lucide-react";
import { Field, Toggle, cx, inputCls, toast } from "./ui";
import { uploadEventFile } from "@/lib/upload";
import { copyText } from "@/lib/share";
import { EXPERIENCE_IDEAS, LOOKS, MAX_EXTRAS, paletteFrom, templateOf, ticketColorOf, MAX_VIDEO_MB, PALETTES, colorsFromImage, colorsOf, contrastWarnings, lookOf, newToken, parseColor, textOn } from "@/lib/event-page";
import type { ChurchEvent, EventColors, EventLook, EventPage, EventQuestion, TicketCategory } from "@/lib/types";

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

/** Pick a picture or video for this event page. */
function useUpload(eventId: string) {
  const [busy, setBusy] = useState(false);
  const run = async (f: File | undefined, done: (url: string) => void) => {
    if (!f) return;
    setBusy(true);
    try { done(await uploadEventFile(f, eventId)); } catch (x) { toast(x instanceof Error ? x.message : "That didn't upload"); }
    setBusy(false);
  };
  return { busy, run };
}

function UploadTile({ label, accept, eventId, onDone, children, className }: { label: string; accept: string; eventId: string; onDone: (url: string) => void; children?: ReactNode; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const { busy, run } = useUpload(eventId);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} aria-label={label} className={cx("flex flex-col items-center justify-center gap-1 rounded-2xl bg-page text-[12.5px] text-muted ring-1 ring-dashed ring-line hover:ring-brand/40", className)}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : children ?? <><Upload size={18} />{label}</>}
      </button>
      <input ref={ref} type="file" accept={accept} hidden onChange={(x) => { void run(x.target.files?.[0], onDone); x.target.value = ""; }} />
    </>
  );
}

// ---------------- Headline: flyer, video or carousel ----------------
export function HeadlineEditor({ e, setPage, flyerPick }: { e: ChurchEvent; setPage: (p: Partial<EventPage>) => void; flyerPick: ReactNode }) {
  const m = e.page?.media ?? { kind: "flyer" as const };
  const kinds = [
    { k: "picture" as const, label: "Picture", body: "One photo, full-screen behind the title", icon: ImageIcon },
    { k: "flyer" as const, label: "Flyer", body: "Your designed flyer, beside the title", icon: FileImage },
    { k: "carousel" as const, label: "Carousel", body: "Pictures that change by themselves", icon: GalleryHorizontal },
    { k: "video" as const, label: "Video", body: `Short clip, up to ${MAX_VIDEO_MB} MB`, icon: Film },
  ];
  const slides = m.slides ?? [];
  return (
    <div className="space-y-3">
      <span className="block text-sm font-medium">Headline</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{kinds.map((x) => (
        <button key={x.k} type="button" onClick={() => setPage({ media: { ...m, kind: x.k } })} className={cx("flex flex-col items-start rounded-2xl p-3 text-left ring-1 transition", m.kind === x.k ? "bg-brand-soft ring-2 ring-brand" : "bg-page ring-line hover:ring-ink/20")}>
          <x.icon size={18} className={m.kind === x.k ? "text-brand" : "text-muted"} />
          <b className="mt-1.5 block text-[14px]">{x.label}</b><span className="text-[12px] text-muted">{x.body}</span>
        </button>
      ))}</div>
      {(m.kind === "flyer" || m.kind === "picture") && flyerPick}
      {m.kind === "video" && (
        <div className="flex items-center gap-3">
          {m.video ? <video src={m.video} muted loop autoPlay playsInline className="h-28 w-24 rounded-xl bg-black object-cover" /> : null}
          <UploadTile label={m.video ? "Change video" : "Upload video"} accept="video/mp4,video/webm,video/quicktime" eventId={e.id} className="h-28 w-28" onDone={(video) => setPage({ media: { ...m, kind: "video", video } })} />
          <div className="min-w-0 text-[12.5px] text-muted">
            <p>MP4 works best. Up to {MAX_VIDEO_MB} MB: about 15 to 30 seconds. It plays silently on a loop behind the title.</p>
            <p className="mt-1">The flyer below is shown while it loads.</p>
            {m.video && <button type="button" className="mt-1 font-medium text-alert" onClick={() => setPage({ media: { ...m, video: undefined } })}>Remove video</button>}
          </div>
        </div>
      )}
      {m.kind === "video" && flyerPick}
      {m.kind === "carousel" && (
        <div>
          <div className="flex flex-wrap gap-2">
            {slides.map((src, i) => (
              <div key={i} className="group relative h-28 w-22 overflow-hidden rounded-xl ring-1 ring-line">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPage({ media: { ...m, slides: slides.filter((_, j) => j !== i) } })} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove picture"><X size={12} /></button>
              </div>
            ))}
            {slides.length < 8 && <UploadTile label="Add picture" accept="image/*" eventId={e.id} className="h-28 w-22" onDone={(u) => setPage({ media: { ...m, kind: "carousel", slides: [...slides, u] } })} />}
          </div>
          <p className="mt-2 text-[12.5px] text-muted">Up to 8 pictures. Portrait works best.</p>
        </div>
      )}
      <p className="rounded-xl bg-page px-3 py-2 text-[12.5px] text-muted ring-1 ring-line">Videos and pictures uploaded here are removed 14 days after the event, to save space. You&apos;ll get a notice first. Registrations stay.</p>
    </div>
  );
}

// ---------------- Colours ----------------
const RECENT = "traqi-recent-colors";
const recent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT) || "[]"); } catch { return []; } };
const addRecent = (c: string) => { try { localStorage.setItem(RECENT, JSON.stringify([c, ...recent().filter((x) => x !== c)].slice(0, 8))); } catch { /* storage unavailable */ } };

/** One colour: a swatch to pick from, and a box to type or paste any colour code (#7C3AED, rgb(…), hsl(…)). */
export function ColorField({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string | undefined) => void; placeholder?: string }) {
  const [text, setText] = useState(value ?? "");
  const [bad, setBad] = useState(false);
  const shown = value ?? placeholder ?? "#888888";
  useEffect(() => { setText(value ?? ""); setBad(false); }, [value]);
  const take = (v: string) => { setText(v); if (!v.trim()) { setBad(false); return; } const c = parseColor(v); setBad(!c); if (c) { onChange(c); addRecent(c); } };
  const dropper = typeof window !== "undefined" && "EyeDropper" in window;
  return (
    <div className="flex items-center gap-2 rounded-xl bg-page p-1.5 pr-2 ring-1 ring-line">
      <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-black/10" style={{ background: shown }} title={`Choose ${label.toLowerCase()}`}>
        <input type="color" value={shown} onChange={(x) => take(x.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label} />
      </label>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-ink-soft">{label}</span>
        <input value={text} onChange={(x) => take(x.target.value)} placeholder={placeholder ?? "#7C3AED"} spellCheck={false} aria-label={`${label} colour code`} aria-invalid={bad}
          className={cx("w-full bg-transparent font-mono text-[13.5px] uppercase outline-none", bad ? "text-alert" : "text-ink")} />
      </span>
      {dropper && <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink" aria-label="Pick a colour from the screen" title="Pick from the screen"
        onClick={async () => { try { const r = await new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper().open(); take(r.sRGBHex); } catch { /* cancelled */ } }}><Pipette size={15} /></button>}
      <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink" aria-label={`Copy ${label.toLowerCase()} code`} title="Copy the code" onClick={() => void copyText(shown.toUpperCase(), "Copy the colour code").then((ok) => ok && toast(`${shown.toUpperCase()} copied`))}><Copy size={14} /></button>
      {value && placeholder && <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink" aria-label={`Reset ${label.toLowerCase()}`} title="Back to automatic" onClick={() => onChange(undefined)}><X size={14} /></button>}
    </div>
  );
}

/** A tiny page in these colours, so a palette is judged as a page, not as dots. */
function MiniPage({ c, look }: { c: EventColors; look: EventLook }) {
  return (
    <span className="block h-[74px] p-2" style={{ background: c.bg }}>
      <span className="block h-1.5 w-8 rounded-full" style={{ background: textOn(c.bg), opacity: 0.85 }} />
      <span className="mt-1 block h-3 w-14 rounded-sm" style={{ background: textOn(c.bg), opacity: look === "bold" ? 1 : 0.9 }} />
      <span className="mt-1.5 flex items-center gap-1">
        <span className="block h-6 flex-1 rounded" style={{ background: c.section }}><span className="m-1 block size-1.5 rounded-full" style={{ background: c.icon }} /></span>
        <span className="block h-3 w-8 rounded-full" style={{ background: c.button }} />
      </span>
    </span>
  );
}

/** Colours: one main colour does the work; palettes per look; colours from the flyer; Advanced for each role; Fix it. */
export function ColorsEditor({ e, churchColor, setPage }: { e: ChurchEvent; churchColor: string; setPage: (p: Partial<EventPage>) => void }) {
  const look = lookOf(e);
  const c = colorsOf(e, churchColor);
  const main = e.page?.main ?? (e.page?.colors ? undefined : churchColor);
  const [adv, setAdv] = useState(!!e.page?.colors && !PALETTES[look].some((p) => JSON.stringify(p.c) === JSON.stringify({ ...e.page!.colors, ticket: undefined })));
  const [fromPic, setFromPic] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<string[]>([]);
  useEffect(() => { setMine(recent()); }, []);
  const pic = e.page?.media?.kind === "carousel" ? e.page.media.slides?.[0] : e.flyer;
  const setMain = (v: string) => { setPage({ main: v, colors: undefined }); addRecent(v); setMine(recent()); };
  const setRole = (k: keyof EventColors, v: string | undefined) => setPage({ colors: { ...c, [k]: v } });
  const warn = contrastWarnings(c);
  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1.5 block text-sm font-medium">Main colour</span>
        <p className="mb-2 text-[12.5px] text-muted">Choose one colour, or paste its code. Traqi makes the matching background, sections and buttons for the {LOOKS.find((x) => x.k === look)!.name} look.</p>
        <ColorField label="Main colour" value={main ?? c.button} onChange={(v) => v && setMain(v)} />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setMain(churchColor)} className="inline-flex items-center gap-1.5 rounded-full bg-page px-2.5 py-1 text-[12.5px] ring-1 ring-line hover:ring-brand/40"><span className="size-3.5 rounded-full" style={{ background: churchColor }} /> Church colour</button>
          {mine.filter((x) => x !== churchColor).slice(0, 6).map((x) => <button key={x} type="button" onClick={() => setMain(x)} aria-label={`Use ${x}`} title={x.toUpperCase()} className="size-7 rounded-full ring-2 ring-surface hover:scale-110" style={{ background: x, boxShadow: "0 0 0 1px rgba(0,0,0,.1)" }} />)}
        </div>
      </div>

      {pic && (
        <div className="rounded-2xl bg-page p-3 ring-1 ring-line">
          {!fromPic ? (
            <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { setFromPic(await colorsFromImage(pic)); } catch { toast("Couldn't read the colours from that picture"); } setBusy(false); }} className="flex items-center gap-2 text-[14px] font-medium text-brand">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Use colours from your {e.page?.media?.kind === "carousel" ? "first picture" : e.page?.media?.kind === "flyer" || !e.page?.media ? "flyer" : "picture"}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] text-muted">From your picture:</span>
              {fromPic.map((x) => <button key={x} type="button" onClick={() => setMain(x)} title={x.toUpperCase()} aria-label={`Use ${x}`} className="size-8 rounded-full ring-2 ring-surface hover:scale-110" style={{ background: x, boxShadow: "0 0 0 1px rgba(0,0,0,.12)" }} />)}
            </div>
          )}
        </div>
      )}

      <div>
        <span className="mb-1.5 block text-sm font-medium">Or a ready-made palette</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{PALETTES[look].map((p) => {
          const on = !!e.page?.colors && p.c.bg === c.bg && p.c.button === c.button && p.c.section === c.section;
          return (
            <button key={p.name} type="button" onClick={() => setPage({ colors: { ...p.c, ticket: c.ticket }, main: undefined })} className={cx("overflow-hidden rounded-xl text-left ring-1 transition", on ? "ring-2 ring-brand" : "ring-line hover:ring-ink/30")}>
              <MiniPage c={p.c} look={look} />
              <span className="flex items-center justify-between bg-surface px-2 py-1.5 text-[12px] font-medium">{p.name}{on && <Check size={13} className="text-brand" />}</span>
            </button>
          );
        })}</div>
      </div>

      <ColorField label="Ticket colour" value={c.ticket} placeholder={c.button} onChange={(v) => setRole("ticket", v)} />

      <button type="button" onClick={() => setAdv(!adv)} className="flex items-center gap-1.5 text-[13.5px] font-medium text-brand"><ChevronDown size={15} className={cx("transition", adv && "rotate-180")} /> Advanced: set each colour</button>
      {adv && (
        <div className="grid gap-2 sm:grid-cols-2">
          <ColorField label="Background" value={c.bg} onChange={(v) => v && setRole("bg", v)} />
          <ColorField label="Sections" value={c.section} onChange={(v) => v && setRole("section", v)} />
          <ColorField label="Buttons" value={c.button} onChange={(v) => v && setRole("button", v)} />
          <ColorField label="Icons and highlights" value={c.icon} onChange={(v) => v && setRole("icon", v)} />
        </div>
      )}

      <div className="flex items-center gap-3 overflow-hidden rounded-2xl p-3" style={{ background: c.bg, color: textOn(c.bg) }}>
        <span className="flex-1 rounded-xl p-3 text-[13px]" style={{ background: c.section, color: textOn(c.section) }}><b style={{ color: c.icon }}>●</b> A section with text</span>
        <span className="rounded-xl px-3 py-2 text-[13px] font-semibold" style={{ background: c.button, color: textOn(c.button) }}>Register</span>
        <span className="h-8 w-12 rounded-md" style={{ background: c.ticket || c.button }} title="Ticket" />
      </div>
      {warn.length > 0 ? (
        <div className="space-y-1.5 rounded-xl bg-glow-soft px-3 py-2 text-[13px] text-glow-ink">{warn.map((w) => (
          <p key={w.text} className="flex items-center gap-2"><AlertTriangle size={14} className="shrink-0" /><span className="flex-1">{w.text}</span>
            <button type="button" className="rounded-lg bg-surface px-2.5 py-1 font-semibold text-ink ring-1 ring-line" onClick={() => setPage({ colors: { ...c, ...w.fix }, main: undefined })}>Fix it</button></p>
        ))}</div>
      ) : <p className="flex items-center gap-1.5 text-[13px] text-good"><Check size={14} /> Easy to read</p>}
    </div>
  );
}

// ---------------- Ticket types ----------------
export function CategoriesEditor({ e, churchSlug, onChange, formBuilder }: { e: ChurchEvent; churchSlug: string; onChange: (c: TicketCategory[] | undefined) => void; formBuilder: (q: EventQuestion[], set: (q: EventQuestion[]) => void) => ReactNode }) {
  const list = e.categories ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const upd = (id: string, patch: Partial<TicketCategory>) => onChange(list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const pageColor = ticketColorOf(e);
  return (
    <div className="space-y-3">
      <p className="text-[13.5px] text-muted">Optional. Give people a choice of ticket, e.g. Delegate, Minister, Volunteer. Each has its own colour and limit. Private ones only show to people with their own link. No payments: every ticket is free.</p>
      {list.map((c) => (
        <div key={c.id} className="rounded-2xl bg-page p-3 ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2">
            <input className={cx(inputCls, "min-w-36 flex-1 bg-surface")} value={c.name} onChange={(x) => upd(c.id, { name: x.target.value })} placeholder="Name, e.g. Delegate" />
            <input className={cx(inputCls, "w-28 bg-surface")} inputMode="numeric" value={c.limit ?? ""} onChange={(x) => upd(c.id, { limit: Number(x.target.value.replace(/\D/g, "")) || undefined })} placeholder="No limit" aria-label="Limit" />
            <button type="button" onClick={() => onChange(list.filter((x) => x.id !== c.id).length ? list.filter((x) => x.id !== c.id) : undefined)} className="rounded-lg p-2 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Remove ${c.name || "ticket type"}`}><Trash2 size={15} /></button>
          </div>
          <div className="mt-2"><ColorField label="Ticket colour" value={c.color} placeholder={pageColor} onChange={(v) => upd(c.id, { color: v })} /></div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
            <label className="flex items-center gap-2">Live<Toggle label="Live" on={c.live !== false} onChange={(v) => upd(c.id, { live: v })} /></label>
            <label className="flex items-center gap-2"><Lock size={13} /> Private<Toggle label="Private" on={!!c.private} onChange={(v) => upd(c.id, { private: v, token: v ? c.token ?? newToken() : c.token })} /></label>
            {c.private && c.token && (
              <button type="button" className="inline-flex items-center gap-1.5 font-medium text-brand" onClick={() => void copyText(`${location.origin}/${churchSlug}/${e.slug}?t=${c.token}`, "Copy the private link").then((ok) => ok && toast("Private link copied"))}><Link2 size={13} /> Copy its link</button>
            )}
            <button type="button" className="ml-auto font-medium text-brand" onClick={() => setOpen(open === c.id ? null : c.id)}>{c.questions?.length ? `${c.questions.length} extra question${c.questions.length > 1 ? "s" : ""}` : "Extra questions"}</button>
          </div>
          {open === c.id && <div className="mt-3 rounded-xl bg-surface p-3 ring-1 ring-line">{formBuilder(c.questions ?? [], (q) => upd(c.id, { questions: q.length ? q : undefined }))}</div>}
        </div>
      ))}
      <button type="button" onClick={() => { const id = uid("tc"); onChange([...list, { id, name: "", live: true }]); }} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-brand"><Plus size={15} /> Add a ticket type</button>
    </div>
  );
}

// ---------------- Optional sections ----------------
export function HostEditor({ e, setPage }: { e: ChurchEvent; setPage: (p: Partial<EventPage>) => void }) {
  const h = e.page?.host ?? { letter: "" };
  const set = (patch: Partial<NonNullable<EventPage["host"]>>) => setPage({ host: { ...h, ...patch } });
  const photos = h.photos ?? [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Host's name"><input className={inputCls} value={h.name ?? ""} onChange={(x) => set({ name: x.target.value || undefined })} placeholder="Pastor Ade Bello" /></Field>
        <Field label="Role"><input className={inputCls} value={h.role ?? ""} onChange={(x) => set({ role: x.target.value || undefined })} placeholder="Senior Pastor" /></Field>
      </div>
      <Field label="The letter"><textarea className={cx(inputCls, "min-h-36")} value={h.letter} onChange={(x) => set({ letter: x.target.value })} placeholder="Dear friend, we have been praying for you…" /></Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium">Photos (up to 4) or a short video</span>
        <div className="flex flex-wrap gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative size-20 overflow-hidden rounded-xl ring-1 ring-line"><img src={src} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => set({ photos: photos.filter((_, j) => j !== i) })} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove photo"><X size={11} /></button></div>
          ))}
          {photos.length < 4 && <UploadTile label="Photo" accept="image/*" eventId={e.id} className="size-20" onDone={(u) => set({ photos: [...photos, u] })} />}
          {h.video ? (
            <div className="relative size-20 overflow-hidden rounded-xl bg-black ring-1 ring-line"><video src={h.video} muted className="h-full w-full object-cover" />
              <button type="button" onClick={() => set({ video: undefined })} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove video"><X size={11} /></button></div>
          ) : <UploadTile label="Video" accept="video/mp4,video/webm,video/quicktime" eventId={e.id} className="size-20" onDone={(video) => set({ video })}><Film size={18} />Video</UploadTile>}
        </div>
      </div>
    </div>
  );
}

export function ExperienceEditor({ e, setPage }: { e: ChurchEvent; setPage: (p: Partial<EventPage>) => void }) {
  const items = [0, 1, 2].map((i) => e.page?.experience?.[i] ?? { title: "", body: "" });
  const ideas = [["Powerful worship", "Hours of worship that lift you."], ["The Word", "Teaching you can live on Monday."], ["Real connection", "Meet people who will walk with you."]];
  const set = (i: number, patch: Partial<{ title: string; body: string }>) => setPage({ experience: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-1.5"><span className="text-[13px] text-muted">Use our words for:</span>
      {EXPERIENCE_IDEAS.map((x) => <button key={x.kind} type="button" onClick={() => setPage({ experience: x.cards })} className="rounded-full bg-page px-3 py-1 text-[12.5px] ring-1 ring-line hover:ring-brand/40">{x.kind}</button>)}
    </div>
    <div className="grid gap-2 md:grid-cols-3">{items.map((x, i) => (
      <div key={i} className="space-y-2 rounded-2xl bg-page p-3 ring-1 ring-line">
        <input className={cx(inputCls, "bg-surface font-medium")} value={x.title} onChange={(v) => set(i, { title: v.target.value })} placeholder={ideas[i][0]} />
        <textarea rows={3} className={cx(inputCls, "bg-surface")} value={x.body} onChange={(v) => set(i, { body: v.target.value })} placeholder={ideas[i][1]} />
      </div>
    ))}</div>
    </div>
  );
}

export function OnlineEditor({ e, setPage }: { e: ChurchEvent; setPage: (p: Partial<EventPage>) => void }) {
  const steps = e.page?.online?.steps ?? [];
  return (
    <div className="space-y-2">
      {!e.link && <p className="rounded-xl bg-glow-soft px-3 py-2 text-[13px] text-glow-ink">Add the online link in “When and where” first. This section shows by itself once there is one.</p>}
      <Field label="Steps (one per line)" hint="Leave empty for our usual three steps."><textarea rows={4} className={inputCls} value={steps.join("\n")} onChange={(x) => setPage({ online: { steps: x.target.value.split("\n").some((l) => l.trim()) ? x.target.value.split("\n") : undefined } })} placeholder={"Register so we can send you reminders.\nOpen the link a few minutes before it starts.\nJoin in with everyone."} /></Field>
    </div>
  );
}

export function TestimonialsEditor({ e, setPage }: { e: ChurchEvent; setPage: (p: Partial<EventPage>) => void }) {
  const list = e.page?.testimonials ?? [];
  const set = (v: typeof list) => setPage({ testimonials: v.length ? v : undefined });
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-muted">Real words from real people, with their names. Ask them first.</p>
      {list.map((t, i) => (
        <div key={i} className="space-y-2 rounded-2xl bg-page p-3 ring-1 ring-line">
          <textarea rows={2} className={cx(inputCls, "bg-surface")} value={t.quote} onChange={(x) => set(list.map((y, j) => (j === i ? { ...y, quote: x.target.value } : y)))} placeholder="What they said" />
          <div className="flex gap-2">
            <input className={cx(inputCls, "flex-1 bg-surface")} value={t.name} onChange={(x) => set(list.map((y, j) => (j === i ? { ...y, name: x.target.value } : y)))} placeholder="Name" />
            <input className={cx(inputCls, "flex-1 bg-surface")} value={t.role ?? ""} onChange={(x) => set(list.map((y, j) => (j === i ? { ...y, role: x.target.value || undefined } : y)))} placeholder="e.g. Rise 2025" />
            <button type="button" onClick={() => set(list.filter((_, j) => j !== i))} className="rounded-lg px-2 text-muted hover:bg-alert-soft hover:text-alert" aria-label="Remove"><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => set([...list, { quote: "", name: "" }])} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-brand"><Plus size={15} /> Add a testimonial</button>
    </div>
  );
}

export function ExtrasEditor({ e, setPage }: { e: ChurchEvent; setPage: (p: Partial<EventPage>) => void }) {
  const list = e.page?.extras ?? [];
  const set = (v: typeof list) => setPage({ extras: v.length ? v : undefined });
  const upd = (id: string, patch: Partial<(typeof list)[number]>) => set(list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {list.map((x) => (
        <div key={x.id} className="space-y-2 rounded-2xl bg-page p-3 ring-1 ring-line">
          <div className="flex gap-2">
            <input className={cx(inputCls, "flex-1 bg-surface font-medium")} value={x.title} onChange={(v) => upd(x.id, { title: v.target.value })} placeholder="Section title, e.g. Children's church" />
            <button type="button" onClick={() => set(list.filter((y) => y.id !== x.id))} className="rounded-lg px-2 text-muted hover:bg-alert-soft hover:text-alert" aria-label="Remove section"><Trash2 size={15} /></button>
          </div>
          <textarea rows={3} className={cx(inputCls, "bg-surface")} value={x.body} onChange={(v) => upd(x.id, { body: v.target.value })} placeholder="What people should know" />
          <div className="flex flex-wrap items-center gap-2">
            {x.image ? <div className="relative h-16 w-24 overflow-hidden rounded-xl ring-1 ring-line"><img src={x.image} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => upd(x.id, { image: undefined })} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove picture"><X size={11} /></button></div>
              : <UploadTile label="Picture" accept="image/*" eventId={e.id} className="h-16 w-24" onDone={(u) => upd(x.id, { image: u })} />}
            <input className={cx(inputCls, "w-40 bg-surface")} value={x.button?.label ?? ""} onChange={(v) => upd(x.id, { button: { label: v.target.value, url: x.button?.url ?? "" } })} placeholder="Button text" />
            <input className={cx(inputCls, "min-w-40 flex-1 bg-surface")} value={x.button?.url ?? ""} onChange={(v) => upd(x.id, { button: { label: x.button?.label ?? "", url: v.target.value } })} placeholder="Button link (optional)" />
          </div>
        </div>
      ))}
      {list.length < MAX_EXTRAS && <button type="button" onClick={() => set([...list, { id: uid("x"), title: "", body: "" }])} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-brand"><Plus size={15} /> Add a section ({list.length}/{MAX_EXTRAS})</button>}
    </div>
  );
}

export function InviteEditor({ e, setPage }: { e: ChurchEvent; setPage: (p: Partial<EventPage>) => void }) {
  const inv = e.page?.invite ?? {};
  return (
    <div className="space-y-2">
      <Field label="Closing invitation: title"><input className={inputCls} value={inv.title ?? ""} onChange={(x) => setPage({ invite: { ...inv, title: x.target.value || undefined } })} placeholder={`Don't miss ${e.title || "it"}`} /></Field>
      <Field label="A few words"><textarea rows={2} className={inputCls} value={inv.body ?? ""} onChange={(x) => setPage({ invite: { ...inv, body: x.target.value || undefined } })} placeholder="Come expectant. Bring someone with you. We can't wait to see you there." /></Field>
    </div>
  );
}


/** The three looks, each drawn in this event's colours, so people choose by seeing. */
export function LookPicker({ e, churchColor, onPick }: { e: ChurchEvent; churchColor: string; onPick: (template: NonNullable<ChurchEvent["template"]>) => void }) {
  const cur = lookOf(e);
  const main = e.page?.main ?? churchColor;
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">Look</span>
      <div className="grid gap-2 sm:grid-cols-3">{LOOKS.map((l) => {
        const c = paletteFrom(main, l.k);
        const on = cur === l.k;
        return (
          <button key={l.k} type="button" onClick={() => onPick(templateOf(l.k))} aria-pressed={on} className={cx("flex flex-col justify-start overflow-hidden rounded-2xl text-left ring-1 transition", on ? "ring-2 ring-brand" : "ring-line hover:ring-ink/25")}>
            <span className="relative block h-28 overflow-hidden p-3" style={{ background: l.k === "bold" ? c.section : c.bg, color: textOn(l.k === "bold" ? c.section : c.bg) }}>
              {l.k === "cinematic" && <span aria-hidden className="absolute -left-6 -top-8 size-28 rounded-full opacity-60 blur-2xl" style={{ background: c.button }} />}
              <span className="relative block text-[9px] font-semibold uppercase tracking-[.25em] opacity-70">{e.title ? e.title.split(":")[0].slice(0, 18) : "Your event"}</span>
              <span className="relative mt-1 block leading-[.9]" style={l.k === "editorial" ? { fontFamily: '"Fraunces Variable", serif', fontWeight: 300, fontSize: 34 } : l.k === "bold" ? { fontFamily: '"Archivo Variable"', fontStretch: "125%", fontWeight: 900, fontSize: 26, textTransform: "uppercase" } : { fontFamily: '"Inter Tight Variable"', fontWeight: 800, fontSize: 30, letterSpacing: "-.04em" }}>Rise.</span>
              <span className="relative mt-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: l.k === "bold" ? "#111" : c.button, color: l.k === "bold" ? c.section : textOn(c.button) }}>Register</span>
            </span>
            <span className="block p-3"><b className="flex items-center justify-between text-[14.5px]">{l.name}{on && <Check size={15} className="text-brand" />}</b><span className="text-[12.5px] leading-snug text-muted">{l.says}</span></span>
          </button>
        );
      })}</div>
    </div>
  );
}
