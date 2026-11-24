"use client";

import { copyText, savePicture } from "@/lib/share";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, BedDouble, CalendarPlus, Check, ChevronDown, Clock, Copy, Download, Gift, Image as ImageIcon, Lock, Mail, MapPin, Navigation,
  Heart, Phone, Plus, Quote, Radio, Share2, Sparkles, Ticket, UserRound, Users, Wifi, X,
} from "lucide-react";
import { MAX_EXTRAS, categoriesFor, categoryColor, colorsOf, headline, isDark, sectionFilled, textOn, type OptionalKey } from "@/lib/event-page";
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
export type RegInput = Attendee & { type: RegType; days: string[]; guests: number; others: Attendee[];
  /** Ticket category chosen, and the private link's token if it came from one. */ category?: string; categoryToken?: string;
  /** Registering at the venue (with its check-in code). */ venueCode?: string };
export type RegTicket = { name: string; ticket: string; status: "confirmed" | "waitlist" | "pending" | "already"; category?: string };
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

/** Heading type for each look (the colours are the organiser's). */
const HEADING = {
  flyer: "var(--font-display)",
  bold: '"Archivo Variable", ui-sans-serif, system-ui',
  elegant: '"Fraunces Variable", Georgia, serif',
} as const;

/**
 * The public event page (round 8): six core sections (top bar, headline with countdown, when and where, about,
 * closing invitation, footer) and ten optional ones that only appear when filled in.
 * Register opens a full-screen registration page; on phones the Register button stays pinned to the bottom.
 */
export function EventLanding({ e, church, registered, recent = [], onRegister, onFeedback, member, preview }: {
  e: ChurchEvent; church: ChurchInfo; registered: number; recent?: string[];
  onRegister: (r: RegInput) => Promise<RegResult>; onFeedback?: (ticket: string, answers: Record<string, string>) => Promise<void>;
  /** Members register with Google, which also joins them to the church. Off in the in-app preview. */
  member?: MemberFlow; preview?: boolean;
}) {
  usePublicTheme(church.profile);
  const churchColor = church.profile?.color ?? "#4f46e5";
  const col = colorsOf(e, churchColor);
  const [url, setUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  const [regOpen, setRegOpen] = useState(false);
  const [catToken, setCatToken] = useState<string | null>(null);
  useEffect(() => { setUrl(`${location.origin}${eventPath(church.slug, e)}`); }, [church.slug, e]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  // Back from Google, from Home's "Register now", a private category link or #register: open the registration page
  useEffect(() => {
    if (preview) return;
    const q = new URLSearchParams(location.search);
    if (q.get("t")) setCatToken(q.get("t"));
    if (q.get(MEMBER_PARAM) || q.get("t") || location.hash === "#register") setRegOpen(true);
  }, [preview]);
  useEffect(() => {
    if (!regOpen) return;
    const close = () => setRegOpen(false);
    window.addEventListener("popstate", close);
    document.documentElement.style.overflow = "hidden";
    return () => { window.removeEventListener("popstate", close); document.documentElement.style.overflow = ""; };
  }, [regOpen]);
  const openReg = () => { if (!preview && location.hash !== "#register") history.pushState(null, "", "#register"); setRegOpen(true); };
  const closeReg = () => { if (location.hash === "#register") history.back(); else setRegOpen(false); };

  const people = peopleOf(e);
  const live = happeningNow(e, now);
  const ended = Date.parse(e.end) < now;
  const regOn = e.registration !== false;
  const closed = ended || (!!e.closesAt && Date.parse(e.closesAt) < now);
  const showReg = regOn && !closed;
  const full = !!e.capacity && registered >= e.capacity;
  const theme = themeOf(e);
  const filled = (k: OptionalKey) => sectionFilled(e, k);
  const vars = eventVars(e, churchColor);
  const H = "font-[family-name:var(--ev-heading)] tracking-tight";
  const nav = [
    { id: "when", label: "When and where", show: true },
    { id: "about", label: "About", show: true },
    { id: "people", label: "Speakers", show: filled("speakers") },
    { id: "programme", label: "Programme", show: filled("programme") },
    { id: "faq", label: "FAQ", show: filled("faq") },
  ].filter((x) => x.show);
  const share = `*${e.title}*${theme ? `\n${theme}` : ""}\n${whenLine(e)}${e.venue && e.mode !== "virtual" ? `\n${e.venue}` : ""}\n\nRegister free: ${url}`;
  const regLabel = full ? "Join the waiting list" : e.needsApproval ? "Request a place" : "Register";

  return (
    <div className={cx("min-h-screen text-[var(--ev-fg)]", isDark(col.bg) && "dark-tpl")} style={{ ...vars, background: "var(--ev-page)" }}>
      {/* 1. Top bar */}
      <nav className="sticky top-0 z-40 border-b border-[var(--ev-line)] backdrop-blur-xl" style={{ background: `color-mix(in oklab, ${col.bg} 84%, transparent)` }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <ChurchMark church={{ name: church.name, profile: church.profile as ChurchProfile }} size={34} />
          <span className="min-w-0 truncate font-semibold">{church.name}</span>
          {preview && <span className="rounded-full bg-[var(--ev-accent)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ev-on-accent)]">Preview</span>}
          <div className="ml-auto hidden items-center gap-1 md:flex">
            {nav.map((x) => <a key={x.id} href={`#${x.id}`} className="rounded-full px-3 py-1.5 text-[14px] text-[var(--ev-muted)] hover:text-[var(--ev-fg)]">{x.label}</a>)}
          </div>
          {showReg && <button type="button" onClick={openReg} className="ml-auto rounded-full bg-[var(--ev-accent)] px-4 py-2 text-[14px] font-semibold text-[var(--ev-on-accent)] shadow-lg shadow-black/10 md:ml-2">{regLabel}</button>}
        </div>
      </nav>

      {live && !ended && <LiveBar e={e} live={live} people={people} />}

      {/* 2. Headline with countdown and Register */}
      <Headline e={e} church={church} registered={registered} recent={recent} H={H} closed={!showReg} regOn={regOn} label={regLabel} onRegister={openReg} />

      <main className="mx-auto max-w-6xl space-y-20 px-4 pb-28 pt-14 md:space-y-28 md:pt-20">
        {/* 3. When and where */}
        <WhenWhere e={e} H={H} />
        {/* 4. About */}
        <About e={e} H={H} registered={registered} full={full} />

        {/* Optional sections: only the ones filled in */}
        {filled("host") && <HostWelcome e={e} H={H} />}
        {filled("experience") && <Experience e={e} H={H} />}
        {filled("speakers") && <PeopleGrid e={e} people={people} H={H} />}
        {filled("programme") && <Programme e={e} people={people} H={H} now={now} />}
        {filled("online") && <JoinOnline e={e} H={H} />}
        {filled("testimonials") && <Testimonials e={e} H={H} />}
        {!!e.gallery?.length && <Gallery images={e.gallery} H={H} />}
        {(e.page?.extras ?? []).filter((x) => x.title.trim()).slice(0, MAX_EXTRAS).map((x) => <ExtraSection key={x.id} x={x} H={H} />)}
        {!!e.stay?.length && <Stay items={e.stay} H={H} />}
        {filled("faq") && <Faq items={e.faq!.filter((f) => f.q.trim())} H={H} />}
        {e.give && (e.give.url || e.give.account) && <Give give={e.give} H={H} />}
        {filled("partners") && <Partners items={e.partners!} H={H} />}
        {ended && e.feedback?.on && onFeedback && <FeedbackForm e={e} H={H} onSend={onFeedback} />}

        {/* 5. Closing invitation */}
        <Invitation e={e} H={H} closed={!showReg} regOn={regOn} label={regLabel} onRegister={openReg} />
        {filled("share") && url && <ShareBlock e={e} church={church} url={url} share={share} H={H} />}
      </main>

      {/* 6. Footer */}
      <Footer e={e} church={church} url={url} share={share} />

      {showReg && !regOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--ev-line)] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden" style={{ background: `color-mix(in oklab, ${col.bg} 88%, transparent)` }}>
          <button type="button" onClick={openReg} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ev-accent)] py-3.5 font-semibold text-[var(--ev-on-accent)] shadow-lg">
            <Ticket size={18} /> {regLabel}
          </button>
        </div>
      )}

      {regOpen && (
        <RegisterScreen e={e} church={church} url={url} H={H} onClose={closeReg}>
          {regOn ? <RegisterPanel e={e} church={church} url={url} closed={closed} full={full} onRegister={onRegister} member={preview ? undefined : member} H={H} catToken={catToken} />
            : <div className={cx(card, "p-6 text-center")}><p className={cx(H, "text-[22px] font-semibold")}>No registration needed</p><p className="mt-1 text-[14px] text-[var(--ev-muted)]">Just come. Everyone is welcome.</p></div>}
        </RegisterScreen>
      )}
    </div>
  );
}

