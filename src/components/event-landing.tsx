"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft, ArrowRight, BedDouble, CalendarPlus, Check, ChevronDown, Clock, Copy, Download, Gift, Globe, Image as ImageIcon, Mail, MapPin, Navigation,
  Phone, Plus, Quote, Radio, Share2, Ticket, UserRound, Users, UsersRound, Wifi, X,
} from "lucide-react";
import { Confetti, cx } from "./ui";
import { COVERS, ChurchMark } from "./brand";
import { QR } from "./public";
import { WhatsAppIcon } from "./care";
import { usePublicTheme } from "./theme";
import { digits } from "@/lib/format";
import { daysOf, eventPath, happeningNow, lagosISO, peopleOf, regTypesOf, themeOf } from "@/lib/events";
import { shareImage } from "@/lib/share-image";
import { saveBlob } from "@/lib/download";
import type { ChurchEvent, ChurchProfile, EventPerson, EventQuestion, RegType } from "@/lib/types";

export type Attendee = { name: string; phone: string; email?: string; answers: Record<string, string> };
export type RegInput = Attendee & { type: RegType; days: string[]; guests: number; others: Attendee[] };
export type RegTicket = { name: string; ticket: string; status: "confirmed" | "waitlist" | "pending" | "already" };
export type RegResult = { status: RegTicket["status"]; ticket: string; tickets?: RegTicket[] };
type ChurchInfo = { name: string; slug: string; profile?: Partial<ChurchProfile> };

const fmtDay = (d: string, o: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
const t12 = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`; };
const initials = (n: string) => n.replace(/^(pastor|pst|rev|dr|bishop|apostle|prophet|evang)\.?\s+/i, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export const whenLine = (e: ChurchEvent) => {
  const d = daysOf(e);
  return d.length > 1 ? `${fmtDay(d[0].date, { weekday: "short", day: "numeric", month: "short" })} to ${fmtDay(d.at(-1)!.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}` : fmtDay(d[0].date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

export function icsFile(e: ChurchEvent, church: string, url: string) {
  const f = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ev = daysOf(e).map((d, i) => ["BEGIN:VEVENT", `UID:${e.id}-${i}@traqi.space`, `DTSTAMP:${f(new Date().toISOString())}`, `DTSTART:${f(lagosISO(d.date, d.start))}`, `DTEND:${f(lagosISO(d.date, d.end))}`,
    `SUMMARY:${e.title}${daysOf(e).length > 1 ? ` (day ${i + 1})` : ""}`, `DESCRIPTION:${themeOf(e)} · ${church} · ${url}`, `LOCATION:${e.mode === "virtual" ? "Online" : e.venue ?? ""}`, "END:VEVENT"].join("\r\n"));
  saveBlob(new Blob([["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Traqi//Events//EN", ...ev, "END:VCALENDAR"].join("\r\n")], { type: "text/calendar" }), `${e.slug}.ics`);
}

/** Look and feel of each template. */
const TEMPLATES = {
  flyer: { name: "Flyer", dark: false, heading: "var(--font-display)", page: "#f7f6fb", card: "#ffffff", fg: "#17151f", muted: "#5d5a6b", line: "rgba(23,21,31,.09)" },
  bold: { name: "Bold", dark: true, heading: '"Archivo Variable", ui-sans-serif, system-ui', page: "#09080f", card: "#14121d", fg: "#f6f5fb", muted: "#a9a5bb", line: "rgba(255,255,255,.09)" },
  elegant: { name: "Elegant", dark: false, heading: '"Fraunces Variable", Georgia, serif', page: "#fbf8f2", card: "#ffffff", fg: "#1f1a14", muted: "#6c6356", line: "rgba(31,26,20,.1)" },
} as const;

/** The public event landing page: one of three templates, all sections optional except the essentials. */
export function EventLanding({ e, church, registered, recent = [], onRegister, onFeedback, preview }: {
  e: ChurchEvent; church: ChurchInfo; registered: number; recent?: string[];
  onRegister: (r: RegInput) => Promise<RegResult>; onFeedback?: (ticket: string, answers: Record<string, string>) => Promise<void>; preview?: boolean;
}) {
  usePublicTheme(church.profile);
  const tpl = TEMPLATES[e.template ?? "flyer"];
  const color = church.profile?.color ?? "#4f46e5";
  const [url, setUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setUrl(`${location.origin}${eventPath(church.slug, e)}`); }, [church.slug, e]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const days = daysOf(e);
  const people = peopleOf(e);
  const live = happeningNow(e, now);
  const ended = Date.parse(e.end) < now;
  const closed = ended || (!!e.closesAt && Date.parse(e.closesAt) < now);
  const full = !!e.capacity && registered >= e.capacity;
  const theme = themeOf(e);
  const vars = { "--ev-page": tpl.page, "--ev-card": tpl.card, "--ev-fg": tpl.fg, "--ev-muted": tpl.muted, "--ev-line": tpl.line, "--ev-accent": color, "--ev-heading": tpl.heading } as CSSProperties;
  const H = "font-[family-name:var(--ev-heading)] tracking-tight";
  const sections = [
    { id: "about", label: "About", show: true },
    { id: "people", label: "Speakers", show: people.length > 0 },
    { id: "programme", label: "Programme", show: days.some((d) => d.sessions?.length) || e.schedule.length > 0 },
    { id: "venue", label: "Venue", show: e.mode !== "virtual" || !!e.venues?.length },
    { id: "faq", label: "FAQ", show: !!e.faq?.length },
  ].filter((s) => s.show);
  const share = `*${e.title}*${theme ? `\n${theme}` : ""}\n${whenLine(e)}${e.venue && e.mode !== "virtual" ? `\n${e.venue}` : ""}\n\nRegister free: ${url}`;

  return (
    <div className={cx("min-h-screen text-[var(--ev-fg)]", tpl.dark && "dark-tpl")} style={{ ...vars, background: "var(--ev-page)" }}>
      {/* Sticky nav */}
      <nav className="sticky top-0 z-40 border-b border-[var(--ev-line)] backdrop-blur-xl" style={{ background: `color-mix(in oklab, ${tpl.page} 82%, transparent)` }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <ChurchMark church={{ name: church.name, profile: church.profile as ChurchProfile }} size={34} />
          <span className="min-w-0 truncate font-semibold">{church.name}</span>
          {preview && <span className="rounded-full bg-[var(--ev-accent)] px-2.5 py-0.5 text-[11px] font-semibold text-white">Preview</span>}
          <div className="ml-auto hidden items-center gap-1 md:flex">
            {sections.map((s) => <a key={s.id} href={`#${s.id}`} className="rounded-full px-3 py-1.5 text-[14px] text-[var(--ev-muted)] hover:text-[var(--ev-fg)]">{s.label}</a>)}
          </div>
          {!closed && <a href="#register" className="ml-auto rounded-full bg-[var(--ev-accent)] px-4 py-2 text-[14px] font-semibold text-white shadow-lg shadow-black/10 md:ml-2">Register</a>}
        </div>
      </nav>

      {live && !ended && <LiveBar e={e} live={live} people={people} />}

      {e.template === "bold" ? <BoldHero e={e} church={church} registered={registered} recent={recent} people={people} closed={closed} H={H} />
        : e.template === "elegant" ? <ElegantHero e={e} church={church} registered={registered} recent={recent} closed={closed} H={H} />
        : <FlyerHero e={e} church={church} registered={registered} recent={recent} closed={closed} H={H} color={color} />}

      <main className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-14 pt-12">
            <About e={e} H={H} registered={registered} full={full} />
            {people.length > 0 && <PeopleGrid e={e} people={people} H={H} />}
            {sections.some((s) => s.id === "programme") && <Programme e={e} people={people} H={H} now={now} />}
            {sections.some((s) => s.id === "venue") && <Venues e={e} H={H} />}
            {!!e.faq?.length && <Faq items={e.faq} H={H} />}
            {!!e.gallery?.length && <Gallery images={e.gallery} H={H} />}
            {!!e.stay?.length && <Stay items={e.stay} H={H} />}
            {e.give && (e.give.url || e.give.account) && <Give give={e.give} H={H} />}
            {e.showPartners && !!e.partners?.length && <Partners items={e.partners} H={H} />}
            {ended && e.feedback?.on && onFeedback && <FeedbackForm e={e} H={H} onSend={onFeedback} />}
            <Contact e={e} church={church} H={H} share={share} url={url} />
          </div>

          <aside id="register" className="scroll-mt-20 pt-12 lg:sticky lg:top-16 lg:h-fit lg:self-start">
            <RegisterPanel e={e} church={church} url={url} closed={closed} full={full} onRegister={onRegister} H={H} />
            {url && !closed && (
              <div className="mt-4 flex items-center gap-4 rounded-3xl bg-[var(--ev-card)] p-4 ring-1 ring-[var(--ev-line)]">
                <div className="rounded-xl bg-white p-1.5"><QR value={url} size={78} /></div>
                <div className="min-w-0 text-[13px] text-[var(--ev-muted)]"><p>Scan to open on another phone, or share:</p>
                  <div className="mt-2 flex gap-2">
                    <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" className="flex size-9 items-center justify-center rounded-xl bg-[#25d366] text-white" aria-label="Share on WhatsApp"><WhatsAppIcon size={17} /></a>
                    <button onClick={() => { navigator.clipboard?.writeText(url); }} className="flex size-9 items-center justify-center rounded-xl ring-1 ring-[var(--ev-line)]" aria-label="Copy link"><Copy size={15} /></button>
                    <button onClick={async () => saveBlob(await shareImage(e, { name: church.name, color: church.profile?.color, logo: church.profile?.logo }, url), `${e.slug}-share.png`)} className="flex size-9 items-center justify-center rounded-xl ring-1 ring-[var(--ev-line)]" aria-label="Download share image"><ImageIcon size={15} /></button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className="border-t border-[var(--ev-line)] py-8 text-center text-[13px] text-[var(--ev-muted)]">
        <p>{church.name}</p>
        <p className="mt-1">Powered by <b className="font-semibold">Traqi</b></p>
      </footer>

      {!closed && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--ev-line)] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden" style={{ background: `color-mix(in oklab, ${tpl.page} 88%, transparent)` }}>
          <a href="#register" className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--ev-accent)] py-3.5 font-semibold text-white shadow-lg">
            <Ticket size={18} /> {full ? "Join the waiting list" : e.needsApproval ? "Request a place" : "Register free"}
          </a>
        </div>
      )}
    </div>
  );
}

