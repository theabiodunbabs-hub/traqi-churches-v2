"use client";

import { copyText, savePicture } from "@/lib/share";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, BedDouble, CalendarPlus, Check, ChevronDown, Clock, Copy, Download, Gift, Globe, Image as ImageIcon, Lock, Mail, MapPin, Navigation,
  Phone, Plus, Quote, Radio, Share2, Ticket, UserRound, Users, UsersRound, Wifi, X,
} from "lucide-react";
import { Confetti, cx } from "./ui";
import { COVERS, ChurchMark } from "./brand";
import { QR } from "./public";
import { WhatsAppIcon } from "./care";
import { usePublicTheme } from "./theme";
import { ChoiceMenu } from "./choice-menu";
import { BirthdayPicker } from "./birthday-picker";
import { birthdayParts } from "@/lib/format";
import { MEMBER_PARAM, REGISTER_PARAM, genderAnswer, isGenderQuestion, type MemberStatus } from "@/lib/event-join";
import { digits } from "@/lib/format";
import { ticketCanvas, saveCanvas, shareCanvas, type Format } from "@/lib/keepsake";
import { daysOf, eventPath, happeningNow, isRequired, isShirtSize, joinName, lagosISO, peopleOf, regTypesOf, showsDropdown, themeOf } from "@/lib/events";
import { shareImage } from "@/lib/share-image";
import { saveBlob } from "@/lib/download";
import type { ChurchEvent, ChurchProfile, EventPerson, EventQuestion, RegType } from "@/lib/types";