/** The page's colours as CSS variables, for anything drawn in the event's look (the venue check-in page too). */
export function eventVars(e: ChurchEvent, churchColor: string): CSSProperties {
  const col = colorsOf(e, churchColor);
  return {
    "--ev-page": col.bg, "--ev-card": col.section, "--ev-fg": textOn(col.bg), "--ev-card-fg": textOn(col.section), "--ev-accent": col.button, "--ev-on-accent": textOn(col.button), "--ev-icon": col.icon,
    "--ev-muted": "color-mix(in oklab, currentColor 68%, transparent)", "--ev-line": "color-mix(in oklab, currentColor 12%, transparent)",
    "--ev-heading": HEADING[e.template ?? "flyer"],
  } as CSSProperties;
}
export const evCard = "rounded-3xl bg-[var(--ev-card)] text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]";

// ---------------- Headline ----------------
function Countdown({ to, big }: { to: string; big?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now === null) return <div className="h-[78px]" />;
  const ms = Date.parse(to) - now;
  if (ms <= 0) return null;
  const parts = [[Math.floor(ms / 864e5), "Days"], [Math.floor(ms / 36e5) % 24, "Hours"], [Math.floor(ms / 6e4) % 60, "Minutes"], [Math.floor(ms / 1e3) % 60, "Seconds"]] as const;
  return (
    <div className="flex gap-2 sm:gap-3" role="timer" aria-label="Time until it starts">{parts.map(([n, l]) => (
      <div key={l} className={cx("rounded-2xl bg-[var(--ev-card)] text-center text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]", big ? "min-w-[74px] px-3 py-3 sm:min-w-[88px]" : "min-w-[64px] px-3 py-2.5")}>
        <p className={cx("num font-semibold leading-none tabular-nums", big ? "text-[30px] sm:text-[38px]" : "text-[26px]")}>{String(n).padStart(2, "0")}</p>
        <p className="mt-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--ev-muted)]">{l}</p>
      </div>
    ))}</div>
  );
}

function Proof({ registered, recent }: { registered: number; recent: string[] }) {
  if (registered < 5) return null;
  const tones = ["#f59e0b", "#10b981", "#ec4899", "#38bdf8", "#a78bfa"];
  return (
    <div className="flex items-center gap-3">
      <span className="flex -space-x-2">{(recent.length ? recent : ["A", "B", "C", "D"]).slice(0, 4).map((n, i) => (
        <span key={i} className="flex size-8 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-[var(--ev-page)]" style={{ background: tones[i % tones.length] }}>{initials(n) || "•"}</span>
      ))}</span>
      <span className="text-[14px] text-[var(--ev-muted)]"><b className="text-[var(--ev-fg)]">{registered.toLocaleString()}</b> people registered</span>
    </div>
  );
}

function Chips({ e }: { e: ChurchEvent }) {
  const d = daysOf(e);
  const chip = "inline-flex items-center gap-2 rounded-full bg-[var(--ev-card)] px-3.5 py-2 text-[14px] text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]";
  return (
    <div className="flex flex-wrap gap-2">
      <span className={chip}><CalendarPlus size={15} className="text-[var(--ev-icon)]" /> {whenLine(e)}</span>
      <span className={chip}><Clock size={15} className="text-[var(--ev-icon)]" /> {d.length === 1 ? `${t12(d[0].start)} to ${t12(d[0].end)}` : d.every((x) => x.start === d[0].start) ? `${t12(d[0].start)} daily` : `Starts ${t12(d[0].start)}`}</span>
      <span className={chip}>{e.mode === "virtual" ? <><Wifi size={15} className="text-[var(--ev-icon)]" /> Online</> : <><MapPin size={15} className="text-[var(--ev-icon)]" /> {e.venues?.[0]?.name ?? e.venue ?? "Venue to be announced"}{e.mode === "hybrid" ? " · and online" : ""}</>}</span>
    </div>
  );
}

function RegButton({ closed, regOn, label, onClick, big }: { closed: boolean; regOn: boolean; label: string; onClick: () => void; big?: boolean }) {
  if (!regOn) return <span className="inline-flex rounded-2xl bg-[var(--ev-card)] px-5 py-3.5 font-semibold text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]">No registration needed. Just come!</span>;
  if (closed) return <span className="inline-flex rounded-2xl bg-[var(--ev-card)] px-5 py-3.5 font-semibold text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]">Registration has closed</span>;
  return (
    <button type="button" onClick={onClick} className={cx("inline-flex items-center gap-2 rounded-2xl bg-[var(--ev-accent)] font-semibold text-[var(--ev-on-accent)] shadow-xl shadow-black/15 transition hover:-translate-y-0.5", big ? "px-8 py-4 text-[17px]" : "px-6 py-3.5 text-[16px]")}>
      <Ticket size={18} /> {label} <ArrowRight size={17} />
    </button>
  );
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

/** A self-scrolling carousel: one picture at a time, sliding every few seconds; swipe or tap the dots. */
function Carousel({ slides, className }: { slides: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const x0 = useRef<number | null>(null);
  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 4200);
    return () => clearInterval(t);
  }, [paused, slides.length]);
  return (
    <div className={cx("relative overflow-hidden rounded-[28px] shadow-2xl shadow-black/25", className)} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(t) => { x0.current = t.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(t) => { const d = (x0.current ?? 0) - t.changedTouches[0].clientX; if (Math.abs(d) > 40) setI((n) => (n + (d > 0 ? 1 : slides.length - 1)) % slides.length); x0.current = null; setPaused(false); }}>
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, k) => <img key={k} src={s} alt="" className="aspect-[4/5] w-full shrink-0 object-cover" loading={k ? "lazy" : "eager"} />)}
      </div>
      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">{slides.map((_, k) => (
          <button key={k} type="button" onClick={() => setI(k)} aria-label={`Picture ${k + 1}`} className={cx("h-1.5 rounded-full bg-white transition-all", k === i ? "w-6" : "w-1.5 opacity-60")} />
        ))}</div>
      )}
    </div>
  );
}