// ---------------- Heroes ----------------
function Countdown({ to, dark = true }: { to: string; dark?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now === null) return <div className="h-[70px]" />;
  const ms = Date.parse(to) - now;
  if (ms <= 0) return null;
  const parts = [[Math.floor(ms / 864e5), "days"], [Math.floor(ms / 36e5) % 24, "hrs"], [Math.floor(ms / 6e4) % 60, "mins"], [Math.floor(ms / 1e3) % 60, "secs"]] as const;
  return (
    <div className="flex gap-2" aria-label="Time until it starts">{parts.map(([n, l]) => (
      <div key={l} className={cx("min-w-[64px] rounded-2xl px-3 py-2.5 text-center backdrop-blur", dark ? "bg-white/12 ring-1 ring-white/15" : "bg-[var(--ev-card)] ring-1 ring-[var(--ev-line)]")}>
        <p className="num text-[26px] font-semibold leading-none">{String(n).padStart(2, "0")}</p>
        <p className={cx("mt-1 text-[10.5px] uppercase tracking-wider", dark ? "text-white/60" : "text-[var(--ev-muted)]")}>{l}</p>
      </div>
    ))}</div>
  );
}

function Proof({ registered, recent, dark }: { registered: number; recent: string[]; dark?: boolean }) {
  if (registered < 5) return null;
  const tones = ["#f59e0b", "#10b981", "#ec4899", "#38bdf8", "#a78bfa"];
  return (
    <div className="flex items-center gap-3">
      <span className="flex -space-x-2">{(recent.length ? recent : ["A", "B", "C", "D"]).slice(0, 4).map((n, i) => (
        <span key={i} className={cx("flex size-8 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2", dark ? "ring-black/40" : "ring-[var(--ev-page)]")} style={{ background: tones[i % tones.length] }}>{initials(n) || "•"}</span>
      ))}</span>
      <span className={cx("text-[14px]", dark ? "text-white/80" : "text-[var(--ev-muted)]")}><b className={dark ? "text-white" : "text-[var(--ev-fg)]"}>{registered.toLocaleString()}</b> people registered</span>
    </div>
  );
}

function Chips({ e, dark, center }: { e: ChurchEvent; dark?: boolean; center?: boolean }) {
  const d = daysOf(e);
  const chip = cx("inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px]", dark ? "bg-white/12 ring-1 ring-white/15" : "bg-[var(--ev-card)] ring-1 ring-[var(--ev-line)]");
  return (
    <div className={cx("flex flex-wrap gap-2", center && "justify-center")}>
      <span className={chip}><CalendarPlus size={15} /> {whenLine(e)}</span>
      <span className={chip}><Clock size={15} /> {d.length === 1 ? `${t12(d[0].start)} to ${t12(d[0].end)}` : d.every((x) => x.start === d[0].start) ? `${t12(d[0].start)} daily` : `Starts ${t12(d[0].start)}`}</span>
      <span className={chip}>{e.mode === "virtual" ? <><Wifi size={15} /> Online</> : <><MapPin size={15} /> {e.venues?.[0]?.name ?? e.venue ?? "Venue to be announced"}{e.mode === "hybrid" ? " · and online" : ""}</>}</span>
    </div>
  );
}