/** One person registering. First and last name are asked separately; `name` is both together. */
export type Attendee = { firstName?: string; lastName?: string; name: string;
  /** Their WhatsApp number. */ phone: string;
  /** Their hotline or call number. */ altPhone?: string;
  email?: string; answers: Record<string, string> };
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
export function EventLanding({ e, church, registered, recent = [], onRegister, onFeedback, member, preview }: {
  e: ChurchEvent; church: ChurchInfo; registered: number; recent?: string[];
  onRegister: (r: RegInput) => Promise<RegResult>; onFeedback?: (ticket: string, answers: Record<string, string>) => Promise<void>;
  /** Members register with Google, which also joins them to the church. Off in the in-app preview. */
  member?: MemberFlow; preview?: boolean;
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
  const regOn = e.registration !== false;
  const closed = ended || (!!e.closesAt && Date.parse(e.closesAt) < now);
  const showReg = regOn && !closed;
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
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
          {showReg && <a href="#register" className="ml-auto rounded-full bg-[var(--ev-accent)] px-4 py-2 text-[14px] font-semibold text-white shadow-lg shadow-black/10 md:ml-2">Register</a>}
        </div>
      </nav>

      {live && !ended && <LiveBar e={e} live={live} people={people} />}

      {e.template === "bold" ? <BoldHero e={e} church={church} registered={registered} recent={recent} people={people} closed={!showReg} H={H} />
        : e.template === "elegant" ? <ElegantHero e={e} church={church} registered={registered} recent={recent} closed={!showReg} H={H} />
        : <FlyerHero e={e} church={church} registered={registered} recent={recent} closed={!showReg} H={H} color={color} />}

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

          <aside id="register" className="scroll-mt-20 pt-12 lg:sticky lg:top-16 lg:h-fit lg:max-h-[calc(100dvh-4.5rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pb-6 lg:[scrollbar-width:thin]">
            {regOn ? <RegisterPanel e={e} church={church} url={url} closed={closed} full={full} onRegister={onRegister} member={preview ? undefined : member} H={H} />
              : <div className={cx(card, "p-6 text-center")}><p className={cx(H, "text-[22px] font-semibold")}>No registration needed</p><p className="mt-1 text-[14px] text-[var(--ev-muted)]">Just come. Everyone is welcome.</p></div>}
            {url && !closed && (
              <div className="mt-4 flex items-center gap-4 rounded-3xl bg-[var(--ev-card)] p-4 ring-1 ring-[var(--ev-line)]">
                <div className="rounded-xl bg-white p-1.5"><QR value={url} size={78} /></div>
                <div className="min-w-0 text-[13px] text-[var(--ev-muted)]"><p>Scan to open on another phone, or share:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" className="flex size-9 items-center justify-center rounded-xl bg-[#25d366] text-white" aria-label="Share on WhatsApp"><WhatsAppIcon size={17} /></a>
                    <button type="button" onClick={() => { void copyText(url, "Copy the event link").then((ok) => { if (ok) { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800); } }); }} className={cx("flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ring-1", linkCopied ? "text-[#059669] ring-[#059669]" : "text-[var(--ev-fg)] ring-[var(--ev-line)]")} aria-label="Copy the event link">{linkCopied ? <Check size={15} /> : <Copy size={15} />}<span aria-live="polite">{linkCopied ? "Copied" : "Copy link"}</span></button>
                    <button type="button" disabled={imgBusy} onClick={async () => { setImgBusy(true); try { await savePicture(await shareImage(e, { name: church.name, color: church.profile?.color, logo: church.profile?.logo }, url), `${e.slug}-share.png`, { title: e.title, text: share }); } catch { alert("Couldn't make the picture. Please try again."); } finally { setImgBusy(false); } }} className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-[var(--ev-fg)] ring-1 ring-[var(--ev-line)] disabled:opacity-60" aria-label="Save the share picture"><ImageIcon size={15} />{imgBusy ? "Making…" : "Image"}</button>
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

      {showReg && (
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
    <div className="flex gap-2" role="timer" aria-label="Time until it starts">{parts.map(([n, l]) => (
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
            <span className="text-[12px] font-semibold uppercase tracking-[.25em] text-white/70">Featuring</span>
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
          <button type="button" key={p.id} onClick={() => setOpen(p)} className={cx(card, "group overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-xl")}>
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
            <button type="button" onClick={() => setOpen(null)} className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--ev-muted)] hover:bg-black/5" aria-label="Close"><X size={18} /></button>
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
          <button type="button" key={x.date} onClick={() => setD(i)} className={cx("shrink-0 rounded-2xl px-4 py-2.5 text-left ring-1 transition", i === d ? "bg-[var(--ev-accent)] text-white ring-transparent" : "bg-[var(--ev-card)] ring-[var(--ev-line)]")}>
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
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-5 py-4 text-left" aria-expanded={open === i}>
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
        {images.map((src, i) => <button type="button" key={i} onClick={() => setBig(src)} className="block w-full overflow-hidden rounded-2xl"><img src={src} alt="" className="w-full transition duration-500 hover:scale-105" loading="lazy" /></button>)}
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
        {give.account && <button type="button" onClick={() => { void copyText(give.account!, "Copy the account number").then((ok) => { if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold ring-1 ring-[var(--ev-line)]">{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy number"}</button>}
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
          {url && <button type="button" onClick={() => icsFile(e, church.name, url)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold ring-1 ring-[var(--ev-line)]"><CalendarPlus size={15} /> Add to calendar</button>}
        </div>
      </div>
    </section>
  );
}

// ---------------- Registration: a step at a time ----------------
const field = "w-full rounded-xl bg-[var(--ev-page)] px-3.5 py-3 text-[15.5px] text-[var(--ev-fg)] ring-1 ring-[var(--ev-line)] outline-none placeholder:text-[var(--ev-muted)]/70 focus:ring-2 focus:ring-[var(--ev-accent)]";
const TYPE_INFO: Record<RegType, { icon: typeof UserRound; title: string; body: string }> = {
  individual: { icon: UserRound, title: "In person", body: "Come to the venue" },
  group: { icon: UsersRound, title: "Me and others", body: "Family, friends or your group. Everyone gets a ticket." },
  online: { icon: Wifi, title: "Online", body: "Join from anywhere. We'll send the link." },
};

function QuestionInput({ q, value, onChange, required }: { q: EventQuestion; value: string; onChange: (v: string) => void; required: boolean }) {
  const opts = q.options ?? [];
  const pick = (o: string) => {
    if (q.type !== "multi") return onChange(o);
    const cur = value ? value.split(" | ") : [];
    onChange((cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]).join(" | "));
  };
  const on = (o: string) => (q.type === "multi" ? (value ? value.split(" | ") : []).includes(o) : value === o);
  return (
    <div>
      <span className="mb-1.5 block text-[14px] font-medium">{q.label}{!required && <span className="font-normal text-[var(--ev-muted)]"> (optional)</span>}</span>
      {q.help && <span className="-mt-1 mb-1.5 block text-[12.5px] text-[var(--ev-muted)]">{q.help}</span>}
      {showsDropdown(q) ? (
        <ChoiceMenu label={q.label} options={opts} value={opts.includes(value) ? value : ""} onChange={onChange} placeholder={isShirtSize(q.label) ? "Choose a size" : "Choose one"} />
      ) : q.type === "choice" || q.type === "multi" || q.type === "yesno" ? (
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

const blank = (): Attendee => ({ firstName: "", lastName: "", name: "", phone: "", altPhone: "", email: "", answers: {} });

/**
 * How a member registers: the page asks Google who they are, then either sends them Home (already in the church)
 * or shows the form filled in from Google, which registers them and joins them to the church.
 * Live mode signs in with Google; the demo offers pretend Google accounts.
 */
export type MemberFlow = {
  status: () => Promise<MemberStatus>;
  /** Signs out whoever was signed in on this phone, then asks Google which account (live: leaves the page). */
  google: () => Promise<void>;
  /** Demo only: pretend Google accounts to choose from. */
  accounts?: { key: string; name: string; email: string; note: string }[];
  pick?: (key: string) => void;
  register: (r: MemberReg) => Promise<RegResult>;
  /** Home, where their ticket waits. */
  dashboard: () => void;
  /** Already signed in as a member (inside the app): no question, no Google, the form comes filled in. */
  known?: boolean;
};
export type MemberReg = RegInput & { gender: "M" | "F"; birthday: string };

type Step = "who" | "google" | "checking" | "type" | "you" | "done" | "home";

function RegisterPanel({ e, church, url, closed, full, onRegister, member, H }: { e: ChurchEvent; church: ChurchInfo; url: string; closed: boolean; full: boolean; onRegister: (r: RegInput) => Promise<RegResult>; member?: MemberFlow; H: string }) {
  // Member or invited → in person or online → (members: Google) → the form. "Register someone else" comes after.
  const offered = (() => { const t = regTypesOf(e).filter((x) => x !== "group"); return t.length ? t : (["individual"] as RegType[]); })();
  const types: RegType[] = ["individual", "online"];
  const days = daysOf(e);
  const start: Step = member && !member.known ? "who" : "type";
  const [step, setStep] = useState<Step>(start);
  const [asMember, setAsMember] = useState(!!member?.known);
  /** Already in the church: the button says Register, not Register and join. */
  const [inChurch, setInChurch] = useState(!!member?.known);
  const [type, setType] = useState<RegType>(offered[0]);
  const [me, setMe] = useState<Attendee>(blank());
  const [gender, setGender] = useState<"" | "M" | "F">("");
  const [birthday, setBirthday] = useState("");
  const [lockedEmail, setLockedEmail] = useState("");
  const [pickDays, setPickDays] = useState(days.map((d) => d.date));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [mine, setMine] = useState<RegTicket[]>([]);
  const [last, setLast] = useState<RegResult["status"] | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const go = (s: Step) => { setErr(""); setStep(s); topRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const churchShort = church.name.split(/[,(]/)[0].trim();
  const genderQ = asMember ? e.questions.find(isGenderQuestion) : undefined;
  const questions = genderQ ? e.questions.filter((q) => q.id !== genderQ.id) : e.questions;
  // The in person / online choice survives the trip to Google and back
  const typeKey = `traqi-reg-type:${e.id}`;
  const keepType = (t: RegType) => { setType(t); try { sessionStorage.setItem(typeKey, t); } catch { /* storage unavailable */ } };

  // Who signed in with Google: registered already → Home (their ticket is there); otherwise the form, filled in
  const resolve = async () => {
    if (!member) return;
    setAsMember(true); go("checking");
    try {
      const s = await member.status();
      if (!s.signedIn) return go("google");
      if (s.member && s.tickets.length) {
        if (member.known) { setMine(s.tickets); setLast("already"); return go("done"); }
        go("home"); member.dashboard(); return;
      }
      const p = s.person;
      const firstName = p?.firstName || s.firstName || "", lastName = p?.lastName || s.lastName || "";
      setMe({ ...blank(), firstName, lastName, name: joinName(firstName, lastName), phone: p?.phone ?? "", email: s.email || p?.email || "" });
      setLockedEmail(s.email || p?.email || "");
      setGender(p?.gender ?? ""); setBirthday(p?.birthday ?? "");
      setInChurch(s.member);
      go("you");
    } catch (x) { setErr(x instanceof Error ? x.message : "Couldn't check your account. Try again."); setStep("google"); }
  };
  useEffect(() => {
    if (!member || member.known || typeof window === "undefined") return;
    const q = new URLSearchParams(location.search);
    if (!q.get(MEMBER_PARAM)) return;
    setAsMember(true);
    // From Home ("Register now"): already signed in, so ask in person or online, then the form
    if (q.get(REGISTER_PARAM)) return go("type");
    // Back from Google: the choice made before leaving
    let t: string | null = null; try { t = sessionStorage.getItem(typeKey); } catch { /* storage unavailable */ }
    if (t === "individual" || t === "online") setType(t);
    void resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pickType = (t: RegType) => {
    keepType(t);
    if (!asMember || !member) return go("you");
    const fromHome = typeof window !== "undefined" && !!new URLSearchParams(location.search).get(REGISTER_PARAM);
    if (member.known || fromHome) void resolve(); else go("google");
  };

  const check = (a: Attendee) => {
    if (!a.firstName?.trim()) return "Enter the first name.";
    if (!a.lastName?.trim()) return "Enter the last name.";
    if (digits(a.phone).length < 10) return "Enter your WhatsApp number, with at least 10 digits.";
    if (!a.email?.trim()) return "Enter the email address.";
    if (!/^\S+@\S+\.\S+$/.test(a.email.trim())) return "Check the email address.";
    if (asMember && !birthdayParts(birthday)) return "Choose your birthday (day and month).";
    if (asMember && !gender) return "Choose male or female.";
    const miss = questions.find((q) => isRequired(q) && !a.answers[q.id]?.trim());
    return miss ? `Please answer “${miss.label}”.` : "";
  };
  const submit = async () => {
    const m = check(me); if (m) return setErr(m);
    if (days.length > 1 && !pickDays.length) return setErr("Tick at least one day you'll attend.");
    setBusy(true); setErr("");
    const firstName = me.firstName!.trim(), lastName = me.lastName!.trim(), name = joinName(firstName, lastName);
    const answers = genderQ && gender ? { ...me.answers, [genderQ.id]: genderAnswer(genderQ, gender) } : me.answers;
    const input: RegInput = { ...me, answers, firstName, lastName, name, altPhone: me.altPhone?.trim() || undefined, email: (lockedEmail || me.email!).trim(), type, days: pickDays, guests: 0, others: [] };
    try {
      if (asMember && member) {
        const r = await member.register({ ...input, gender: gender as "M" | "F", birthday });
        try { sessionStorage.removeItem(typeKey); } catch { /* storage unavailable */ }
        if (member.known) {
          const got = r.tickets?.length ? r.tickets : [{ name, ticket: r.ticket, status: r.status }];
          setMine(got); setLast(r.status); go("done");
        } else { go("home"); member.dashboard(); }
      } else {
        const r = await onRegister(input);
        const got = r.tickets?.length ? r.tickets : [{ name, ticket: r.ticket, status: r.status }];
        setMine((x) => [...x.filter((t) => !got.some((g) => g.ticket === t.ticket)), ...got.map((t) => ({ ...t, name: t.name || name }))]);
        setLast(r.status); go("done");
      }
    } catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong. Please try again."); }
    setBusy(false);
  };
  const another = () => { setMe(blank()); setAsMember(!!member?.known); setInChurch(!!member?.known); setGender(""); setBirthday(""); setLockedEmail(""); setPickDays(days.map((d) => d.date)); go(start); };
  const back = () => go(step === "google" ? "type" : step === "type" ? "who" : "type");

  if (closed && !mine.length) return <div className={cx(card, "p-6 text-center")}><p className={cx(H, "text-[22px] font-semibold")}>Registration has closed</p><p className="mt-1 text-[14px] text-[var(--ev-muted)]">Thank you for your interest. See you next time!</p></div>;
  if (step === "done" && last) return <Tickets e={e} church={church} url={url} tickets={mine} status={last} H={H} onAnother={closed ? undefined : another} />;

  const choice = (key: string, icon: ReactNode, title: string, body: string, onClick: () => void) => (
    <button key={key} type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left ring-1 ring-[var(--ev-line)] transition hover:ring-2 hover:ring-[var(--ev-accent)]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: "var(--ev-accent)" }}>{icon}</span>
      <span className="flex-1"><b className="block text-[15px]">{title}</b><span className="text-[13px] text-[var(--ev-muted)]">{body}</span></span>
      <ArrowRight size={16} className="text-[var(--ev-muted)]" />
    </button>
  );

  return (
    <div ref={topRef} className={cx(card, "scroll-mt-24 overflow-hidden")}>
      <div className="flex items-center gap-2.5 border-b border-[var(--ev-line)] px-5 py-4">
        <Ticket size={20} className="text-[var(--ev-accent)]" />
        <h2 className={cx(H, "text-[20px] font-semibold")}>{mine.length ? "Register someone else" : "Register"}</h2>
        <span className="ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold text-white" style={{ background: "var(--ev-accent)" }}>Free</span>
      </div>
      <div className="space-y-4 p-5">
        {full && <p className="rounded-xl px-3 py-2 text-[13.5px]" style={{ background: "color-mix(in oklab, #f59e0b 18%, transparent)" }}>It&apos;s full. Register to join the waiting list.</p>}
        {mine.length > 0 && <p className="rounded-xl px-3 py-2 text-[13.5px]" style={{ background: "color-mix(in oklab, var(--ev-accent) 10%, transparent)" }}>{mine.length} {mine.length === 1 ? "ticket" : "tickets"} so far. Each person gets their own.</p>}

        {step === "who" && (
          <div className="space-y-2">
            {choice("member", <BadgeCheck size={18} />, `A member of ${churchShort}?`, "Continue here", () => { setAsMember(true); setInChurch(false); go("type"); })}
            {choice("guest", <UserRound size={18} />, "Invited", "Continue with the form", () => { setAsMember(false); go("type"); })}
          </div>
        )}

        {step === "google" && member && (
          <div className="space-y-3">
            <p className="text-[14.5px]">Continue registration with your Google account. This also creates an account for you if you don&apos;t have one.</p>
            {!choosing || !member.accounts ? (
              <button type="button" disabled={busy} onClick={async () => { setErr(""); if (member.accounts) return setChoosing(true); setBusy(true); try { await member.google(); } catch (x) { setErr(x instanceof Error ? x.message : "Couldn't open Google."); setBusy(false); } }}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-3.5 text-[15.5px] font-semibold text-[#1f1f1f] shadow-sm ring-1 ring-black/15 transition hover:shadow-md disabled:opacity-60">
                <GoogleMark /> {busy ? "Opening Google…" : "Continue with Google"}
              </button>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white text-[#1f1f1f] ring-1 ring-black/15">
                <p className="flex items-center gap-2 border-b border-black/10 px-4 py-3 text-[13.5px]"><GoogleMark /> Choose an account <span className="ml-auto rounded-full bg-[#fff4d6] px-2 py-0.5 text-[11px] font-semibold text-[#8a5a00]">Demo</span></p>
                {member.accounts.map((a) => (
                  <button key={a.key} type="button" onClick={() => { member.pick?.(a.key); setChoosing(false); void resolve(); }} className="flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left last:border-0 hover:bg-[#f4f6fb]">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e8eefc] text-[13px] font-semibold text-[#2b4ea2]">{initials(a.name)}</span>
                    <span className="min-w-0 flex-1"><b className="block truncate text-[14px] font-medium">{a.name}</b><span className="block truncate text-[12.5px] text-[#5f6368]">{a.email} · {a.note}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(step === "checking" || step === "home") && (
          <p className="flex items-center gap-2 py-6 text-[15px]"><span className="size-4 animate-spin rounded-full border-2 border-[var(--ev-accent)] border-t-transparent" /> {step === "home" ? "Taking you to your Home…" : "Checking your account…"}</p>
        )}

        {step === "type" && (
          <div className="space-y-2">
            <p className="text-[14px] text-[var(--ev-muted)]">How are you joining?</p>
            {types.map((t) => {
              const I = TYPE_INFO[t];
              if (offered.includes(t)) return choice(t, <I.icon size={18} />, I.title, I.body, () => pickType(t));
              return (
                <div key={t} aria-disabled="true" className="flex w-full items-center gap-3 rounded-2xl p-4 opacity-55 ring-1 ring-[var(--ev-line)]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-[var(--ev-line)]"><I.icon size={18} /></span>
                  <span className="flex-1"><b className="block text-[15px]">{I.title}</b><span className="text-[13px] text-[var(--ev-muted)]">Not offered for this event</span></span>
                </div>
              );
            })}
          </div>
        )}

        {step === "you" && (
          <>
            {asMember && <p className="rounded-xl px-3 py-2 text-[13.5px]" style={{ background: "color-mix(in oklab, var(--ev-accent) 10%, transparent)" }}>Registering as a member of {churchShort}. Check your details below.</p>}
            <AttendeeFields a={me} set={setMe} questions={questions} requirePhone emailLocked={asMember ? lockedEmail : undefined}
              afterEmail={asMember ? (
                <>
                  <div role="group" aria-label="Birthday (day-month only)">
                    <span className="mb-1.5 block text-[14px] font-medium">Birthday <span className="font-normal text-[var(--ev-muted)]">(day-month only)</span></span>
                    <BirthdayPicker value={birthday} onChange={(v) => { setBirthday(v); setErr(""); }} event />
                  </div>
                  <div role="group" aria-label="I am">
                    <span className="mb-1.5 block text-[14px] font-medium">I am</span>
                    <div className="grid grid-cols-2 gap-1.5">{(["F", "M"] as const).map((g) => (
                      <button key={g} type="button" onClick={() => { setGender(g); setErr(""); }} className={cx("rounded-xl px-3 py-2.5 text-[14px] ring-1", gender === g ? "font-semibold ring-2 ring-[var(--ev-accent)]" : "ring-[var(--ev-line)]")} style={gender === g ? { background: "color-mix(in oklab, var(--ev-accent) 12%, transparent)" } : undefined}>{g === "F" ? "Female" : "Male"}</button>
                    ))}</div>
                  </div>
                </>
              ) : undefined} />
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

        {err && <p className="rounded-xl px-3 py-2 text-[14px] text-[#be123c]" style={{ background: "#ffe4e6" }} role="alert">{err}</p>}

        {(step === "google" || step === "type" || step === "you") && (
          <div className="flex gap-2">
            {((step !== start && !(step === "type" && asMember && !member?.known && start === "type")) || mine.length > 0) && (
              <button type="button" onClick={() => (step === start ? go("done") : back())} className="flex items-center gap-1.5 rounded-2xl px-4 py-3.5 text-[15px] font-semibold ring-1 ring-[var(--ev-line)]"><ArrowLeft size={16} /> Back</button>
            )}
            {step === "you" && (
              <button type="button" disabled={busy} onClick={() => void submit()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--ev-accent)] py-3.5 text-[16px] font-semibold text-white shadow-lg disabled:opacity-60">
                {busy ? "Registering…" : asMember && !inChurch ? `Register and join ${churchShort}` : e.needsApproval ? "Request a place" : "Register"}
              </button>
            )}
          </div>
        )}
        <p className="text-center text-[12px] text-[var(--ev-muted)]">{church.name} will use these details for this event{e.followup || asMember ? " and to stay in touch" : ""}.</p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AttendeeFields({ a, set, questions, requirePhone, emailLocked, afterEmail }: { a: Attendee; set: (a: Attendee) => void; questions: EventQuestion[]; requirePhone?: boolean;
  /** A member's Google email: shown, not editable. */ emailLocked?: string; afterEmail?: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">First name</span><input className={field} value={a.firstName ?? ""} onChange={(x) => set({ ...a, firstName: x.target.value, name: joinName(x.target.value, a.lastName) })} autoComplete={requirePhone ? "given-name" : "off"} /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Last name</span><input className={field} value={a.lastName ?? ""} onChange={(x) => set({ ...a, lastName: x.target.value, name: joinName(a.firstName, x.target.value) })} autoComplete={requirePhone ? "family-name" : "off"} /></label>
      </div>
      <div className="grid gap-3">
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Phone number <span className="font-normal text-[var(--ev-muted)]">(your WhatsApp number)</span>{!requirePhone && <span className="font-normal text-[var(--ev-muted)]"> (optional)</span>}</span><input className={field} inputMode="tel" value={a.phone} onChange={(x) => set({ ...a, phone: x.target.value })} autoComplete={requirePhone ? "tel" : "off"} /></label>
        <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Alternative number <span className="font-normal text-[var(--ev-muted)]">(optional - your hotline or call number)</span></span><input className={field} inputMode="tel" value={a.altPhone ?? ""} onChange={(x) => set({ ...a, altPhone: x.target.value })} autoComplete="off" /></label>
        {emailLocked !== undefined ? (
          <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Email <span className="font-normal text-[var(--ev-muted)]">(from your Google account)</span></span>
            <span className="relative block"><input className={cx(field, "cursor-not-allowed pr-10 opacity-80")} type="email" value={emailLocked} readOnly aria-readonly="true" tabIndex={-1} /><Lock size={15} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[var(--ev-muted)]" /></span>
          </label>
        ) : <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Email</span><input className={field} type="email" value={a.email} onChange={(x) => set({ ...a, email: x.target.value })} autoComplete={requirePhone ? "email" : "off"} /></label>}
        {afterEmail}
      </div>
      {questions.map((q) => <QuestionInput key={q.id} q={q} required={isRequired(q)} value={a.answers[q.id] ?? ""} onChange={(v) => set({ ...a, answers: { ...a.answers, [q.id]: v } })} />)}
    </div>
  );
}

/** One ticket per person: a clean card with their name and a QR code for the door, downloadable on its own. */
function Tickets({ e, church, url, tickets, status, H, onAnother }: { e: ChurchEvent; church: ChurchInfo; url: string; tickets: RegTicket[]; status: RegResult["status"]; H: string; onAnother?: () => void }) {
  return (
    <div className="space-y-3">
      <Confetti show={status === "confirmed"} />
      <div className={cx(card, "p-5 text-center")}>
        <p className={cx(H, "text-[24px] font-semibold")}>{status === "confirmed" ? "You're in!" : status === "already" ? "Already registered" : status === "waitlist" ? "You're on the waiting list" : "Thank you! We'll confirm soon"}</p>
        <p className="mt-1 text-[14px] text-[var(--ev-muted)]">{status === "waitlist" ? "We'll let you know if a place opens up." : tickets.length > 1 ? `${tickets.length} tickets below. Send each person theirs.` : "Show this ticket at the door."}</p>
      </div>
      {tickets.map((t) => <TicketCard key={t.ticket} e={e} church={church} url={url} t={t} />)}
      <div className="flex flex-wrap gap-2">
        {onAnother && <button type="button" onClick={onAnother} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--ev-accent)] px-4 text-[14.5px] font-semibold text-white shadow-lg"><Plus size={16} /> Register someone else</button>}
        <button type="button" onClick={() => icsFile(e, church.name, url)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--ev-card)] px-4 text-[14px] font-semibold ring-1 ring-[var(--ev-line)]"><CalendarPlus size={15} /> Add to calendar</button>
      </div>
    </div>
  );
}

const ticketLabel = (st: RegTicket["status"]) => (st === "confirmed" ? "Confirmed" : st === "waitlist" ? "Waiting list" : st === "pending" ? "Waiting for approval" : "Registered");

/** One ticket: name, QR code for the door, and Image / PDF / Send. Used on the event page and on Home. */
export function TicketCard({ e, church, url, t }: { e: ChurchEvent; church: ChurchInfo; url: string; t: RegTicket }) {
  const [busy, setBusy] = useState("");
  const color = church.profile?.color ?? "#4f46e5";
  const info = () => ({ event: e.title, when: whenLine(e), venue: e.mode === "virtual" ? "Online" : e.venue, name: t.name, code: t.ticket, status: ticketLabel(t.status), church: { name: church.name, logo: church.profile?.logo, color } });
  const save = async (f: Format) => { setBusy(f); try { await saveCanvas(await ticketCanvas(info()), `${e.title} ticket ${t.name}`, f); } finally { setBusy(""); } };
  const share = async () => {
    setBusy("share");
    const text = `Ticket for ${e.title}: ${t.ticket}\n${whenLine(e)}\n${url}`;
    try { if (!(await shareCanvas(await ticketCanvas(info()), `${e.title} ticket`, text))) window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); } finally { setBusy(""); }
  };
  const notch = { background: "var(--ev-page, var(--color-page, #f4f3f8))" };
  return (
    <div className="overflow-hidden rounded-3xl bg-white text-[#151226] shadow-xl ring-1 ring-black/5">
      <div className="flex">
        <div className="min-w-0 flex-1 p-5 text-white" style={{ background: `linear-gradient(135deg, ${color}, #151226)` }}>
          <p className="truncate text-[11.5px] font-semibold uppercase tracking-[.18em] text-white/80">{church.name}</p>
          <p className="mt-1.5 font-display text-[19px] font-bold leading-tight">{e.title}</p>
          <p className="mt-1 text-[13px] text-white/85">{whenLine(e)}</p>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[.18em] text-white/70">Admit one</p>
          <p className="truncate text-[17px] font-semibold">{t.name || "Guest"}</p>
        </div>
        <div className="relative flex w-[132px] shrink-0 flex-col items-center justify-center gap-1.5 border-l-2 border-dashed border-[#d6d3e4] p-3">
          <span aria-hidden className="absolute -left-3 -top-3 size-6 rounded-full" style={notch} /><span aria-hidden className="absolute -bottom-3 -left-3 size-6 rounded-full" style={notch} />
          <QR value={t.ticket} size={100} />
          <p className="num text-[14px] font-bold tracking-[.06em]">{t.ticket}</p>
          <p className="text-[11.5px] text-[#6b6885]">{ticketLabel(t.status)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-[#eceaf3] p-2.5">
        <button type="button" disabled={!!busy} onClick={() => void save("png")} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold hover:bg-[#f4f3f8]"><Download size={15} /> {busy === "png" ? "Saving…" : "Image"}</button>
        <button type="button" disabled={!!busy} onClick={() => void save("pdf")} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold hover:bg-[#f4f3f8]"><Download size={15} /> {busy === "pdf" ? "Saving…" : "PDF"}</button>
        <button type="button" disabled={!!busy} onClick={() => void share()} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-semibold text-[#128c4a] hover:bg-[#f4f3f8]"><WhatsAppIcon size={15} /> Send</button>
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
            <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Your ticket code</span><input className={cx(field, "uppercase")} value={ticket} onChange={(x) => setTicket(x.target.value)} placeholder="e.g. CH26-00125" /></label>
            {qs.map((q) => <QuestionInput key={q.id} q={q} required={!!q.required} value={a[q.id] ?? ""} onChange={(v) => setA({ ...a, [q.id]: v })} />)}
            {err && <p className="text-[14px] text-[#be123c]" role="alert">{err}</p>}
            <button type="button" onClick={async () => { setErr(""); if (ticket.trim().length < 4) return setErr("Enter the code on your ticket."); try { await onSend(ticket.trim().toUpperCase(), a); setDone(true); } catch (x) { setErr(x instanceof Error ? x.message : "That didn't work."); } }}
              className="rounded-2xl bg-[var(--ev-accent)] px-5 py-3 text-[15px] font-semibold text-white">Send feedback</button>
          </>
        )}
      </div>
    </section>
  );
}