type HeadProps = { e: ChurchEvent; church: ChurchInfo; registered: number; recent: string[]; H: string; closed: boolean; regOn: boolean; label: string; onRegister: () => void };

/** The headline: a flyer, a short video or a carousel, with the title, the countdown and Register. */
function Headline({ e, church, registered, recent, H, closed, regOn, label, onRegister }: HeadProps) {
  const m = headline(e);
  const text = (
    <div className="min-w-0">
      {themeOf(e) && <p className="text-[13.5px] font-semibold uppercase tracking-[.2em] text-[var(--ev-icon)]">{themeOf(e)}</p>}
      <h1 className={cx(H, "mt-3 break-words text-[clamp(38px,9vw,76px)] font-bold leading-[1]")}>{e.title}</h1>
      {e.verse?.text && <p className="mt-4 max-w-xl text-[16px] italic text-[var(--ev-muted)]">“{e.verse.text}” <span className="not-italic font-medium">{e.verse.ref}</span></p>}
      <div className="mt-6"><Chips e={e} /></div>
      <div className="mt-7"><Countdown to={e.start} big /></div>
      <div className="mt-7 flex flex-wrap items-center gap-5"><RegButton closed={closed} regOn={regOn} label={label} onClick={onRegister} big /><Proof registered={registered} recent={recent} /></div>
    </div>
  );
  if (m.kind === "video") {
    return (
      <header className="relative overflow-hidden">
        <video src={m.src} poster={m.poster} autoPlay muted loop playsInline aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--ev-page) 4%, color-mix(in oklab, var(--ev-page) 72%, transparent) 45%, color-mix(in oklab, var(--ev-page) 35%, transparent))" }} />
        <div className="relative mx-auto flex min-h-[86svh] max-w-6xl items-end px-4 pb-14 pt-24 md:pb-20">{text}</div>
      </header>
    );
  }
  return (
    <header className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(800px 520px at 85% -10%, color-mix(in oklab, var(--ev-accent) 28%, transparent), transparent 70%), radial-gradient(600px 400px at 0% 100%, color-mix(in oklab, var(--ev-icon) 16%, transparent), transparent 70%)" }} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] md:py-20">
        <div className="order-2 md:order-1">{text}</div>
        <div className="order-1 mx-auto w-full max-w-[440px] md:order-2">
          {m.kind === "carousel" ? <Carousel slides={m.slides} /> : <Poster e={e} church={church} className="md:rotate-1" />}
        </div>
      </div>
    </header>
  );
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
      {kicker && <p className="text-[12.5px] font-semibold uppercase tracking-[.2em] text-[var(--ev-icon)]">{kicker}</p>}
      <h2 className={cx(H, "mt-1.5 text-[30px] font-semibold leading-tight md:text-[36px]")}>{title}</h2>
    </div>
  );
}

const card = "rounded-3xl bg-[var(--ev-card)] text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]";

function About({ e, H, registered, full }: { e: ChurchEvent; H: string; registered: number; full: boolean }) {
  const tiles = [
    { icon: Users, k: "Who", v: "Everyone is welcome", s: registered >= 5 ? `${registered.toLocaleString()} registered so far` : undefined },
    { icon: Ticket, k: "Cost", v: "Free", s: e.capacity ? (full ? "Fully booked: join the waiting list" : `${Math.max(0, e.capacity - registered)} places left`) : undefined },
  ];
  return (
    <section className="grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,.7fr)] md:items-start">
      <div>
        <SectionTitle id="about" kicker="About" title={themeOf(e) || e.title} H={H} />
        {e.description && <p className="whitespace-pre-line text-[17px] leading-relaxed text-[var(--ev-muted)]">{e.description}</p>}
        {e.verse?.text && (
          <figure className={cx(card, "mt-6 flex gap-4 p-6")}>
            <Quote size={26} className="shrink-0 text-[var(--ev-icon)]" />
            <blockquote><p className={cx(H, "text-[20px] font-medium leading-snug")}>{e.verse.text}</p><figcaption className="mt-2 text-[13px] font-semibold uppercase tracking-[.15em] text-[var(--ev-muted)]">{e.verse.ref}</figcaption></blockquote>
          </figure>
        )}
      </div>
      <div className="grid gap-3 md:pt-16">
        {tiles.map((t) => (
          <div key={t.k} className={cx(card, "flex gap-4 p-5")}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: "color-mix(in oklab, var(--ev-icon) 18%, transparent)", color: "var(--ev-icon)" }}><t.icon size={19} /></span>
            <span className="min-w-0"><span className="block text-[12px] font-semibold uppercase tracking-wider text-[var(--ev-muted)]">{t.k}</span><span className="block text-[16px] font-semibold">{t.v}</span>{t.s && <span className="block text-[13.5px] text-[var(--ev-muted)]">{t.s}</span>}</span>
          </div>
        ))}
      </div>
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