function CTA({ closed, dark }: { closed: boolean; dark?: boolean }) {
  if (closed) return <span className={cx("inline-flex rounded-2xl px-5 py-3.5 font-semibold", dark ? "bg-white/15" : "bg-[var(--ev-card)] ring-1 ring-[var(--ev-line)]")}>Registration has closed</span>;
  return <a href="#register" className={cx("inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[16px] font-semibold shadow-xl transition hover:-translate-y-0.5", dark ? "bg-white text-[#111]" : "bg-[var(--ev-accent)] text-white shadow-black/10")}><Ticket size={18} /> Register free <ArrowRight size={16} /></a>;
}

function Poster({ e, church, className }: { e: ChurchEvent; church: ChurchInfo; className?: string }) {
  if (e.flyer) return <img src={e.flyer} alt={`${e.title} flyer`} className={cx("w-full rounded-[28px] object-cover shadow-2xl shadow-black/25", className)} />;
  return (
    <div className={cx("relative flex aspect-[4/5] w-full flex-col justify-between overflow-hidden rounded-[28px] p-8 text-white shadow-2xl shadow-black/25", className)} style={{ background: COVERS[e.cover % COVERS.length] }}>
      <div aria-hidden className="absolute -right-20 -top-20 size-80 rounded-full bg-white/15 blur-3xl" />
      <p className="relative text-[13px] font-semibold uppercase tracking-[.25em] text-white/80">{church.name}</p>
      <div className="relative">
        {themeOf(e) && <p className="mb-3 text-[15px] italic text-white/85">“{themeOf(e)}”</p>}
        <p className="font-display text-[44px] font-bold leading-[.95] tracking-tight">{e.title}</p>
        <p className="mt-5 text-[15px] font-medium">{whenLine(e)}</p>
      </div>
    </div>
  );
}

type HeroProps = { e: ChurchEvent; church: ChurchInfo; registered: number; recent: string[]; closed: boolean; H: string };

/** Flyer: the church's own flyer front and centre, details beside it. */
function FlyerHero({ e, church, registered, recent, closed, H, color }: HeroProps & { color: string }) {
  return (
    <header className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(800px 500px at 85% -10%, ${color}30, transparent 70%), radial-gradient(600px 400px at 0% 100%, #f59e0b18, transparent 70%)` }} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] md:py-16">
        <Poster e={e} church={church} className="mx-auto max-w-[460px] -rotate-1" />
        <div>
          {themeOf(e) && <p className="text-[14px] font-semibold uppercase tracking-[.18em] text-[var(--ev-accent)]">Theme: {themeOf(e)}</p>}
          <h1 className={cx(H, "mt-3 break-words text-[clamp(34px,9vw,64px)] font-bold leading-[1.02]")}>{e.title}</h1>
          {e.verse?.text && <p className="mt-4 max-w-lg text-[16px] italic text-[var(--ev-muted)]">“{e.verse.text}” <span className="not-italic font-medium">{e.verse.ref}</span></p>}
          <div className="mt-6"><Chips e={e} /></div>
          <div className="mt-7"><Countdown to={e.start} dark={false} /></div>
          <div className="mt-7 flex flex-wrap items-center gap-5"><CTA closed={closed} /><Proof registered={registered} recent={recent} /></div>
        </div>
      </div>
    </header>
  );
}

/** Bold: a night-of-worship look. Big type, deep colour, the line-up in faces. */
function BoldHero({ e, church, registered, recent, people, closed, H }: HeroProps & { people: EventPerson[] }) {
  const color = church.profile?.color ?? "#4f46e5";
  return (
    <header className="relative overflow-hidden text-white">
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(900px 600px at 80% 0%, ${color}cc, transparent 60%), radial-gradient(700px 500px at 0% 100%, #f59e0b55, transparent 65%), #09080f` }} />
      {e.flyer && <img aria-hidden src={e.flyer} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity" />}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#09080f]" />
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 md:pb-24 md:pt-24">
        <p className="text-[13px] font-semibold uppercase tracking-[.3em] text-white/70">{church.name} presents</p>
        <h1 className={cx(H, "mt-4 max-w-4xl break-words text-[clamp(36px,10.5vw,104px)] font-black uppercase leading-[.92] [hyphens:auto]")}>{e.title}</h1>
        {themeOf(e) && <p className="mt-5 max-w-2xl text-[20px] font-medium text-white/85 md:text-[26px]">{themeOf(e)}</p>}
        <div className="mt-7"><Chips e={e} dark /></div>
        <div className="mt-8 flex flex-wrap items-end gap-6"><Countdown to={e.start} /><CTA closed={closed} dark /></div>
        {people.length > 0 && (
          <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="text-[12px] font-semibold uppercase tracking-[.25em] text-white/55">Featuring</span>
            {people.slice(0, 5).map((p) => (
              <span key={p.id} className="flex items-center gap-2.5">
                <Face p={p} size={40} ring="ring-2 ring-white/30" />
                <span className="text-[15px] font-semibold">{p.name}</span>
              </span>
            ))}
          </div>
        )}
        <div className="mt-8"><Proof registered={registered} recent={recent} dark /></div>
      </div>
    </header>
  );
}

/** Elegant: warm and calm for conventions, carols and dinners. Serif type, the verse at the centre. */
function ElegantHero({ e, church, registered, recent, closed, H }: HeroProps) {
  return (
    <header className="relative overflow-hidden border-b border-[var(--ev-line)]">
      <div aria-hidden className="absolute inset-x-0 top-0 h-full opacity-60" style={{ background: "radial-gradient(700px 360px at 50% 0%, color-mix(in oklab, var(--ev-accent) 18%, transparent), transparent 70%)" }} />
      <div className="relative mx-auto max-w-4xl px-4 py-14 text-center md:py-24">
        <p className="text-[13px] font-medium uppercase tracking-[.35em] text-[var(--ev-muted)]">{church.name}</p>
        <Ornament />
        <h1 className={cx(H, "mt-2 break-words text-[clamp(36px,9.5vw,76px)] font-semibold leading-[1.02]")}>{e.title}</h1>
        {themeOf(e) && <p className="mx-auto mt-5 max-w-2xl text-[21px] italic text-[var(--ev-muted)] md:text-[26px]" style={{ fontFamily: "var(--ev-heading)" }}>{themeOf(e)}</p>}
        {e.verse?.text && <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--ev-muted)]">“{e.verse.text}”<br /><span className="mt-1 inline-block text-[13px] font-semibold uppercase tracking-[.2em] text-[var(--ev-accent)]">{e.verse.ref}</span></p>}
        <div className="mt-8"><Chips e={e} center /></div>
        {e.flyer && <img src={e.flyer} alt={`${e.title} flyer`} className="mx-auto mt-10 w-full max-w-md rounded-2xl shadow-xl ring-1 ring-[var(--ev-line)]" />}
        <div className="mt-9 flex justify-center"><Countdown to={e.start} dark={false} /></div>
        <div className="mt-8 flex flex-col items-center gap-5"><CTA closed={closed} /><Proof registered={registered} recent={recent} /></div>
      </div>
    </header>
  );
}

function Ornament() {
  return <div aria-hidden className="mx-auto my-5 flex items-center justify-center gap-3 text-[var(--ev-accent)]"><span className="h-px w-14 bg-current opacity-40" /><span className="size-1.5 rotate-45 bg-current" /><span className="h-px w-14 bg-current opacity-40" /></div>;
}

// ---------------- Happening now ----------------
function LiveBar({ e, live, people }: { e: ChurchEvent; live: NonNullable<ReturnType<typeof happeningNow>>; people: EventPerson[] }) {
  const who = live.session?.personIds?.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean).join(", ");
  return (
    <div className="sticky top-16 z-30 bg-[#e11d48] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[14px]">
        <span className="flex items-center gap-2 font-bold uppercase tracking-wider"><span className="relative flex size-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex size-2.5 rounded-full bg-white" /></span> Happening now</span>
        <span className="min-w-0 flex-1 truncate">{live.session ? `${live.session.title}${who ? ` · ${who}` : ""}` : `Day ${live.dayIndex + 1}${live.day?.title ? `: ${live.day.title}` : ""}`}{live.next ? ` · Next: ${live.next.title} at ${t12(live.next.start)}` : ""}</span>
        {e.link && e.mode !== "physical" && <a href={e.link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-[#e11d48]"><Radio size={14} /> Watch live</a>}
      </div>
    </div>
  );
}

// ---------------- Sections ----------------
function SectionTitle({ id, kicker, title, H }: { id: string; kicker?: string; title: string; H: string }) {
  return (
    <div id={id} className="mb-6 scroll-mt-24">
      {kicker && <p className="text-[12.5px] font-semibold uppercase tracking-[.2em] text-[var(--ev-accent)]">{kicker}</p>}
      <h2 className={cx(H, "mt-1.5 text-[30px] font-semibold leading-tight md:text-[36px]")}>{title}</h2>
    </div>
  );
}

const card = "rounded-3xl bg-[var(--ev-card)] ring-1 ring-[var(--ev-line)]";

function About({ e, H, registered, full }: { e: ChurchEvent; H: string; registered: number; full: boolean }) {
  const d = daysOf(e);
  const tiles = [
    { icon: CalendarPlus, k: "When", v: d.length > 1 ? `${d.length} days` : fmtDay(d[0].date, { weekday: "long" }), s: whenLine(e) },
    { icon: e.mode === "virtual" ? Globe : MapPin, k: "Where", v: e.mode === "virtual" ? "Online" : e.venues?.[0]?.name ?? e.venue ?? "To be announced", s: e.mode === "hybrid" ? "Also streamed online" : e.venues?.[0]?.address },
    { icon: Users, k: "Who", v: "Everyone is welcome", s: registered >= 5 ? `${registered.toLocaleString()} registered so far` : undefined },
    { icon: Ticket, k: "Cost", v: "Free", s: e.capacity ? (full ? "Fully booked: join the waiting list" : `${Math.max(0, e.capacity - registered)} places left`) : undefined },
  ];
  return (
    <section>
      <SectionTitle id="about" kicker="About" title={themeOf(e) || e.title} H={H} />
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <div key={t.k} className={cx(card, "flex gap-4 p-5")}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: "var(--ev-accent)" }}><t.icon size={19} /></span>
            <span className="min-w-0"><span className="block text-[12px] font-semibold uppercase tracking-wider text-[var(--ev-muted)]">{t.k}</span><span className="block text-[16px] font-semibold">{t.v}</span>{t.s && <span className="block text-[13.5px] text-[var(--ev-muted)]">{t.s}</span>}</span>
          </div>
        ))}
      </div>
      {e.description && <p className="mt-6 whitespace-pre-line text-[16.5px] leading-relaxed text-[var(--ev-muted)]">{e.description}</p>}
      {e.verse?.text && e.template !== "elegant" && (
        <figure className={cx(card, "mt-6 flex gap-4 p-6")}>
          <Quote size={26} className="shrink-0 text-[var(--ev-accent)]" />
          <blockquote><p className={cx(H, "text-[20px] font-medium leading-snug")}>{e.verse.text}</p><figcaption className="mt-2 text-[13px] font-semibold uppercase tracking-[.15em] text-[var(--ev-muted)]">{e.verse.ref}</figcaption></blockquote>
        </figure>
      )}
    </section>
  );
}

function Face({ p, size, ring = "" }: { p: EventPerson; size: number; ring?: string }) {
  const tones = ["#4f46e5", "#db2777", "#0f766e", "#ea580c", "#0284c7", "#7c3aed"];
  const tone = tones[(p.name.charCodeAt(0) + p.name.length) % tones.length];
  return p.photo
    ? <img src={p.photo} alt="" className={cx("shrink-0 rounded-full object-cover", ring)} style={{ width: size, height: size }} />
    : <span className={cx("flex shrink-0 items-center justify-center rounded-full font-bold text-white", ring)} style={{ width: size, height: size, background: tone, fontSize: size * 0.36 }}>{initials(p.name)}</span>;
}

function PeopleGrid({ e, people, H }: { e: ChurchEvent; people: EventPerson[]; H: string }) {
  const [open, setOpen] = useState<EventPerson | null>(null);
  const order = ["Speaker", "Minister", "Music minister", "Host", "Special guest"];
  const sorted = [...people].sort((a, b) => (order.indexOf(a.label) + 1 || 9) - (order.indexOf(b.label) + 1 || 9));
  return (
    <section>
      <SectionTitle id="people" kicker="On the programme" title={people.every((p) => p.label === "Speaker") ? "Speakers" : "Ministering"} H={H} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {sorted.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)} className={cx(card, "group overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-xl")}>
            <div className="relative aspect-square overflow-hidden">
              {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                : <div className="flex h-full items-center justify-center" style={{ background: COVERS[(p.name.length + (e.cover ?? 0)) % COVERS.length] }}><span className="font-display text-[56px] font-bold text-white/90">{initials(p.name)}</span></div>}
              <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur">{p.label}</span>
            </div>
            <div className="p-4"><p className="font-semibold leading-tight">{p.name}</p>{(p.from || p.bio) && <p className="mt-1 line-clamp-2 text-[13px] text-[var(--ev-muted)]">{p.from ?? p.bio}</p>}</div>
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm md:items-center" onClick={() => setOpen(null)} role="dialog" aria-modal aria-label={open.name}>
          <div className={cx(card, "pop relative w-full max-w-md p-6 text-[var(--ev-fg)]")} style={{ background: "var(--ev-card)" }} onClick={(x) => x.stopPropagation()}>
            <button onClick={() => setOpen(null)} className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--ev-muted)] hover:bg-black/5" aria-label="Close"><X size={18} /></button>
            <div className="flex items-center gap-4"><Face p={open} size={72} /><div><p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ev-accent)]">{open.label}</p><p className={cx(H, "text-[22px] font-semibold leading-tight")}>{open.name}</p>{open.from && <p className="text-[14px] text-[var(--ev-muted)]">{open.from}</p>}</div></div>
            {open.bio && <p className="mt-5 text-[15.5px] leading-relaxed text-[var(--ev-muted)]">{open.bio}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function Programme({ e, people, H, now }: { e: ChurchEvent; people: EventPerson[]; H: string; now: number }) {
  const days = daysOf(e);
  const live = happeningNow(e, now);
  const [d, setD] = useState(live?.dayIndex ?? 0);
  const day = days[d] ?? days[0];
  const sessions = day.sessions?.length ? [...day.sessions].sort((a, b) => a.start.localeCompare(b.start)) : e.schedule.map((s, i) => ({ id: `o${i}`, start: "", title: s.item, label: s.time }));
  return (
    <section>
      <SectionTitle id="programme" kicker="Programme" title={days.length > 1 ? `${days.length} days` : "On the day"} H={H} />
      {days.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{days.map((x, i) => (
          <button key={x.date} onClick={() => setD(i)} className={cx("shrink-0 rounded-2xl px-4 py-2.5 text-left ring-1 transition", i === d ? "bg-[var(--ev-accent)] text-white ring-transparent" : "bg-[var(--ev-card)] ring-[var(--ev-line)]")}>
            <span className="block text-[12px] font-semibold uppercase tracking-wider opacity-80">Day {i + 1}{live?.dayIndex === i ? " · Today" : ""}</span>
            <span className="block text-[14.5px] font-semibold">{fmtDay(x.date, { weekday: "short", day: "numeric", month: "short" })}</span>
          </button>
        ))}</div>
      )}
      <div className={cx(card, "p-5 md:p-6")}>
        <p className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><span className="font-semibold">{day.title ?? fmtDay(day.date)}</span><span className="text-[13.5px] text-[var(--ev-muted)]">{t12(day.start)} to {t12(day.end)}</span></p>
        <ol className="relative space-y-1 border-l-2 border-[var(--ev-line)] pl-5">
          {sessions.map((s) => {
            const isNow = live?.dayIndex === d && live.session?.id === s.id;
            const who = "personIds" in s ? (s.personIds ?? []).map((id) => people.find((p) => p.id === id)).filter(Boolean) as EventPerson[] : [];
            const venue = "venueId" in s && s.venueId ? e.venues?.find((v) => v.id === s.venueId) : undefined;
            return (
              <li key={s.id} className={cx("relative rounded-2xl px-3 py-3", isNow && "bg-[color-mix(in_oklab,var(--ev-accent)_12%,transparent)]")}>
                <span className={cx("absolute -left-[27px] top-4 size-3.5 rounded-full ring-4 ring-[var(--ev-card)]", isNow ? "bg-[#e11d48]" : "bg-[var(--ev-accent)]")} />
                <p className="text-[13px] font-semibold text-[var(--ev-accent)]">{"label" in s ? s.label : `${t12(s.start)}${"end" in s && s.end ? ` to ${t12(s.end)}` : ""}`}{isNow && <span className="ml-2 rounded-md bg-[#e11d48] px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-white">Now</span>}</p>
                <p className="text-[16px] font-semibold">{s.title}</p>
                {(who.length > 0 || venue) && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--ev-muted)]">
                    {who.length > 0 && <span className="flex items-center gap-1.5"><span className="flex -space-x-1.5">{who.map((p) => <Face key={p.id} p={p} size={22} ring="ring-2 ring-[var(--ev-card)]" />)}</span>{who.map((p) => p.name).join(", ")}</span>}
                    {venue && <span className="flex items-center gap-1"><MapPin size={12} />{venue.name}</span>}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Venues({ e, H }: { e: ChurchEvent; H: string }) {
  const venues = e.venues?.length ? e.venues : e.venue ? [{ id: "v", name: e.venue }] : [];
  return (
    <section>
      <SectionTitle id="venue" kicker="Getting there" title={venues.length > 1 ? "Venues" : "Venue"} H={H} />
      <div className="grid gap-3 md:grid-cols-2">
        {venues.map((v) => {
          const maps = ("mapUrl" in v && v.mapUrl) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(("address" in v && v.address) || v.name)}`;
          return (
            <div key={v.id} className={cx(card, "flex flex-col p-5")}>
              <p className="flex items-center gap-2 font-semibold">{v.name}{"overflow" in v && v.overflow && <span className="rounded-md bg-[var(--ev-page)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ev-muted)] ring-1 ring-[var(--ev-line)]">Overflow</span>}</p>
              {"address" in v && v.address && <p className="mt-1 text-[14px] text-[var(--ev-muted)]">{v.address}</p>}
              {"directions" in v && v.directions && <p className="mt-2 text-[14px] leading-relaxed">{v.directions}</p>}
              {"note" in v && v.note && <p className="mt-2 text-[13px] text-[var(--ev-muted)]">{v.note}</p>}
              <a href={maps} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--ev-accent)] px-3.5 py-2 text-[14px] font-semibold text-white"><Navigation size={15} /> Get directions</a>
            </div>
          );
        })}
        {e.mode !== "physical" && (
          <div className={cx(card, "p-5")}>
            <p className="flex items-center gap-2 font-semibold"><Wifi size={17} className="text-[var(--ev-accent)]" /> Joining online</p>
            <p className="mt-1 text-[14px] text-[var(--ev-muted)]">Register as Online and we&apos;ll send you the link and reminders.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Faq({ items, H }: { items: { q: string; a: string }[]; H: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section>
      <SectionTitle id="faq" kicker="Questions" title="Good to know" H={H} />
      <ul className={cx(card, "divide-y divide-[var(--ev-line)]")}>
        {items.map((f, i) => (
          <li key={i}>
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-5 py-4 text-left" aria-expanded={open === i}>
              <span className="flex-1 text-[16px] font-semibold">{f.q}</span><ChevronDown size={18} className={cx("shrink-0 transition", open === i && "rotate-180")} />
            </button>
            {open === i && <p className="-mt-1 px-5 pb-5 text-[15px] leading-relaxed text-[var(--ev-muted)]">{f.a}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Gallery({ images, H }: { images: string[]; H: string }) {
  const [big, setBig] = useState<string | null>(null);
  return (
    <section>
      <SectionTitle id="gallery" kicker="Gallery" title="Moments from before" H={H} />
      <div className="columns-2 gap-3 md:columns-3 [&>button]:mb-3">
        {images.map((src, i) => <button key={i} onClick={() => setBig(src)} className="block w-full overflow-hidden rounded-2xl"><img src={src} alt="" className="w-full transition duration-500 hover:scale-105" loading="lazy" /></button>)}
      </div>
      {big && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setBig(null)} role="dialog" aria-modal aria-label="Photo"><img src={big} alt="" className="max-h-[90vh] max-w-full rounded-2xl" /></div>}
    </section>
  );
}

function Stay({ items, H }: { items: NonNullable<ChurchEvent["stay"]>; H: string }) {
  return (
    <section>
      <SectionTitle id="stay" kicker="Coming from far?" title="Where to stay" H={H} />
      <div className="grid gap-3 md:grid-cols-2">{items.map((s, i) => (
        <div key={i} className={cx(card, "flex gap-4 p-5")}>
          <BedDouble size={22} className="shrink-0 text-[var(--ev-accent)]" />
          <div className="min-w-0"><p className="font-semibold">{s.name}</p>{s.note && <p className="text-[14px] text-[var(--ev-muted)]">{s.note}</p>}
            <div className="mt-2 flex flex-wrap gap-3 text-[14px] font-medium text-[var(--ev-accent)]">{s.url && <a href={s.url} target="_blank" rel="noreferrer">Book</a>}{s.phone && <a href={`tel:${s.phone}`}>Call</a>}</div></div>
        </div>
      ))}</div>
    </section>
  );
}

function Give({ give, H }: { give: NonNullable<ChurchEvent["give"]>; H: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section>
      <SectionTitle id="give" kicker="Partner with us" title={give.label ?? "Give towards this event"} H={H} />
      <div className={cx(card, "flex flex-col gap-5 p-6 sm:flex-row sm:flex-wrap sm:items-center")}>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: "var(--ev-accent)" }}><Gift size={22} /></span>
        {give.account ? (
          <div className="min-w-0 flex-1">
            <p className="text-[13px] uppercase tracking-wider text-[var(--ev-muted)]">{give.bank}</p>
            <p className="num text-[26px] font-semibold tracking-wider">{give.account}</p>
            <p className="text-[14px] text-[var(--ev-muted)]">{give.accountName}</p>
          </div>
        ) : <p className="flex-1 text-[15px] text-[var(--ev-muted)]">Every gift helps us welcome more people.</p>}
        {give.account && <button onClick={() => { navigator.clipboard?.writeText(give.account!); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold ring-1 ring-[var(--ev-line)]">{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy number"}</button>}
        {give.url && <a href={give.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[var(--ev-accent)] px-4 py-2.5 text-[14px] font-semibold text-white">Give online <ArrowRight size={15} /></a>}
      </div>
    </section>
  );
}

function Partners({ items, H }: { items: NonNullable<ChurchEvent["partners"]>; H: string }) {
  return (
    <section>
      <SectionTitle id="partners" kicker="With thanks to" title="Our partners" H={H} />
      <div className="flex flex-wrap items-center gap-3">{items.map((p, i) => (
        <span key={i} className={cx(card, "flex h-16 min-w-32 items-center justify-center px-5")}>{p.logo ? <img src={p.logo} alt={p.name} className="max-h-9 max-w-36 object-contain" /> : <span className="font-semibold text-[var(--ev-muted)]">{p.name}</span>}</span>
      ))}</div>
    </section>
  );
}

function Contact({ e, church, H, share, url }: { e: ChurchEvent; church: ChurchInfo; H: string; share: string; url: string }) {
  const c = e.contact;
  const wa = c?.whatsapp ? digits(c.whatsapp).replace(/^0/, "234") : undefined;
  return (
    <section>
      <SectionTitle id="contact" kicker="Guest services" title="Need help?" H={H} />
      <div className={cx(card, "p-5 md:p-6")}>
        <p className="text-[15px] text-[var(--ev-muted)]">{c?.name ?? `${church.name} guest services`} will help with registration, directions and anything else.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {c?.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold ring-1 ring-[var(--ev-line)]"><Phone size={15} /> Call</a>}
          {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello, I have a question about ${e.title}.`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-4 py-2.5 text-[14px] font-semibold text-white"><WhatsAppIcon size={16} /> WhatsApp</a>}
          {c?.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold ring-1 ring-[var(--ev-line)]"><Mail size={15} /> Email</a>}
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold ring-1 ring-[var(--ev-line)]"><Share2 size={15} /> Invite a friend</a>
          {url && <button onClick={() => icsFile(e, church.name, url)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold ring-1 ring-[var(--ev-line)]"><CalendarPlus size={15} /> Add to calendar</button>}
        </div>
      </div>
    </section>
  );
}

// ---------------- Registration: a step at a time ----------------
const field = "w-full rounded-xl bg-[var(--ev-page)] px-3.5 py-3 text-[15.5px] text-[var(--ev-fg)] ring-1 ring-[var(--ev-line)] outline-none placeholder:text-[var(--ev-muted)]/70 focus:ring-2 focus:ring-[var(--ev-accent)]";
const TYPE_INFO: Record<RegType, { icon: typeof UserRound; title: string; body: string }> = {
  individual: { icon: UserRound, title: "Just me", body: "Register yourself" },
  group: { icon: UsersRound, title: "Me and others", body: "Family, friends or your group. Everyone gets a ticket." },
  online: { icon: Wifi, title: "Online", body: "Join from anywhere. We'll send the link." },
};

function QuestionInput({ q, value, onChange }: { q: EventQuestion; value: string; onChange: (v: string) => void }) {
  const opts = q.options ?? [];
  const pick = (o: string) => {
    if (q.type !== "multi") return onChange(o);
    const cur = value ? value.split(" | ") : [];
    onChange((cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]).join(" | "));
  };
  const on = (o: string) => (q.type === "multi" ? (value ? value.split(" | ") : []).includes(o) : value === o);
  return (
    <div>
      <span className="mb-1.5 block text-[14px] font-medium">{q.label}{!q.required && <span className="font-normal text-[var(--ev-muted)]"> (optional)</span>}</span>
      {q.help && <span className="-mt-1 mb-1.5 block text-[12.5px] text-[var(--ev-muted)]">{q.help}</span>}
      {q.type === "choice" || q.type === "multi" || q.type === "yesno" ? (
        <div className={cx("grid gap-1.5", (q.type === "yesno" || opts.length <= 4) && "grid-cols-2")}>
          {(q.type === "yesno" ? ["Yes", "No"] : opts).map((o) => (
            <button type="button" key={o} onClick={() => pick(o)} className={cx("flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] ring-1", on(o) ? "font-semibold ring-2 ring-[var(--ev-accent)]" : "ring-[var(--ev-line)]")} style={on(o) ? { background: "color-mix(in oklab, var(--ev-accent) 12%, transparent)" } : undefined}>
              {q.type === "multi" && <span className={cx("flex size-4.5 shrink-0 items-center justify-center rounded", on(o) ? "bg-[var(--ev-accent)] text-white" : "ring-1 ring-[var(--ev-line)]")}>{on(o) && <Check size={11} />}</span>}{o}
            </button>
          ))}
        </div>
      ) : q.type === "long" ? <textarea rows={3} className={field} value={value} onChange={(x) => onChange(x.target.value)} />
        : <input className={field} value={value} onChange={(x) => onChange(x.target.value)} type={q.type === "date" ? "date" : q.type === "email" ? "email" : "text"} inputMode={q.type === "number" ? "numeric" : q.type === "phone" ? "tel" : undefined} />}
    </div>
  );
}

const blank = (): Attendee => ({ name: "", phone: "", email: "", answers: {} });

function RegisterPanel({ e, church, url, closed, full, onRegister, H }: { e: ChurchEvent; church: ChurchInfo; url: string; closed: boolean; full: boolean; onRegister: (r: RegInput) => Promise<RegResult>; H: string }) {
  const types = regTypesOf(e);
  const days = daysOf(e);
  const [step, setStep] = useState<"type" | "you" | "others" | "done">(types.length > 1 ? "type" : "you");
  const [type, setType] = useState<RegType>(types[0]);
  const [me, setMe] = useState<Attendee>(blank());
  const [others, setOthers] = useState<Attendee[]>([blank()]);
  const [pickDays, setPickDays] = useState(days.map((d) => d.date));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<RegResult | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const go = (s: typeof step) => { setErr(""); setStep(s); topRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const steps = useMemo(() => [...(types.length > 1 ? ["type"] : []), "you", ...(type === "group" ? ["others"] : [])], [types.length, type]);
  const idx = steps.indexOf(step);

  const check = (a: Attendee, who: string, needPhone = true) => {
    if (a.name.trim().length < 2) return `Enter ${who} full name.`;
    if (needPhone && digits(a.phone).length < 10) return `Enter ${who} phone number.`;
    if (a.email && !/^\S+@\S+\.\S+$/.test(a.email)) return `Check ${who} email address.`;
    const miss = e.questions.find((q) => q.required && !a.answers[q.id]?.trim());
    return miss ? `Please answer “${miss.label}”${who === "your" ? "" : ` for ${a.name.split(" ")[0] || "them"}`}.` : "";
  };
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const r = await onRegister({ ...me, name: me.name.trim(), email: me.email?.trim() || undefined, type, days: pickDays, guests: 0, others: type === "group" ? others.map((o) => ({ ...o, name: o.name.trim(), email: o.email?.trim() || undefined })) : [] });
      setRes(r); setStep("done");
    } catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong. Please try again."); }
    setBusy(false);
  };
  const next = () => {
    if (step === "type") return go("you");
    if (step === "you") {
      const m = check(me, "your"); if (m) return setErr(m);
      if (days.length > 1 && !pickDays.length) return setErr("Tick at least one day you'll attend.");
      return type === "group" ? go("others") : void submit();
    }
    if (step === "others") {
      for (const [i, o] of others.entries()) { const m = check(o, `person ${i + 2}'s`, false); if (m) return setErr(m); }
      return void submit();
    }
  };

  if (closed) return <div className={cx(card, "p-6 text-center")}><p className={cx(H, "text-[22px] font-semibold")}>Registration has closed</p><p className="mt-1 text-[14px] text-[var(--ev-muted)]">Thank you for your interest. See you next time!</p></div>;
  if (step === "done" && res) return <Tickets e={e} church={church} url={url} res={res} H={H} />;

  return (
    <div ref={topRef} className={cx(card, "scroll-mt-24 overflow-hidden")}>
      <div className="flex items-center gap-2.5 border-b border-[var(--ev-line)] px-5 py-4">
        <Ticket size={20} className="text-[var(--ev-accent)]" />
        <h2 className={cx(H, "text-[20px] font-semibold")}>Register</h2>
        <span className="ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold text-white" style={{ background: "var(--ev-accent)" }}>Free</span>
      </div>
      {steps.length > 1 && (
        <div className="flex gap-1.5 px-5 pt-4" aria-label={`Step ${idx + 1} of ${steps.length}`}>{steps.map((s, i) => <span key={s} className={cx("h-1.5 flex-1 rounded-full", i <= idx ? "bg-[var(--ev-accent)]" : "bg-[var(--ev-line)]")} />)}</div>
      )}
      <div className="space-y-4 p-5">
        {full && <p className="rounded-xl px-3 py-2 text-[13.5px]" style={{ background: "color-mix(in oklab, #f59e0b 18%, transparent)" }}>It&apos;s full. Register to join the waiting list.</p>}

        {step === "type" && (
          <div className="space-y-2">
            <p className="text-[14px] text-[var(--ev-muted)]">How are you coming?</p>
            {types.map((t) => { const I = TYPE_INFO[t]; return (
              <button key={t} type="button" onClick={() => setType(t)} className={cx("flex w-full items-center gap-3 rounded-2xl p-4 text-left ring-1", type === t ? "ring-2 ring-[var(--ev-accent)]" : "ring-[var(--ev-line)]")} style={type === t ? { background: "color-mix(in oklab, var(--ev-accent) 9%, transparent)" } : undefined}>
                <span className="flex size-10 items-center justify-center rounded-xl text-white" style={{ background: "var(--ev-accent)" }}><I.icon size={18} /></span>
                <span className="flex-1"><b className="block text-[15px]">{I.title}</b><span className="text-[13px] text-[var(--ev-muted)]">{I.body}</span></span>
                <span className={cx("flex size-5 items-center justify-center rounded-full ring-2", type === t ? "bg-[var(--ev-accent)] ring-[var(--ev-accent)] text-white" : "ring-[var(--ev-line)]")}>{type === t && <Check size={12} />}</span>
              </button>
            ); })}
          </div>
        )}

        {step === "you" && (
          <>
            <p className="text-[14px] text-[var(--ev-muted)]">{type === "group" ? "First, your details." : "Your details."}</p>
            <AttendeeFields a={me} set={setMe} questions={e.questions} requirePhone />
            {days.length > 1 && (
              <div>
                <span className="mb-1.5 block text-[14px] font-medium">Which days will you come?</span>
                <div className="grid gap-1.5">{days.map((d, i) => { const on = pickDays.includes(d.date); return (
                  <button type="button" key={d.date} onClick={() => setPickDays(on ? pickDays.filter((x) => x !== d.date) : [...pickDays, d.date].sort())} className={cx("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] ring-1", on ? "ring-2 ring-[var(--ev-accent)]" : "ring-[var(--ev-line)]")}>
                    <span className={cx("flex size-5 items-center justify-center rounded-md", on ? "bg-[var(--ev-accent)] text-white" : "ring-1 ring-[var(--ev-line)]")}>{on && <Check size={12} />}</span>
                    <span className="flex-1">Day {i + 1}: {fmtDay(d.date, { weekday: "short", day: "numeric", month: "short" })}</span><span className="text-[12.5px] text-[var(--ev-muted)]">{t12(d.start)}</span>
                  </button>
                ); })}</div>
              </div>
            )}
          </>
        )}

        {step === "others" && (
          <>
            <p className="text-[14px] text-[var(--ev-muted)]">Who is coming with you? Each person gets their own ticket.</p>
            {others.map((o, i) => (
              <div key={i} className="rounded-2xl p-4 ring-1 ring-[var(--ev-line)]">
                <div className="mb-3 flex items-center justify-between"><b className="text-[14px]">Person {i + 2}</b>{others.length > 1 && <button type="button" onClick={() => setOthers(others.filter((_, j) => j !== i))} className="text-[13px] text-[var(--ev-muted)] hover:text-[#e11d48]">Remove</button>}</div>
                <AttendeeFields a={o} set={(v) => setOthers(others.map((x, j) => (j === i ? v : x)))} questions={e.questions} />
              </div>
            ))}
            {others.length < 20 && <button type="button" onClick={() => setOthers([...others, blank()])} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[14px] font-semibold border border-dashed border-[var(--ev-line)]"><Plus size={15} /> Add another person</button>}
          </>
        )}

        {err && <p className="rounded-xl px-3 py-2 text-[14px] text-[#be123c]" style={{ background: "#ffe4e6" }} role="alert">{err}</p>}
        <div className="flex gap-2">
          {idx > 0 && <button type="button" onClick={() => go(steps[idx - 1] as typeof step)} className="flex items-center gap-1.5 rounded-2xl px-4 py-3.5 text-[15px] font-semibold ring-1 ring-[var(--ev-line)]"><ArrowLeft size={16} /> Back</button>}
          <button type="button" disabled={busy} onClick={next} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--ev-accent)] py-3.5 text-[16px] font-semibold text-white shadow-lg disabled:opacity-60">
            {busy ? "Registering…" : step === "type" || (step === "you" && type === "group") ? <>Continue <ArrowRight size={16} /></> : type === "group" ? `Register ${others.length + 1} people` : e.needsApproval ? "Request a place" : "Register"}
          </button>
        </div>
        <p className="text-center text-[12px] text-[var(--ev-muted)]">{church.name} will use these details for this event{e.followup ? " and to stay in touch" : ""}.</p>
      </div>
    </div>
  );
}

function AttendeeFields({ a, set, questions, requirePhone }: { a: Attendee; set: (a: Attendee) => void; questions: EventQuestion[]; requirePhone?: boolean }) {
  return (
    <div className="space-y-3">
      <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Full name</span><input className={field} value={a.name} onChange={(x) => set({ ...a, name: x.target.value })} autoComplete={requirePhone ? "name" : "off"} /></label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Phone number{!requirePhone && <span className="font-normal text-[var(--ev-muted)]"> (optional)</span>}</span><input className={field} inputMode="tel" value={a.phone} onChange={(x) => set({ ...a, phone: x.target.value })} autoComplete={requirePhone ? "tel" : "off"} /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Email <span className="font-normal text-[var(--ev-muted)]">(optional)</span></span><input className={field} type="email" value={a.email} onChange={(x) => set({ ...a, email: x.target.value })} autoComplete={requirePhone ? "email" : "off"} /></label>
      </div>
      {questions.map((q) => <QuestionInput key={q.id} q={q} value={a.answers[q.id] ?? ""} onChange={(v) => set({ ...a, answers: { ...a.answers, [q.id]: v } })} />)}
    </div>
  );
}

/** One ticket per person, with a QR code for the door. */
function Tickets({ e, church, url, res, H }: { e: ChurchEvent; church: ChurchInfo; url: string; res: RegResult; H: string }) {
  const list = res.tickets?.length ? res.tickets : [{ name: "", ticket: res.ticket, status: res.status }];
  const st = res.status;
  return (
    <div className="space-y-3">
      <Confetti show={st === "confirmed"} />
      <div className={cx(card, "p-5 text-center")}>
        <p className={cx(H, "text-[24px] font-semibold")}>{st === "confirmed" ? "You're in!" : st === "already" ? "You're already registered" : st === "waitlist" ? "You're on the waiting list" : "Thank you! We'll confirm soon"}</p>
        <p className="mt-1 text-[14px] text-[var(--ev-muted)]">{st === "waitlist" ? "We'll let you know if a place opens up." : list.length > 1 ? `${list.length} tickets below. Send each person theirs.` : "Show this ticket at the door."}</p>
      </div>
      {list.map((t) => (
        <div key={t.ticket} className="relative overflow-hidden rounded-3xl bg-white text-[#111] shadow-xl ring-1 ring-black/5">
          <div className="p-5 text-white" style={{ background: e.flyer ? `linear-gradient(90deg, rgba(0,0,0,.75), rgba(0,0,0,.35)), url(${e.flyer}) center/cover` : COVERS[e.cover % COVERS.length] }}>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-white/75">{church.name}</p>
            <p className="mt-1 font-display text-[20px] font-bold leading-tight">{e.title}</p>
            <p className="mt-1 text-[13px] text-white/85">{whenLine(e)}</p>
          </div>
          <div className="relative flex items-center gap-4 p-5">
            <span aria-hidden className="absolute -left-3 -top-3 size-6 rounded-full" style={{ background: "var(--ev-page)" }} /><span aria-hidden className="absolute -right-3 -top-3 size-6 rounded-full" style={{ background: "var(--ev-page)" }} />
            <QR value={t.ticket} size={112} />
            <div className="min-w-0">
              {t.name && <p className="truncate text-[16px] font-semibold">{t.name}</p>}
              <p className="num mt-1 text-[20px] font-bold tracking-[.12em]">{t.ticket}</p>
              <p className="mt-1 text-[12.5px] text-[#666]">{t.status === "confirmed" ? "Confirmed" : t.status === "waitlist" ? "Waiting list" : t.status === "pending" ? "Waiting for approval" : "Registered"}</p>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Your ticket for ${e.title}: ${t.ticket}\n${whenLine(e)}\n${url}`)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#128c4a]"><WhatsAppIcon size={14} /> Send ticket</a>
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => icsFile(e, church.name, url)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--ev-card)] py-3 text-[14px] font-semibold ring-1 ring-[var(--ev-line)]"><CalendarPlus size={15} /> Add to calendar</button>
        <button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--ev-card)] py-3 text-[14px] font-semibold ring-1 ring-[var(--ev-line)]"><Download size={15} /> Save</button>
      </div>
    </div>
  );
}

/** After the event: a short feedback form, if the church switched it on. */
function FeedbackForm({ e, H, onSend }: { e: ChurchEvent; H: string; onSend: (ticket: string, answers: Record<string, string>) => Promise<void> }) {
  const [ticket, setTicket] = useState("");
  const [a, setA] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const qs = e.feedback?.questions ?? [];
  return (
    <section>
      <SectionTitle id="feedback" kicker="Thank you for coming" title="How was it?" H={H} />
      <div className={cx(card, "space-y-4 p-5 md:p-6")}>
        {done ? <p className="flex items-center gap-2 text-[16px] font-semibold"><Check className="text-[#10b981]" /> Thank you! Your feedback helps us plan the next one.</p> : (
          <>
            <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Your ticket code</span><input className={cx(field, "uppercase")} value={ticket} onChange={(x) => setTicket(x.target.value)} placeholder="RISE-XXXXXX" /></label>
            {qs.map((q) => <QuestionInput key={q.id} q={q} value={a[q.id] ?? ""} onChange={(v) => setA({ ...a, [q.id]: v })} />)}
            {err && <p className="text-[14px] text-[#be123c]" role="alert">{err}</p>}
            <button onClick={async () => { setErr(""); if (ticket.trim().length < 4) return setErr("Enter the code on your ticket."); try { await onSend(ticket.trim().toUpperCase(), a); setDone(true); } catch (x) { setErr(x instanceof Error ? x.message : "That didn't work."); } }}
              className="rounded-2xl bg-[var(--ev-accent)] px-5 py-3 text-[15px] font-semibold text-white">Send feedback</button>
          </>
        )}
      </div>
    </section>
  );
}