/** Speakers: sliding cards; tap one for the bio. */
function PeopleGrid({ e, people, H }: { e: ChurchEvent; people: EventPerson[]; H: string }) {
  const [open, setOpen] = useState<EventPerson | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const order = ["Speaker", "Minister", "Music minister", "Host", "Special guest"];
  const sorted = [...people].sort((a, b) => (order.indexOf(a.label) + 1 || 9) - (order.indexOf(b.label) + 1 || 9));
  const slide = (d: number) => row.current?.scrollBy({ left: d * Math.min(320, row.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <SectionTitle id="people" kicker="On the programme" title={people.every((p) => p.label === "Speaker") ? "Speakers" : "Ministering"} H={H} />
        {sorted.length > 2 && <div className="mb-6 hidden gap-2 md:flex">
          <button type="button" onClick={() => slide(-1)} aria-label="Previous" className="flex size-10 items-center justify-center rounded-full ring-1 ring-[var(--ev-line)] hover:bg-[var(--ev-card)]"><ArrowLeft size={17} /></button>
          <button type="button" onClick={() => slide(1)} aria-label="Next" className="flex size-10 items-center justify-center rounded-full ring-1 ring-[var(--ev-line)] hover:bg-[var(--ev-card)]"><ArrowRight size={17} /></button>
        </div>}
      </div>
      <div ref={row} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {sorted.map((p) => (
          <button type="button" key={p.id} onClick={() => setOpen(p)} className={cx(card, "group w-[72%] max-w-[290px] shrink-0 snap-start overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-xl sm:w-[260px]")}>
            <div className="relative aspect-[4/5] overflow-hidden">
              {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                : <div className="flex h-full items-center justify-center" style={{ background: COVERS[(p.name.length + (e.cover ?? 0)) % COVERS.length] }}><span className="font-display text-[56px] font-bold text-white/90">{initials(p.name)}</span></div>}
              <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur">{p.label}</span>
            </div>
            <div className="p-4"><p className="font-semibold leading-tight">{p.name}</p>{(p.from || p.bio) && <p className="mt-1 line-clamp-2 text-[13px] text-[var(--ev-muted)]">{p.from ?? p.bio}</p>}{p.bio && <p className="mt-2 text-[12.5px] font-semibold text-[var(--ev-icon)]">Read bio</p>}</div>
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm md:items-center" onClick={() => setOpen(null)} role="dialog" aria-modal aria-label={open.name}>
          <div className={cx(card, "pop relative max-h-[85vh] w-full max-w-md overflow-y-auto p-6")} onClick={(x) => x.stopPropagation()}>
            <button type="button" onClick={() => setOpen(null)} className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--ev-muted)] hover:bg-black/5" aria-label="Close"><X size={18} /></button>
            <div className="flex items-center gap-4"><Face p={open} size={72} /><div><p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ev-icon)]">{open.label}</p><p className={cx(H, "text-[22px] font-semibold leading-tight")}>{open.name}</p>{open.from && <p className="text-[13.5px] text-[var(--ev-muted)]">{open.from}</p>}</div></div>
            {open.bio && <p className="mt-5 whitespace-pre-line text-[15.5px] leading-relaxed text-[var(--ev-muted)]">{open.bio}</p>}
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
          <button type="button" key={x.date} onClick={() => setD(i)} className={cx("shrink-0 rounded-2xl px-4 py-2.5 text-left ring-1 transition", i === d ? "bg-[var(--ev-accent)] text-[var(--ev-on-accent)] ring-transparent" : "bg-[var(--ev-card)] ring-[var(--ev-line)]")}>
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

/** When and where: each day, then the venues (or the online card). */
function WhenWhere({ e, H }: { e: ChurchEvent; H: string }) {
  const days = daysOf(e);
  const venues = e.mode === "virtual" ? [] : e.venues?.length ? e.venues : e.venue ? [{ id: "v", name: e.venue }] : [];
  return (
    <section>
      <SectionTitle id="when" kicker="When and where" title={days.length > 1 ? `${days.length} days` : fmtDay(days[0].date, { weekday: "long", day: "numeric", month: "long" })} H={H} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className={cx(card, "p-5")}>
          <p className="flex items-center gap-2 font-semibold"><CalendarPlus size={17} className="text-[var(--ev-icon)]" /> {days.length > 1 ? "The days" : "The day"}</p>
          <ul className="mt-3 divide-y divide-[var(--ev-line)]">{days.map((d, i) => (
            <li key={d.date} className="flex items-baseline justify-between gap-3 py-2.5 text-[15px]">
              <span><b className="font-semibold">{days.length > 1 ? `Day ${i + 1}: ` : ""}{fmtDay(d.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</b>{d.title && <span className="block text-[13px] text-[var(--ev-muted)]">{d.title}</span>}</span>
              <span className="shrink-0 text-[14px] text-[var(--ev-muted)]">{t12(d.start)} to {t12(d.end)}</span>
            </li>
          ))}</ul>
        </div>
        {venues.map((v) => {
          const maps = ("mapUrl" in v && v.mapUrl) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(("address" in v && v.address) || v.name)}`;
          return (
            <div key={v.id} className={cx(card, "flex flex-col p-5")}>
              <p className="flex items-center gap-2 font-semibold"><MapPin size={17} className="text-[var(--ev-icon)]" /> {v.name}{"overflow" in v && v.overflow && <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ev-muted)] ring-1 ring-[var(--ev-line)]">Overflow</span>}</p>
              {"address" in v && v.address && <p className="mt-1 text-[14px] text-[var(--ev-muted)]">{v.address}</p>}
              {"directions" in v && v.directions && <p className="mt-2 text-[14px] leading-relaxed">{v.directions}</p>}
              {"note" in v && v.note && <p className="mt-2 text-[13px] text-[var(--ev-muted)]">{v.note}</p>}
              <a href={maps} target="_blank" rel="noreferrer" className="mt-auto inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--ev-accent)] px-3.5 py-2 text-[14px] font-semibold text-[var(--ev-on-accent)] [margin-top:1rem]"><Navigation size={15} /> Get directions</a>
            </div>
          );
        })}
        {e.mode !== "physical" && (
          <div className={cx(card, "p-5")}>
            <p className="flex items-center gap-2 font-semibold"><Wifi size={17} className="text-[var(--ev-icon)]" /> Online</p>
            <p className="mt-1 text-[14px] text-[var(--ev-muted)]">{e.mode === "virtual" ? "Join from anywhere." : "Can't come in person? Join online."} Register and we&apos;ll send you the link and reminders.</p>
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
        {give.url && <a href={give.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[var(--ev-accent)] px-4 py-2.5 text-[14px] font-semibold text-[var(--ev-on-accent)]">Give online <ArrowRight size={15} /></a>}
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

/** Host welcome: a letter from the host, with photos or a short video. */
function HostWelcome({ e, H }: { e: ChurchEvent; H: string }) {
  const h = e.page!.host!;
  const photos = (h.photos ?? []).slice(0, 4);
  return (
    <section className="grid items-center gap-8 md:grid-cols-2">
      <div className={cx("order-2 md:order-1", !h.video && !photos.length && "md:col-span-2")}>
        <SectionTitle id="welcome" kicker="A word of welcome" title={h.name ? `From ${h.name}` : "Welcome"} H={H} />
        <div className="whitespace-pre-line text-[17px] leading-relaxed text-[var(--ev-muted)]">{h.letter}</div>
        {h.name && <p className="mt-5 font-semibold">{h.name}{h.role && <span className="block text-[14px] font-normal text-[var(--ev-muted)]">{h.role}</span>}</p>}
      </div>
      {(h.video || photos.length > 0) && (
        <div className="order-1 md:order-2">
          {h.video ? <video src={h.video} controls playsInline poster={photos[0]} className="aspect-[4/5] w-full rounded-[28px] bg-black object-cover shadow-2xl" />
            : photos.length === 1 ? <img src={photos[0]} alt="" className="aspect-[4/5] w-full rounded-[28px] object-cover shadow-2xl" />
            : <div className="grid grid-cols-2 gap-3">{photos.map((p, i) => <img key={i} src={p} alt="" className={cx("w-full rounded-2xl object-cover shadow-lg", i % 3 === 0 ? "aspect-[3/4]" : "aspect-square", i === 1 && "mt-8")} />)}</div>}
        </div>
      )}
    </section>
  );
}

/** The experience: three cards. */
function Experience({ e, H }: { e: ChurchEvent; H: string }) {
  const items = (e.page?.experience ?? []).filter((x) => x.title.trim()).slice(0, 3);
  const icons = [Sparkles, Heart, Users];
  return (
    <section>
      <SectionTitle id="experience" kicker="What to expect" title="The experience" H={H} />
      <div className="grid gap-3 md:grid-cols-3">{items.map((x, i) => { const I = icons[i % 3]; return (
        <div key={i} className={cx(card, "p-6")}>
          <span className="flex size-12 items-center justify-center rounded-2xl" style={{ background: "color-mix(in oklab, var(--ev-icon) 18%, transparent)", color: "var(--ev-icon)" }}><I size={22} /></span>
          <p className={cx(H, "mt-5 text-[21px] font-semibold leading-tight")}>{x.title}</p>
          {x.body && <p className="mt-2 text-[15px] leading-relaxed text-[var(--ev-muted)]">{x.body}</p>}
        </div>
      ); })}</div>
    </section>
  );
}

/** Join online: the QR code, the link and the steps. */
function JoinOnline({ e, H }: { e: ChurchEvent; H: string }) {
  const steps = (e.page?.online?.steps ?? []).filter((x) => x.trim());
  const shown = steps.length ? steps : ["Register so we can send you reminders.", "Open the link a few minutes before it starts.", "Join in: worship, pray and listen with everyone."];
  return (
    <section>
      <SectionTitle id="online" kicker="From anywhere" title="Join online" H={H} />
      <div className={cx(card, "grid gap-6 p-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:p-8")}>
        <div className="mx-auto w-fit rounded-2xl bg-white p-3"><QR value={e.link!} size={150} /></div>
        <div>
          <ol className="space-y-3">{shown.map((x, i) => (
            <li key={i} className="flex gap-3 text-[15.5px]"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--ev-accent)] text-[13px] font-bold text-[var(--ev-on-accent)]">{i + 1}</span><span className="pt-0.5">{x}</span></li>
          ))}</ol>
          <a href={e.link} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--ev-accent)] px-4 py-2.5 text-[14.5px] font-semibold text-[var(--ev-on-accent)]"><Radio size={16} /> Open the online link</a>
          <p className="mt-2 break-all text-[12.5px] text-[var(--ev-muted)]">{e.link}</p>
        </div>
      </div>
    </section>
  );
}

/** Testimonials: real words, with names. */
function Testimonials({ e, H }: { e: ChurchEvent; H: string }) {
  const items = (e.page?.testimonials ?? []).filter((t) => t.quote.trim() && t.name.trim());
  return (
    <section>
      <SectionTitle id="testimonials" kicker="In their words" title="What people said" H={H} />
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {items.map((t, i) => (
          <figure key={i} className={cx(card, "w-[82%] shrink-0 snap-start p-6 md:w-auto")}>
            <Quote size={22} className="text-[var(--ev-icon)]" />
            <blockquote className="mt-3 text-[16px] leading-relaxed">{t.quote}</blockquote>
            <figcaption className="mt-4 text-[14px] font-semibold">{t.name}{t.role && <span className="block font-normal text-[var(--ev-muted)]">{t.role}</span>}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** One of the organiser's own sections. */
function ExtraSection({ x, H }: { x: NonNullable<NonNullable<ChurchEvent["page"]>["extras"]>[number]; H: string }) {
  return (
    <section className={cx("grid items-center gap-8", x.image && "md:grid-cols-2")}>
      <div>
        <SectionTitle id={`x-${x.id}`} title={x.title} H={H} />
        {x.body && <p className="whitespace-pre-line text-[16.5px] leading-relaxed text-[var(--ev-muted)]">{x.body}</p>}
        {x.button?.url && <a href={x.button.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--ev-accent)] px-4 py-2.5 text-[14.5px] font-semibold text-[var(--ev-on-accent)]">{x.button.label || "Find out more"} <ArrowRight size={15} /></a>}
      </div>
      {x.image && <img src={x.image} alt="" className="w-full rounded-[28px] object-cover shadow-xl" loading="lazy" />}
    </section>
  );
}

/** The closing invitation. */
function Invitation({ e, H, closed, regOn, label, onRegister }: { e: ChurchEvent; H: string; closed: boolean; regOn: boolean; label: string; onRegister: () => void }) {
  const inv = e.page?.invite;
  return (
    <section className="relative overflow-hidden rounded-[32px] px-6 py-14 text-center md:py-20" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--ev-accent) 32%, var(--ev-card)), var(--ev-card))", color: "var(--ev-card-fg)" }}>
      <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full blur-3xl" style={{ background: "color-mix(in oklab, var(--ev-icon) 30%, transparent)" }} />
      <div className="relative mx-auto max-w-2xl">
        <p className="text-[13px] font-semibold uppercase tracking-[.22em] text-[var(--ev-icon)]">{whenLine(e)}</p>
        <h2 className={cx(H, "mt-3 text-[clamp(30px,6vw,52px)] font-bold leading-[1.05]")}>{inv?.title?.trim() || `Don't miss ${e.title}`}</h2>
        <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-[var(--ev-muted)]">{inv?.body?.trim() || "Come expectant. Bring someone with you. We can't wait to see you there."}</p>
        <div className="mt-8 flex justify-center"><RegButton closed={closed} regOn={regOn} label={label} onClick={onRegister} big /></div>
        <div className="mt-8 flex justify-center"><Countdown to={e.start} /></div>
      </div>
    </section>
  );
}

/** "Know someone who should be here?" */
function ShareBlock({ e, church, url, share, H }: { e: ChurchEvent; church: ChurchInfo; url: string; share: string; H: string }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <section className={cx(card, "flex flex-col items-center gap-6 p-6 text-center md:flex-row md:p-8 md:text-left")}>
      <div className="rounded-2xl bg-white p-2"><QR value={url} size={104} /></div>
      <div className="flex-1">
        <p className={cx(H, "text-[24px] font-semibold leading-tight")}>Know someone who should be here?</p>
        <p className="mt-1 text-[15px] text-[var(--ev-muted)]">Send them the link. It takes a second.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-4 py-2.5 text-[14.5px] font-semibold text-white"><WhatsAppIcon size={17} /> WhatsApp</a>
        <button type="button" onClick={() => { void copyText(url, "Copy the event link").then((ok) => { if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); } }); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14.5px] font-semibold ring-1 ring-[var(--ev-line)]">{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy link</>}</button>
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await savePicture(await shareImage(e, { name: church.name, color: church.profile?.color, logo: church.profile?.logo }, url), `${e.slug}-share.png`, { title: e.title, text: share }); } catch { alert("Couldn't make the picture. Try again."); } setBusy(false); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14.5px] font-semibold ring-1 ring-[var(--ev-line)]"><ImageIcon size={16} /> {busy ? "Making…" : "Picture"}</button>
      </div>
    </section>
  );
}

function Footer({ e, church, url, share }: { e: ChurchEvent; church: ChurchInfo; url: string; share: string }) {
  const c = e.contact;
  const wa = c?.whatsapp ? digits(c.whatsapp).replace(/^0/, "234") : undefined;
  const pill = "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold ring-1 ring-[var(--ev-line)]";
  return (
    <footer className="border-t border-[var(--ev-line)] px-4 pb-28 pt-10 lg:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <ChurchMark church={{ name: church.name, profile: church.profile as ChurchProfile }} size={40} />
          <div><p className="font-semibold">{church.name}</p><p className="text-[13px] text-[var(--ev-muted)]">{c?.name ? `${c.name} will help with anything you need.` : "Questions? We're happy to help."}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c?.phone && <a href={`tel:${c.phone}`} className={pill}><Phone size={15} /> Call</a>}
          {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello, I have a question about ${e.title}.`)}`} target="_blank" rel="noreferrer" className={pill}><WhatsAppIcon size={15} /> WhatsApp</a>}
          {c?.email && <a href={`mailto:${c.email}`} className={pill}><Mail size={15} /> Email</a>}
          {url && <button type="button" onClick={() => icsFile(e, church.name, url)} className={pill}><CalendarPlus size={15} /> Add to calendar</button>}
          {!e.page || e.page.share === false ? <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" className={pill}><Share2 size={15} /> Invite a friend</a> : null}
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-6xl text-[12.5px] text-[var(--ev-muted)]">Powered by <b className="font-semibold">Traqi</b></p>
    </footer>
  );
}

/** The full-screen registration page (phones and desktop): the event picture, its name and date, then the form. */
function RegisterScreen({ e, church, H, onClose, children }: { e: ChurchEvent; church: ChurchInfo; url: string; H: string; onClose: () => void; children: ReactNode }) {
  const m = headline(e);
  const pic = m.kind === "carousel" ? m.slides[0] : m.kind === "video" ? m.poster : m.src;
  useEffect(() => { const k = (x: KeyboardEvent) => { if (x.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-[var(--ev-page)] text-[var(--ev-fg)]" role="dialog" aria-modal aria-label={`Register for ${e.title}`}>
      <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-[var(--ev-line)] px-4 backdrop-blur-xl" style={{ background: "color-mix(in oklab, var(--ev-page) 88%, transparent)" }}>
        <button type="button" onClick={onClose} className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] font-semibold hover:bg-[var(--ev-card)]"><ArrowLeft size={17} /> Back</button>
        <span className="min-w-0 flex-1 truncate text-center text-[14px] text-[var(--ev-muted)]">{church.name}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-[var(--ev-card)]"><X size={18} /></button>
      </div>
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] md:py-12">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="flex items-center gap-4 md:block">
            {pic ? <img src={pic} alt="" className="w-24 shrink-0 rounded-2xl object-cover shadow-xl md:w-full md:rounded-[28px]" style={{ aspectRatio: "4 / 5" }} />
              : <div className="aspect-[4/5] w-24 shrink-0 rounded-2xl shadow-xl md:w-full md:rounded-[28px]" style={{ background: COVERS[e.cover % COVERS.length] }} />}
            <div className="min-w-0 md:mt-6">
              <p className="text-[12.5px] font-semibold uppercase tracking-[.18em] text-[var(--ev-icon)]">{whenLine(e)}</p>
              <p className={cx(H, "mt-1 text-[22px] font-bold leading-tight md:text-[30px]")}>{e.title}</p>
              <p className="mt-1 text-[14px] text-[var(--ev-muted)]">{e.mode === "virtual" ? "Online" : e.venues?.[0]?.name ?? e.venue ?? ""}</p>
            </div>
          </div>
        </div>
        <div>
          <h1 className={cx(H, "mb-5 text-[28px] font-bold leading-tight md:text-[36px]")}>Register for {e.title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------- Registration: a step at a time ----------------
const field = "w-full rounded-xl bg-[var(--ev-page)] px-3.5 py-3 text-[15.5px] text-[var(--ev-fg)] ring-1 ring-[var(--ev-line)] outline-none placeholder:text-[var(--ev-muted)]/70 focus:ring-2 focus:ring-[var(--ev-accent)]";

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

type Step = "who" | "google" | "checking" | "you" | "done";

/**
 * Registration (round 8): "A member of {Church}?" → Google → the form, filled in; or "Not a member?" → the form.
 * The form holds the ticket type (if the event has categories), "How will you be attending?" (when both are offered),
 * the event's questions and the accommodation link.
 */
export function RegisterPanel({ e, church, url, closed, full, onRegister, member, H, catToken, checkedIn, venueCode }: { e: ChurchEvent; church: ChurchInfo; url: string; closed: boolean; full: boolean; onRegister: (r: RegInput) => Promise<RegResult>; member?: MemberFlow; H: string; catToken?: string | null;
  /** At the venue: registering also checks them in. */ checkedIn?: boolean;
  /** The venue's check-in code: lets people register on the day after online registration closes. */ venueCode?: string }) {
  const offered = (() => { const t = regTypesOf(e).filter((x) => x !== "group"); return t.length ? t : (["individual"] as RegType[]); })();
  const both = offered.includes("individual") && offered.includes("online");
  const cats = categoriesFor(e, catToken);
  const days = daysOf(e);
  const start: Step = member && !member.known ? "who" : "you";
  const [step, setStep] = useState<Step>(start);
  const [asMember, setAsMember] = useState(!!member?.known);
  const [inChurch, setInChurch] = useState(!!member?.known);
  const [type, setType] = useState<RegType | "">(both ? "" : offered[0]);
  const [cat, setCat] = useState<string>(() => (cats.length === 1 ? cats[0].id : cats.find((c) => c.private)?.id ?? ""));
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
  const chosen = cats.find((c) => c.id === cat);
  const genderQ = asMember ? e.questions.find(isGenderQuestion) : undefined;
  const questions = [...(genderQ ? e.questions.filter((q) => q.id !== genderQ.id) : e.questions), ...(chosen?.questions ?? [])];

  // Who signed in with Google: the form, filled in (already registered: their tickets)
  const resolve = async () => {
    if (!member) return;
    setAsMember(true); go("checking");
    try {
      const s = await member.status();
      if (!s.signedIn) return go("google");
      if (s.member && s.tickets.length) { setMine(s.tickets); setLast("already"); setInChurch(true); return go("done"); }
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
    if (!member || typeof window === "undefined") return;
    if (member.known) { void resolve(); return; }
    const q = new URLSearchParams(location.search);
    if (!q.get(MEMBER_PARAM)) return;
    // From Home ("Register now") or back from Google
    void resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const asAMember = () => { setAsMember(true); setInChurch(false); const fromHome = typeof window !== "undefined" && !!new URLSearchParams(location.search).get(REGISTER_PARAM); if (fromHome) void resolve(); else go("google"); };

  const check = (a: Attendee) => {
    if (cats.length && !cat) return "Choose a ticket type.";
    if (!type) return "Choose how you'll be attending: physical or online.";
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
    const input: RegInput = { ...me, answers, firstName, lastName, name, altPhone: me.altPhone?.trim() || undefined, email: (lockedEmail || me.email!).trim(), type: type as RegType, days: pickDays, guests: 0, others: [],
      category: cat || undefined, categoryToken: chosen?.private ? catToken ?? undefined : undefined, venueCode: venueCode || undefined };
    try {
      const r = asMember && member ? await member.register({ ...input, gender: gender as "M" | "F", birthday }) : await onRegister(input);
      const got = r.tickets?.length ? r.tickets : [{ name, ticket: r.ticket, status: r.status, category: cat || undefined }];
      setMine((x) => [...x.filter((t) => !got.some((g) => g.ticket === t.ticket)), ...got.map((t) => ({ ...t, name: t.name || name, category: t.category ?? (cat || undefined) }))]);
      if (asMember) setInChurch(true);
      setLast(r.status); go("done");
    } catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong. Please try again."); }
    setBusy(false);
  };
  const another = () => { setMe(blank()); setAsMember(false); setGender(""); setBirthday(""); setLockedEmail(""); setPickDays(days.map((d) => d.date)); setType(both ? "" : offered[0]); go(member && !member.known ? "who" : "you"); };

  if (closed && !mine.length) return <div className={cx(card, "p-6 text-center")}><p className={cx(H, "text-[22px] font-semibold")}>Registration has closed</p><p className="mt-1 text-[14px] text-[var(--ev-muted)]">Thank you for your interest. See you next time!</p></div>;
  if (step === "done" && last) return (
    <Tickets e={e} church={church} url={url} tickets={mine} status={last} H={H} onAnother={closed ? undefined : another} checkedIn={checkedIn && (last === "confirmed" || last === "already")}
      onHome={asMember && member && !member.known ? () => member.dashboard() : undefined} />
  );

  const choice = (key: string, icon: ReactNode, title: string, body: string, onClick: () => void) => (
    <button key={key} type="button" onClick={onClick} className={cx(card, "flex w-full items-center gap-4 p-5 text-left transition hover:ring-2 hover:ring-[var(--ev-accent)]")}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--ev-accent)", color: "var(--ev-on-accent)" }}>{icon}</span>
      <span className="flex-1"><b className="block text-[17px]">{title}</b><span className="text-[14px] text-[var(--ev-muted)]">{body}</span></span>
      <ArrowRight size={18} className="text-[var(--ev-muted)]" />
    </button>
  );
  const pill = (on: boolean) => cx("flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[14.5px] ring-1", on ? "font-semibold ring-2 ring-[var(--ev-accent)]" : "ring-[var(--ev-line)]");
  const pillBg = (on: boolean) => (on ? { background: "color-mix(in oklab, var(--ev-accent) 12%, transparent)" } : undefined);

  return (
    <div ref={topRef} className="scroll-mt-24 space-y-4">
      {full && <p className="rounded-xl px-3 py-2 text-[13.5px]" style={{ background: "color-mix(in oklab, #f59e0b 18%, transparent)" }}>It&apos;s full. Register to join the waiting list.</p>}
      {mine.length > 0 && <p className="rounded-xl px-3 py-2 text-[13.5px]" style={{ background: "color-mix(in oklab, var(--ev-accent) 12%, transparent)" }}>{mine.length} {mine.length === 1 ? "ticket" : "tickets"} so far. Each person gets their own.</p>}

      {step === "who" && (
        <div className="space-y-3">
          {choice("member", <BadgeCheck size={22} />, `A member of ${churchShort}?`, "Continue with Google. Your details fill in for you.", asAMember)}
          {choice("guest", <UserRound size={22} />, `Not a member of ${churchShort}?`, "Fill in the form. It takes a minute.", () => { setAsMember(false); go("you"); })}
        </div>
      )}

      {step === "google" && member && (
        <div className={cx(card, "space-y-3 p-5")}>
          <p className="text-[15px]">Continue with your Google account. This also creates your {churchShort} account if you don&apos;t have one yet.</p>
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

      {step === "checking" && (
        <p className="flex items-center gap-2 py-6 text-[15px]"><span className="size-4 animate-spin rounded-full border-2 border-[var(--ev-accent)] border-t-transparent" /> Checking your account…</p>
      )}

      {step === "you" && (
        <div className={cx(card, "space-y-5 p-5 md:p-6")}>
          {asMember && <p className="rounded-xl px-3 py-2 text-[13.5px]" style={{ background: "color-mix(in oklab, var(--ev-accent) 12%, transparent)" }}>Registering as a member of {churchShort}. Check your details below.</p>}
          {cats.length > 1 && (
            <div role="radiogroup" aria-label="Ticket type">
              <span className="mb-1.5 block text-[14px] font-medium">Ticket type</span>
              <div className="grid gap-1.5 sm:grid-cols-2">{cats.map((c) => (
                <button type="button" role="radio" aria-checked={cat === c.id} key={c.id} onClick={() => { setCat(c.id); setErr(""); }} className={pill(cat === c.id)} style={pillBg(cat === c.id)}>
                  <span className="size-3.5 shrink-0 rounded-full ring-2 ring-white/50" style={{ background: categoryColor(c, e) }} />{c.name}
                </button>
              ))}</div>
            </div>
          )}
          {cats.length === 1 && <p className="flex items-center gap-2 text-[14px]"><span className="size-3 rounded-full" style={{ background: categoryColor(cats[0], e) }} /> Ticket: <b>{cats[0].name}</b></p>}
          {both && (
            <div role="radiogroup" aria-label="How will you be attending?">
              <span className="mb-1.5 block text-[14px] font-medium">How will you be attending?</span>
              <div className="grid grid-cols-2 gap-1.5">{(["individual", "online"] as const).map((t) => (
                <button type="button" role="radio" aria-checked={type === t} key={t} onClick={() => { setType(t); setErr(""); }} className={pill(type === t)} style={pillBg(type === t)}>
                  {t === "individual" ? <><MapPin size={16} /> Physical</> : <><Wifi size={16} /> Online</>}
                </button>
              ))}</div>
            </div>
          )}
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
                    <button key={g} type="button" onClick={() => { setGender(g); setErr(""); }} className={pill(gender === g)} style={pillBg(gender === g)}>{g === "F" ? "Female" : "Male"}</button>
                  ))}</div>
                </div>
              </>
            ) : undefined} />
          {days.length > 1 && (
            <div>
              <span className="mb-1.5 block text-[14px] font-medium">Which days will you come?</span>
              <div className="grid gap-1.5">{days.map((d, i) => { const on = pickDays.includes(d.date); return (
                <button type="button" key={d.date} onClick={() => setPickDays(on ? pickDays.filter((x) => x !== d.date) : [...pickDays, d.date].sort())} className={pill(on)} style={pillBg(on)}>
                  <span className={cx("flex size-5 items-center justify-center rounded-md", on ? "bg-[var(--ev-accent)] text-[var(--ev-on-accent)]" : "ring-1 ring-[var(--ev-line)]")}>{on && <Check size={12} />}</span>
                  <span className="flex-1">Day {i + 1}: {fmtDay(d.date, { weekday: "short", day: "numeric", month: "short" })}</span><span className="text-[12.5px] text-[var(--ev-muted)]">{t12(d.start)}</span>
                </button>
              ); })}</div>
            </div>
          )}
          {e.accommodationUrl && (
            <a href={e.accommodationUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl px-3.5 py-3 text-[14.5px] ring-1 ring-[var(--ev-line)]"><BedDouble size={17} className="text-[var(--ev-icon)]" /> Need accommodation? <b className="text-[var(--ev-icon)]">Click here</b></a>
          )}
        </div>
      )}

      {err && <p className="rounded-xl px-3 py-2 text-[14px] text-[#be123c]" style={{ background: "#ffe4e6" }} role="alert">{err}</p>}

      {(step === "google" || step === "you") && (
        <div className="flex gap-2">
          {(start === "who" || mine.length > 0) && (
            <button type="button" onClick={() => (mine.length && step === start ? go("done") : go("who"))} className="flex items-center gap-1.5 rounded-2xl px-4 py-3.5 text-[15px] font-semibold ring-1 ring-[var(--ev-line)]"><ArrowLeft size={16} /> Back</button>
          )}
          {step === "you" && (
            <button type="button" disabled={busy} onClick={() => void submit()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--ev-accent)] py-3.5 text-[16px] font-semibold text-[var(--ev-on-accent)] shadow-lg disabled:opacity-60">
              {busy ? "Registering…" : asMember && !inChurch ? `Submit and join ${churchShort}` : e.needsApproval ? "Request a place" : "Submit"}
            </button>
          )}
        </div>
      )}
      <p className="text-center text-[12px] text-[var(--ev-muted)]">{church.name} will use these details for this event{e.followup || asMember ? " and to stay in touch" : ""}.</p>
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
export function Tickets({ e, church, url, tickets, status, H, onAnother, onHome, checkedIn }: { e: ChurchEvent; church: ChurchInfo; url: string; tickets: RegTicket[]; status: RegResult["status"]; H: string; onAnother?: () => void;
  /** Members: "Open my Traqi". */ onHome?: () => void; checkedIn?: boolean }) {
  return (
    <div className="space-y-3">
      <Confetti show={status === "confirmed"} />
      <div className={cx(card, "p-5 text-center")}>
        <p className={cx(H, "text-[24px] font-semibold")}>{checkedIn ? "Registered and checked in!" : status === "confirmed" ? "You're in!" : status === "already" ? "Already registered" : status === "waitlist" ? "You're on the waiting list" : "Thank you! We'll confirm soon"}</p>
        <p className="mt-1 text-[14px] text-[var(--ev-muted)]">{checkedIn ? "Welcome! Keep your ticket handy." : status === "waitlist" ? "We'll let you know if a place opens up." : tickets.length > 1 ? `${tickets.length} tickets below. Send each person theirs.` : "Show this ticket at the door."}</p>
      </div>
      {e.accommodationUrl && (
        <a href={e.accommodationUrl} target="_blank" rel="noreferrer" className={cx(card, "flex items-center gap-3 p-4")}>
          <BedDouble size={22} className="shrink-0 text-[var(--ev-icon)]" />
          <span className="flex-1 text-[14.5px]"><b className="block">Do you need accommodation?</b><span className="text-[var(--ev-muted)]">Click the link below.</span></span>
          <span className="shrink-0 rounded-xl bg-[var(--ev-accent)] px-3.5 py-2 text-[13.5px] font-semibold text-[var(--ev-on-accent)]">Accommodation</span>
        </a>
      )}
      {tickets.map((t) => <TicketCard key={t.ticket} e={e} church={church} url={url} t={t} />)}
      <div className="flex flex-wrap gap-2">
        {onHome && <button type="button" onClick={onHome} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ev-accent)] px-4 text-[15px] font-semibold text-[var(--ev-on-accent)] shadow-lg">Open my Traqi <ArrowRight size={16} /></button>}
        {onAnother && <button type="button" onClick={onAnother} className={cx("flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-[14.5px] font-semibold", onHome ? "bg-[var(--ev-card)] text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]" : "bg-[var(--ev-accent)] text-[var(--ev-on-accent)] shadow-lg")}><Plus size={16} /> Register someone else</button>}
        <button type="button" onClick={() => icsFile(e, church.name, url)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--ev-card)] px-4 text-[14px] font-semibold text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]"><CalendarPlus size={15} /> Add to calendar</button>
      </div>
    </div>
  );
}

const ticketLabel = (st: RegTicket["status"]) => (st === "confirmed" ? "Confirmed" : st === "waitlist" ? "Waiting list" : st === "pending" ? "Waiting for approval" : "Registered");

/** One ticket: name, QR code for the door, and Image / PDF / Send. Used on the event page and on Home. */
export function TicketCard({ e, church, url, t }: { e: ChurchEvent; church: ChurchInfo; url: string; t: RegTicket }) {
  const [busy, setBusy] = useState("");
  // The ticket takes its category's colour, else the event page's button colour
  const cat = e.categories?.find((c) => c.id === t.category);
  const color = categoryColor(cat, e, church.profile?.color);
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
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[.18em] text-white/70">{cat ? cat.name : "Admit one"}</p>
          <p className="truncate text-[17px] font-semibold">{t.name || "Guest"}</p>
        </div>
        <div className="relative flex w-[132px] shrink-0 flex-col items-center justify-center gap-1.5 border-l-2 border-dashed border-[#d6d3e4] p-3">
          <span aria-hidden className="absolute -left-3 -top-3 size-6 rounded-full" style={notch} /><span aria-hidden className="absolute -bottom-3 -left-3 size-6 rounded-full" style={notch} />
          <QR value={t.ticket} size={100} />
          <p className="num text-[14px] font-bold tracking-[.06em]">{t.ticket}</p>
          <p className="text-[11.5px] text-[#6b6885]">{ticketLabel(t.status)}</p>
        </div>
      </div>
      {e.accommodationUrl && <a href={e.accommodationUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 border-t border-[#eceaf3] px-4 py-2.5 text-[13px] text-[#4b4864] hover:bg-[#f8f7fc]"><BedDouble size={15} /> Need accommodation? <b className="font-semibold" style={{ color }}>Click here</b></a>}
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
              className="rounded-2xl bg-[var(--ev-accent)] px-5 py-3 text-[15px] font-semibold text-[var(--ev-on-accent)]">Send feedback</button>
          </>
        )}
      </div>
    </section>
  );
}

