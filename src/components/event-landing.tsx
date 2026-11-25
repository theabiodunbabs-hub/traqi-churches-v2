"use client";

import { copyText, savePicture } from "@/lib/share";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, BedDouble, CalendarPlus, Check,  Copy, Download, Gift, Image as ImageIcon, Lock, Mail, MapPin, Navigation,
  Phone, Plus, Radio, Share2, Ticket, UserRound, Wifi, X,
} from "lucide-react";
import { MAX_EXTRAS, categoriesFor, categoryColor, colorsOf, headline, isDark, lookOf, sectionFilled, textOn, type OptionalKey } from "@/lib/event-page";
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

/** Type and shape for each look; the colours are the organiser's. */
export const EV_CSS = `
.ev{--ev-radius:26px;--ev-body:"Figtree Variable",ui-sans-serif,system-ui;font-family:var(--ev-body);-webkit-font-smoothing:antialiased}
.ev[data-look=editorial]{--ev-radius:2px;--ev-body:"Instrument Sans Variable",ui-sans-serif,system-ui}
.ev[data-look=bold]{--ev-radius:22px}
.ev-d{font-family:"Inter Tight Variable",ui-sans-serif,system-ui;font-weight:800;letter-spacing:-.045em;line-height:.92}
.ev[data-look=editorial] .ev-d{font-family:"Fraunces Variable",Georgia,serif;font-weight:300;letter-spacing:-.035em;line-height:.95}
.ev[data-look=bold] .ev-d{font-family:"Archivo Variable",ui-sans-serif,system-ui;font-stretch:125%;font-weight:900;letter-spacing:-.02em;line-height:.9;text-transform:uppercase}
.ev-s{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-weight:400;letter-spacing:0;text-transform:none}
.ev[data-look=editorial] .ev-s{font-family:"Fraunces Variable",Georgia,serif;font-weight:300}
.ev[data-look=bold] .ev-s{font-family:"Archivo Variable",ui-sans-serif;font-stretch:125%;font-style:normal;font-weight:900;text-transform:uppercase;color:var(--ev-icon)}
.ev-k{font-size:12.5px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--ev-icon)}
.ev main{counter-reset:evs}
.ev-num::before{counter-increment:evs;content:counter(evs,decimal-leading-zero) " — "}
.ev[data-look=editorial] .ev-num::before{content:counter(evs,upper-roman) ". "}
.ev[data-look=bold] .ev-num::before{content:"(" counter(evs,decimal-leading-zero) ") "}
.ev-r{opacity:0;transform:translateY(26px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1)}
.ev-r.in{opacity:1;transform:none}
.ev-mq{display:flex;gap:3rem;width:max-content;animation:evmq 32s linear infinite}
@keyframes evmq{to{transform:translateX(-50%)}}
.ev-btn{transition:transform .25s ease,box-shadow .25s ease}.ev-btn:hover{transform:translateY(-2px)}.ev-btn svg{transition:transform .25s ease}.ev-btn:hover svg{transform:translateX(3px)}
.ev-duo{background:var(--ev-card)}.ev-duo img{filter:grayscale(1) contrast(1.06) brightness(.92);transition:filter .6s,transform .8s cubic-bezier(.2,.7,.2,1)}.ev-duo:hover img{filter:none}.ev-duo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,.45))}
.ev[data-look=editorial] .ev-duo::after{display:none}
.ev[data-look=bold] .ev-duo img{filter:none}.ev[data-look=bold] .ev-duo::after{display:none}
.ev-zoom img{transition:transform .8s cubic-bezier(.2,.7,.2,1)}.ev-zoom:hover img{transform:scale(1.045)}
.ev-ul{background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat;transition:background-size .35s}.ev-ul:hover{background-size:100% 1px}
.ev-noscroll{scrollbar-width:none}.ev-noscroll::-webkit-scrollbar{display:none}
@media (prefers-reduced-motion:reduce){.ev-r{opacity:1;transform:none;transition:none}.ev-mq{animation:none}.ev-btn,.ev-btn svg,.ev-zoom img{transition:none}}
`;

/**
 * The public event page (round 9): one of three professionally designed looks (Cinematic, Editorial, Bold),
 * in the organiser's colours. Core sections always show; optional ones only when filled in.
 * Register opens the full-screen registration page; on phones the Register button stays pinned to the bottom.
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
  const look = lookOf(e);
  const root = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  const [regOpen, setRegOpen] = useState(false);
  const [catToken, setCatToken] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
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
  // Sections rise into view as you scroll; a thin line under the top bar shows how far down you are
  useEffect(() => {
    const els = root.current?.querySelectorAll(".ev-r") ?? [];
    const io = new IntersectionObserver((xs) => xs.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach((x) => io.observe(x));
    const onScroll = () => { const h = document.documentElement; setProgress(Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight))); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [look, e.id]);
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
  const nav = [
    { id: "about", label: "About", show: true },
    { id: "people", label: "Speakers", show: filled("speakers") },
    { id: "programme", label: "Programme", show: filled("programme") },
    { id: "when", label: "Venue", show: true },
    { id: "faq", label: "FAQ", show: filled("faq") },
  ].filter((x) => x.show);
  const share = `*${e.title}*${theme ? `\n${theme}` : ""}\n${whenLine(e)}${e.venue && e.mode !== "virtual" ? `\n${e.venue}` : ""}\n\nRegister free: ${url}`;
  const regLabel = full ? "Join the waiting list" : e.needsApproval ? "Request a place" : "Register free";
  const H = "ev-d";
  const reg = { closed: !showReg, regOn, label: regLabel, onRegister: openReg };
  const dark = isDark(col.bg);

  return (
    <div ref={root} className="ev min-h-screen text-[var(--ev-fg)]" data-look={look} style={{ ...eventVars(e, churchColor), background: "var(--ev-page)" }}>
      <style>{EV_CSS}</style>
      {/* Top bar: see-through over the headline, frosted as you scroll */}
      <nav className="sticky top-0 z-40 border-b border-[var(--ev-line)] backdrop-blur-xl" style={{ background: `color-mix(in oklab, ${col.bg} ${progress > 0.01 ? 82 : 55}%, transparent)` }}>
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-5 md:h-[72px] md:px-10">
          <a href="#top" className="flex min-w-0 items-center gap-2.5">
            <ChurchMark church={{ name: church.name, profile: church.profile as ChurchProfile }} size={34} />
            <span className={cx("truncate font-semibold", look === "editorial" && "ev-s text-[19px] not-italic")}>{church.name}</span>
          </a>
          {preview && <span className="rounded-full bg-[var(--ev-accent)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ev-on-accent)]">Preview</span>}
          <div className="ml-auto hidden items-center gap-7 text-[14px] md:flex">
            {nav.map((x) => <a key={x.id} href={`#${x.id}`} className="ev-ul text-[var(--ev-muted)] hover:text-[var(--ev-fg)]">{x.label}</a>)}
          </div>
          {showReg && <button type="button" onClick={openReg} className={cx("ev-btn ml-auto whitespace-nowrap px-4 py-2.5 text-[14px] font-semibold md:ml-3", look === "editorial" ? "rounded-full" : look === "bold" ? "rounded-xl uppercase tracking-wide" : "rounded-full", "bg-[var(--ev-accent)] text-[var(--ev-on-accent)]")}>{regLabel}</button>}
        </div>
        <div className="h-[2px] bg-[var(--ev-accent)] transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
      </nav>

      {live && !ended && <LiveBar e={e} live={live} people={people} />}

      {look === "editorial" ? <EditorialHero e={e} church={church} registered={registered} recent={recent} {...reg} />
        : look === "bold" ? <BoldHero e={e} church={church} registered={registered} recent={recent} {...reg} />
        : <CinematicHero e={e} church={church} registered={registered} recent={recent} {...reg} />}

      {look !== "editorial" && <Marquee e={e} bold={look === "bold"} />}

      <main className="mx-auto max-w-[1240px] space-y-28 px-5 pb-28 pt-24 md:space-y-40 md:px-10 md:pt-36">
        <About e={e} H={H} registered={registered} full={full} />
        {look === "editorial" && e.verse?.text && <VerseBand e={e} />}
        {filled("host") && <div className="ev-r"><HostWelcome e={e} H={H} /></div>}
        {filled("experience") && <Experience e={e} H={H} />}
        {filled("speakers") && <PeopleGrid e={e} people={people} H={H} />}
        {filled("programme") && <Programme e={e} people={people} H={H} now={now} />}
        <WhenWhere e={e} H={H} dark={dark} />
        {filled("online") && <div className="ev-r"><JoinOnline e={e} H={H} /></div>}
        {filled("testimonials") && <Testimonials e={e} H={H} />}
        {!!e.gallery?.length && <div className="ev-r"><Gallery images={e.gallery} H={H} /></div>}
        {(e.page?.extras ?? []).filter((x) => x.title.trim()).slice(0, MAX_EXTRAS).map((x) => <div key={x.id} className="ev-r"><ExtraSection x={x} H={H} /></div>)}
        {!!e.stay?.length && <div className="ev-r"><Stay items={e.stay} H={H} /></div>}
        {filled("faq") && <Faq items={e.faq!.filter((f) => f.q.trim())} H={H} />}
        {e.give && (e.give.url || e.give.account) && <div className="ev-r"><Give give={e.give} H={H} /></div>}
        {filled("partners") && <div className="ev-r"><Partners items={e.partners!} H={H} /></div>}
        {ended && e.feedback?.on && onFeedback && <FeedbackForm e={e} H={H} onSend={onFeedback} />}
      </main>

      <Invitation e={e} H={H} {...reg} />
      {filled("share") && url && <div className="mx-auto max-w-[1240px] px-5 pt-20 md:px-10"><ShareBlock e={e} church={church} url={url} share={share} H={H} /></div>}
      <Footer e={e} church={church} url={url} share={share} nav={nav} />

      {showReg && !regOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--ev-line)] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden" style={{ background: `color-mix(in oklab, ${col.bg} 88%, transparent)` }}>
          <button type="button" onClick={openReg} className={cx("flex w-full items-center justify-center gap-2 py-3.5 font-semibold shadow-lg", look === "editorial" ? "rounded-full" : "rounded-2xl", look === "bold" && "uppercase tracking-wide", "bg-[var(--ev-accent)] text-[var(--ev-on-accent)]")}>
            <Ticket size={18} /> {regLabel} · {shortWhen(e)}
          </button>
        </div>
      )}

      {regOpen && (
        <RegisterScreen e={e} church={church} url={url} H={H} onClose={closeReg}>
          {regOn ? <RegisterPanel e={e} church={church} url={url} closed={closed} full={full} onRegister={onRegister} member={preview ? undefined : member} H={H} catToken={catToken} />
            : <div className={cx(card, "p-6 text-center")}><p className={cx(H, "text-[22px]")}>No registration needed</p><p className="mt-1 text-[14px] text-[var(--ev-muted)]">Just come. Everyone is welcome.</p></div>}
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
    "--ev-muted": "color-mix(in oklab, currentColor 66%, transparent)", "--ev-line": "color-mix(in oklab, currentColor 13%, transparent)",
    "--ev-heading": '"Inter Tight Variable", ui-sans-serif',
  } as CSSProperties;
}
export const evCard = "rounded-[var(--ev-radius)] bg-[var(--ev-card)] text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]";
/** "18–20 Dec", for the pinned button. */
const shortWhen = (e: ChurchEvent) => {
  const d = daysOf(e);
  const a = new Date(`${d[0].date}T12:00:00Z`), b = new Date(`${d[d.length - 1].date}T12:00:00Z`);
  const m = (x: Date) => x.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return d.length === 1 || d[0].date === d[d.length - 1].date ? `${a.getUTCDate()} ${m(a)}` : m(a) === m(b) ? `${a.getUTCDate()}–${b.getUTCDate()} ${m(b)}` : `${a.getUTCDate()} ${m(a)}–${b.getUTCDate()} ${m(b)}`;
};
const placeOf = (e: ChurchEvent) => (e.mode === "virtual" ? "Online" : e.venues?.[0]?.name ?? e.venue ?? "Venue to be announced");

// ---------------- Headline pieces ----------------
function useTicker() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return now;
}
function parts(to: string, now: number) {
  const ms = Math.max(0, Date.parse(to) - now);
  return [[Math.floor(ms / 864e5), "Days"], [Math.floor(ms / 36e5) % 24, "Hours"], [Math.floor(ms / 6e4) % 60, "Minutes"], [Math.floor(ms / 1e3) % 60, "Seconds"]] as const;
}
/** The countdown, drawn for each look. */
function Countdown({ to, variant = "glass" }: { to: string; variant?: "glass" | "serif" | "block" }) {
  const now = useTicker();
  if (now === null) return <div className="h-[84px]" />;
  if (Date.parse(to) <= now) return null;
  const p = parts(to, now);
  if (variant === "serif") return (
    <div className="grid grid-cols-4 border-t border-[var(--ev-fg)] pt-3" role="timer" aria-label="Time until it starts">{p.map(([n, l]) => (
      <div key={l}><b className="ev-d block text-[44px] tabular-nums md:text-[56px]">{String(n).padStart(2, "0")}</b><span className="text-[12px] text-[var(--ev-muted)]">{l}</span></div>
    ))}</div>
  );
  if (variant === "block") return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-label="Time until it starts">{p.map(([n, l]) => (
      <div key={l} className="min-w-0 rounded-2xl bg-[var(--ev-fg)] px-1 py-3 text-center text-[var(--ev-page)]">
        <b className="ev-d block text-[30px] tabular-nums sm:text-[40px] md:text-[48px]">{String(n).padStart(2, "0")}</b><span className="text-[10px] font-bold uppercase tracking-[.12em] opacity-70">{l}</span>
      </div>
    ))}</div>
  );
  return (
    <div className="flex gap-2 md:gap-3" role="timer" aria-label="Time until it starts">{p.map(([n, l]) => (
      <div key={l} className="min-w-0 flex-1 rounded-2xl border border-white/12 bg-white/[.07] px-3 py-3 backdrop-blur-md md:min-w-[92px] md:flex-none md:px-4">
        <b className="ev-d block text-[30px] font-bold tabular-nums md:text-[40px]" style={{ letterSpacing: "-.03em" }}>{String(n).padStart(2, "0")}</b>
        <span className="text-[10.5px] font-medium uppercase tracking-[.18em] opacity-60">{l}</span>
      </div>
    ))}</div>
  );
}

function Proof({ registered, recent }: { registered: number; recent: string[] }) {
  if (registered < 5) return null;
  const tones = ["#f59e0b", "#10b981", "#ec4899", "#38bdf8", "#a78bfa"];
  return (
    <div className="flex items-center gap-3">
      <span className="flex -space-x-2.5">{(recent.length ? recent : ["A", "B", "C", "D"]).slice(0, 4).map((n, i) => (
        <span key={i} className="flex size-9 items-center justify-center rounded-full text-[10.5px] font-bold text-white ring-2 ring-[var(--ev-page)]" style={{ background: tones[i % tones.length] }}>{initials(n) || "•"}</span>
      ))}</span>
      <span className="text-[14px] opacity-80"><b className="opacity-100">{registered.toLocaleString()}</b> registered</span>
    </div>
  );
}

const Arrow = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

function RegButton({ closed, regOn, label, onClick, className }: { closed: boolean; regOn: boolean; label: string; onClick: () => void; className?: string }) {
  if (!regOn) return <span className={cx("inline-flex items-center justify-center px-6 py-4 font-semibold ring-1 ring-current/20", className)}>No registration needed. Just come!</span>;
  if (closed) return <span className={cx("inline-flex items-center justify-center px-6 py-4 font-semibold opacity-80 ring-1 ring-current/20", className)}>Registration has closed</span>;
  return <button type="button" onClick={onClick} className={cx("ev-btn inline-flex items-center justify-center gap-3 bg-[var(--ev-accent)] px-7 py-4 text-[16.5px] font-semibold text-[var(--ev-on-accent)] shadow-xl shadow-black/15", className)}>{label} <Arrow /></button>;
}

/** Pictures that fade into each other by themselves (behind a headline, or inside a frame). */
function Fader({ slides, className, imgClass }: { slides: string[]; className?: string; imgClass?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [slides.length]);
  return (
    <div className={cx("relative overflow-hidden", className)}>
      {slides.map((s, k) => <img key={k} src={s} alt="" loading={k ? "lazy" : "eager"} className={cx("absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1600ms] ease-out", k === i ? "scale-100 opacity-100" : "scale-[1.04] opacity-0", imgClass)} />)}
      {slides.length > 1 && <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-1.5">{slides.map((_, k) => <button key={k} type="button" onClick={() => setI(k)} aria-label={`Picture ${k + 1}`} className={cx("h-1.5 rounded-full bg-white transition-all", k === i ? "w-7" : "w-1.5 opacity-50")} />)}</div>}
    </div>
  );
}

/** Background art for a look when there is no picture: shapes and light in the page's colours. */
function Art({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("absolute inset-0 overflow-hidden", className)}>
      <div className="absolute -left-[10%] top-[-20%] h-[80%] w-[60%] rounded-full opacity-60 blur-[90px]" style={{ background: "var(--ev-accent)" }} />
      <div className="absolute bottom-[-25%] right-[-10%] h-[80%] w-[55%] rounded-full opacity-45 blur-[100px]" style={{ background: "var(--ev-icon)" }} />
      <div className="absolute inset-0 opacity-[.07]" style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
    </div>
  );
}

/** The headline picture for a frame: the carousel, the video (silent loop; tap for sound), the picture or flyer. */
function MediaFrame({ e, className, cover = true }: { e: ChurchEvent; className?: string; cover?: boolean }) {
  const m = headline(e);
  const [sound, setSound] = useState(false);
  if (m.kind === "carousel") return <Fader slides={m.slides} className={className} />;
  if (m.kind === "video") return (
    <div className={cx("relative overflow-hidden bg-black", className)}>
      <video src={m.src} poster={m.poster} autoPlay muted={!sound} loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
      <button type="button" onClick={() => setSound(!sound)} className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur">{sound ? "Sound off" : "Tap for sound"}</button>
    </div>
  );
  if (m.src) return <div className={cx("relative overflow-hidden", className)}><img src={m.src} alt={`${e.title}`} className={cx("absolute inset-0 h-full w-full", cover ? "object-cover" : "object-contain")} /></div>;
  return <div className={cx("relative overflow-hidden bg-[var(--ev-card)]", className)}><Art /></div>;
}
/** A flyer has its own words on it: it sits beside the title, never behind it. */
const isFlyer = (e: ChurchEvent) => headline(e).kind === "flyer" && !!e.flyer;

type HeroProps = { e: ChurchEvent; church: ChurchInfo; registered: number; recent: string[]; closed: boolean; regOn: boolean; label: string; onRegister: () => void };

// ---------------- Cinematic: dark, full-screen, dramatic ----------------
function CinematicHero({ e, church, registered, recent, closed, regOn, label, onRegister }: HeroProps) {
  const m = headline(e);
  const flyer = isFlyer(e);
  const theme = themeOf(e);
  const text = (
    <div className="min-w-0">
      <p className="ev-k" style={{ letterSpacing: ".3em" }}>{church.name} presents</p>
      <h1 className={cx("ev-d mt-5 break-words", e.title.length > 18 ? "text-[clamp(46px,8.4vw,128px)]" : "text-[clamp(56px,12vw,176px)]")}>{e.title}</h1>
      {theme && <p className="ev-s mt-5 max-w-3xl text-[clamp(24px,3.6vw,44px)] leading-[1.08] opacity-95">{theme}</p>}
      <p className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-[15.5px] opacity-80"><span>{whenLine(e)}</span><span>{placeOf(e)}</span>{e.mode === "hybrid" && <span>and online</span>}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <RegButton closed={closed} regOn={regOn} label={label} onClick={onRegister} className="rounded-full" />
        <a href="#about" className="ev-btn inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 text-[15.5px] font-semibold ring-1 ring-white/25 backdrop-blur hover:bg-white/10">Learn more</a>
      </div>
    </div>
  );
  const strip = (
    <div className="mt-12 flex flex-col gap-5 border-t border-white/15 pt-7 md:flex-row md:items-center md:justify-between">
      <Countdown to={e.start} />
      <Proof registered={registered} recent={recent} />
    </div>
  );
  if (flyer) return (
    <header id="top" className="relative overflow-hidden text-white">
      <img src={e.flyer} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-3xl" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--ev-page) 55%, transparent), var(--ev-page))" }} />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-16 pt-12 md:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)] md:px-10 md:pb-24 md:pt-20">
        <div className="order-2 md:order-1">{text}{strip}</div>
        <div className="order-1 mx-auto w-full max-w-[420px] md:order-2">
          <div className="relative">
            <div aria-hidden className="absolute -inset-6 rounded-[40px] opacity-60 blur-3xl" style={{ background: "var(--ev-accent)" }} />
            <img src={e.flyer} alt={`${e.title} flyer`} className="relative w-full rounded-[22px] shadow-2xl ring-1 ring-white/15 md:rotate-[1.5deg]" />
          </div>
        </div>
      </div>
    </header>
  );
  return (
    <header id="top" className="relative flex min-h-[92svh] items-end overflow-hidden text-white md:min-h-[880px]">
      {m.kind === "carousel" ? <Fader slides={m.slides} className="absolute inset-0" />
        : m.kind === "video" ? <video src={m.src} poster={m.poster} autoPlay muted loop playsInline preload="metadata" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        : m.src ? <img src={m.src} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-[var(--ev-page)]"><Art /></div>}
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.1) 32%, color-mix(in oklab, var(--ev-page) 86%, transparent) 76%, var(--ev-page) 100%)" }} />
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(900px 520px at 12% 92%, color-mix(in oklab, var(--ev-icon) 30%, transparent), transparent 70%)" }} />
      <div className="relative mx-auto w-full max-w-[1240px] px-5 pb-12 pt-28 md:px-10 md:pb-16">{text}{strip}</div>
    </header>
  );
}

// ---------------- Editorial: light, magazine-like ----------------
function EditorialHero({ e, church, registered, recent, closed, regOn, label, onRegister }: HeroProps) {
  const theme = themeOf(e);
  const flyer = isFlyer(e);
  const side = e.gallery?.[0] ?? e.page?.host?.photos?.[0];
  const kind = e.mode === "virtual" ? "Online" : e.venues?.[0]?.name ?? e.venue ?? "";
  return (
    <header id="top" className="pt-10 md:pt-14">
      <div className="mx-auto max-w-[1240px] px-5 md:px-10">
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-b border-[var(--ev-fg)] pb-3 text-[12px] font-semibold uppercase tracking-[.22em]">
          <span>{church.name}</span><span className="hidden md:inline">{kind}</span><span>{whenLine(e)}</span>
        </div>
        <div className="mt-8 grid gap-8 md:grid-cols-12 md:items-end">
          <h1 className={cx("ev-d break-words md:col-span-8", e.title.length > 18 ? "text-[clamp(52px,9vw,140px)]" : "text-[clamp(64px,13vw,210px)]")}>{e.title}<span className="text-[var(--ev-accent)]">.</span></h1>
          <div className="md:col-span-4 md:pb-6">
            {theme && <p className="ev-s text-[30px] leading-[1.1] md:text-[34px]">{theme}</p>}
            {(e.tagline || e.description) && <p className="mt-3 text-[16.5px] leading-relaxed text-[var(--ev-muted)]">{(e.tagline || e.description || "").split(/(?<=\.)\s/)[0]}</p>}
            <div className="mt-6"><RegButton closed={closed} regOn={regOn} label={label} onClick={onRegister} className="w-full rounded-full sm:w-auto" /></div>
            <div className="mt-5"><Proof registered={registered} recent={recent} /></div>
          </div>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-12">
          {flyer ? (
            <>
              <div className="flex flex-col justify-end gap-8 md:col-span-7">
                {e.verse?.text && <p className="ev-s text-[26px] leading-snug md:text-[34px]">“{e.verse.text}” <span className="text-[14px] not-italic tracking-wide text-[var(--ev-muted)]">{e.verse.ref}</span></p>}
                <div><p className="ev-k mb-3 text-[var(--ev-muted)]">Starts in</p><Countdown to={e.start} variant="serif" /></div>
              </div>
              <figure className="md:col-span-5"><img src={e.flyer} alt={`${e.title} flyer`} className="w-full shadow-[0_30px_80px_-30px_rgba(0,0,0,.45)]" /></figure>
            </>
          ) : (
            <>
              <figure className="md:col-span-8">
                <MediaFrame e={e} className="h-[420px] w-full md:h-[600px]" />
                <figcaption className="mt-2.5 text-[13px] text-[var(--ev-muted)]">{whenLine(e)}{kind ? ` · ${kind}` : ""}</figcaption>
              </figure>
              <div className="flex flex-col justify-between gap-8 md:col-span-4">
                {side ? <img src={side} alt="" className="hidden h-[340px] w-full object-cover md:block" /> : <div className="hidden md:block" />}
                <div><p className="ev-k mb-3 text-[var(--ev-muted)]">Starts in</p><Countdown to={e.start} variant="serif" /></div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Editorial: the verse as a full-width band in the main colour. */
function VerseBand({ e }: { e: ChurchEvent }) {
  return (
    <section className="ev-r -mx-5 bg-[var(--ev-accent)] px-5 py-24 text-center text-[var(--ev-on-accent)] md:-mx-10 md:py-32" style={{ marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)" }}>
      <p className="ev-s mx-auto max-w-5xl text-[clamp(30px,4.6vw,60px)] leading-[1.12]">“{e.verse!.text}”</p>
      <p className="mt-7 text-[12.5px] font-semibold uppercase tracking-[.24em] opacity-75">{e.verse!.ref}</p>
    </section>
  );
}

// ---------------- Bold: huge type, colour blocks ----------------
function BoldHero({ e, church, registered, recent, closed, regOn, label, onRegister }: HeroProps) {
  const theme = themeOf(e);
  const flyer = isFlyer(e);
  return (
    <header id="top" className="relative overflow-hidden">
      <div className="bg-[var(--ev-card)] text-[var(--ev-card-fg)]">
        <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-10 md:px-10 md:pb-20 md:pt-16">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--ev-card-fg)] px-4 py-1.5 text-[12.5px] font-bold uppercase tracking-[.14em] text-[var(--ev-card)]">{church.name}</span>
            {theme && <span className="-rotate-2 rounded-lg bg-[var(--ev-page)] px-4 py-1.5 text-[14px] font-bold text-[var(--ev-fg)] shadow-lg">{theme}</span>}
          </div>
          <h1 className={cx("ev-d mt-7 break-words", e.title.length > 18 ? "text-[clamp(32px,8.8vw,132px)]" : "text-[clamp(44px,12vw,190px)]")}>{e.title}</h1>
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-1 text-[clamp(20px,2.4vw,30px)] font-extrabold uppercase leading-tight tracking-tight" style={{ fontFamily: '"Archivo Variable"' }}>
              <p>{whenLine(e)}</p><p className="opacity-70">{placeOf(e)}{e.mode === "hybrid" ? " + online" : ""}</p>
            </div>
            <RegButton closed={closed} regOn={regOn} label={label} onClick={onRegister} className="rounded-2xl !bg-[var(--ev-card-fg)] !text-[var(--ev-card)] text-[17px] uppercase tracking-wide" />
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 md:grid-cols-12 md:items-center md:px-10 md:py-16">
        <div className="md:col-span-7">
          {flyer ? <img src={e.flyer} alt={`${e.title} flyer`} className="mx-auto w-full max-w-[460px] -rotate-2 rounded-[22px] shadow-2xl ring-4 ring-[var(--ev-fg)]" />
            : <MediaFrame e={e} className="h-[340px] w-full -rotate-1 rounded-[22px] shadow-2xl ring-4 ring-[var(--ev-fg)] md:h-[520px]" />}
        </div>
        <div className="space-y-7 md:col-span-5">
          <p className="ev-k" style={{ color: "var(--ev-fg)" }}>Starts in</p>
          <Countdown to={e.start} variant="block" />
          <Proof registered={registered} recent={recent} />
        </div>
      </div>
    </header>
  );
}

/** A slow band of words from the theme (Cinematic: outlined; Bold: solid on black). */
function Marquee({ e, bold }: { e: ChurchEvent; bold: boolean }) {
  const stop = new Set(["and", "the", "for", "with", "our", "your", "you", "from", "into", "unto", "this", "that", "are", "all", "of", "in", "to", "a"]);
  const words = [...new Set([...(themeOf(e) || e.title).split(/[^\p{L}\p{N}']+/u).filter((w) => w.length > 2 && !stop.has(w.toLowerCase())), e.title.split(/[:–-]/)[0].trim()])].slice(0, 5);
  const row = [...words, ...words];
  return (
    <div aria-hidden className={cx("overflow-hidden py-6 md:py-7", bold ? "bg-[var(--ev-fg)] text-[var(--ev-page)]" : "border-y border-[var(--ev-line)]")}>
      <div className="ev-mq">{[0, 1].map((k) => (
        <div key={k} className="flex shrink-0 items-center gap-12">{row.map((w, i) => (
          <span key={i} className="flex items-center gap-12">
            <span className="ev-d whitespace-nowrap text-[44px] md:text-[60px]" style={!bold && i % 2 === 0 ? { color: "transparent", WebkitTextStroke: "1.2px var(--ev-fg)", opacity: 0.5 } : undefined}>{w}</span>
            <span className="text-[28px]" style={{ color: bold ? "var(--ev-card)" : "var(--ev-accent)" }}>✦</span>
          </span>
        ))}</div>
      ))}</div>
    </div>
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
/** Every section opens the same way: a numbered label (01 —, I., (01)) and a big title. */
function SectionTitle({ id, kicker, title, H, side }: { id: string; kicker?: string; title: ReactNode; H: string; side?: ReactNode }) {
  return (
    <div id={id} className="mb-10 scroll-mt-28 md:mb-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {kicker && <p className="ev-k ev-num">{kicker}</p>}
          <h2 className={cx(H, "mt-4 max-w-4xl text-[clamp(38px,6vw,72px)]")}>{title}</h2>
        </div>
        {side}
      </div>
    </div>
  );
}

const card = "rounded-[var(--ev-radius)] bg-[var(--ev-card)] text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]";

function About({ e, H, registered, full }: { e: ChurchEvent; H: string; registered: number; full: boolean }) {
  const lead = e.tagline?.trim() || themeOf(e) || e.title;
  // Editorial already shows the first gallery picture in the headline
  const pics = [...(e.page?.media?.kind === "carousel" ? e.page.media.slides ?? [] : []), ...(e.gallery ?? []), ...(e.page?.host?.photos ?? [])].slice(lookOf(e) === "editorial" ? 1 : 0).slice(0, 2);
  const facts = [
    { k: "Who", v: "Everyone is welcome" },
    { k: "Cost", v: full ? "Free · waiting list" : e.capacity ? `Free · ${Math.max(0, e.capacity - registered)} places left` : "Free" },
    { k: "Where", v: e.mode === "virtual" ? "Online" : `${placeOf(e)}${e.mode === "hybrid" ? " and online" : ""}` },
  ];
  return (
    <section className="ev-r">
      <div className={cx("grid gap-12", pics.length > 0 && "md:grid-cols-12")}>
        <div className={pics.length ? "md:col-span-7" : ""}>
          <p id="about" className="ev-k ev-num scroll-mt-28">About</p>
          <h2 className={cx(H, "mt-5 max-w-4xl text-[clamp(34px,5vw,64px)]")} style={{ lineHeight: 1.02 }}>{lead}</h2>
          {e.description && <p className="mt-8 max-w-2xl whitespace-pre-line text-[18px] leading-[1.75] text-[var(--ev-muted)]">{e.description}</p>}
          {e.verse?.text && lookOf(e) !== "editorial" && (
            <figure className="mt-10 border-l-2 border-[var(--ev-accent)] pl-6">
              <blockquote className="ev-s text-[26px] leading-snug md:text-[30px]">“{e.verse.text}”</blockquote>
              <figcaption className="mt-3 text-[12px] font-semibold uppercase tracking-[.2em] text-[var(--ev-muted)]">{e.verse.ref}</figcaption>
            </figure>
          )}
          <dl className="mt-10 grid max-w-2xl grid-cols-1 gap-px overflow-hidden rounded-[var(--ev-radius)] bg-[var(--ev-line)] sm:grid-cols-3">
            {facts.map((f) => <div key={f.k} className="bg-[var(--ev-page)] p-4"><dt className="text-[11.5px] font-semibold uppercase tracking-[.18em] text-[var(--ev-muted)]">{f.k}</dt><dd className="mt-1 text-[15px] font-semibold">{f.v}</dd></div>)}
          </dl>
        </div>
        {pics.length > 0 && (
          <div className="relative min-h-[420px] md:col-span-5 md:min-h-[560px]">
            <img src={pics[0]} alt="" className="absolute right-0 top-0 h-[78%] w-[80%] rounded-[var(--ev-radius)] object-cover" />
            {pics[1] && <img src={pics[1]} alt="" className="absolute bottom-0 left-0 h-[44%] w-[62%] rounded-[var(--ev-radius)] object-cover ring-[6px] ring-[var(--ev-page)]" />}
          </div>
        )}
      </div>
    </section>
  );
}

function Face({ p, size, ring = "" }: { p: EventPerson; size: number; ring?: string }) {
  return p.photo
    ? <img src={p.photo} alt="" className={cx("shrink-0 rounded-full object-cover", ring)} style={{ width: size, height: size }} />
    : <span className={cx("flex shrink-0 items-center justify-center rounded-full font-semibold text-[var(--ev-on-accent)]", ring)} style={{ width: size, height: size, fontSize: size * 0.36, background: "var(--ev-accent)" }}>{initials(p.name)}</span>;
}

/** No photo: a neat silhouette in the page's colours, never coloured squares with initials. */
function Silhouette() {
  return (
    <svg viewBox="0 0 100 125" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMax slice">
      <rect width="100" height="125" fill="var(--ev-card)" />
      <circle cx="50" cy="48" r="19" fill="currentColor" opacity=".18" />
      <path d="M12 125c2-26 18-40 38-40s36 14 38 40z" fill="currentColor" opacity=".18" />
    </svg>
  );
}

/** Speakers: large portraits in one treatment (tinted, black-and-white or framed), sliding on phones; tap for the bio. */
function PeopleGrid({ e, people, H }: { e: ChurchEvent; people: EventPerson[]; H: string }) {
  const [open, setOpen] = useState<EventPerson | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const look = lookOf(e);
  const order = ["Speaker", "Minister", "Music minister", "Host", "Special guest"];
  const sorted = [...people].sort((a, b) => (order.indexOf(a.label) + 1 || 9) - (order.indexOf(b.label) + 1 || 9));
  const slide = (d: number) => row.current?.scrollBy({ left: d * Math.min(340, row.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <section className="ev-r">
      <SectionTitle id="people" kicker="Ministering" title={people.every((p) => p.label === "Speaker") ? "Speakers" : "The voices"} H={H}
        side={sorted.length > 3 ? (
          <div className="hidden gap-2 md:flex">
            <button type="button" onClick={() => slide(-1)} aria-label="Previous" className="flex size-12 items-center justify-center rounded-full ring-1 ring-[var(--ev-line)] hover:bg-[var(--ev-card)]"><ArrowLeft size={18} /></button>
            <button type="button" onClick={() => slide(1)} aria-label="Next" className="flex size-12 items-center justify-center rounded-full ring-1 ring-[var(--ev-line)] hover:bg-[var(--ev-card)]"><ArrowRight size={18} /></button>
          </div>
        ) : undefined} />
      <div ref={row} className="ev-noscroll -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:gap-6 md:px-0">
        {sorted.map((p, i) => (
          <button type="button" key={p.id} onClick={() => setOpen(p)} className={cx("ev-zoom group flex w-[70%] flex-col self-start max-w-[300px] shrink-0 snap-start text-left sm:w-[270px]", look === "bold" && (i % 2 ? "md:rotate-1" : "md:-rotate-1"))}>
            <div className={cx("ev-duo relative aspect-[4/5] overflow-hidden rounded-[var(--ev-radius)]", look === "bold" && "ring-4 ring-[var(--ev-fg)]")}>
              {p.photo ? <img src={p.photo} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Silhouette />}
              <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.12em] text-white backdrop-blur">{p.label}</span>
            </div>
            <p className={cx("mt-4 text-[20px] leading-tight", look === "editorial" ? "ev-s not-italic" : "font-bold tracking-tight")}>{p.name}</p>
            {(p.from || p.bio) && <p className="mt-1 line-clamp-1 text-[14px] text-[var(--ev-muted)]">{p.from ?? p.bio}</p>}
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm md:items-center" onClick={() => setOpen(null)} role="dialog" aria-modal aria-label={open.name}>
          <div className={cx(card, "relative max-h-[86vh] w-full max-w-lg overflow-y-auto")} onClick={(x) => x.stopPropagation()}>
            {open.photo && <img src={open.photo} alt="" className="h-64 w-full object-cover" />}
            <button type="button" onClick={() => setOpen(null)} className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white backdrop-blur" aria-label="Close"><X size={18} /></button>
            <div className="p-6">
              <p className="ev-k">{open.label}</p>
              <p className={cx(H, "mt-2 text-[30px]")}>{open.name}</p>
              {open.from && <p className="mt-1 text-[14.5px] text-[var(--ev-muted)]">{open.from}</p>}
              {open.bio && <p className="mt-5 whitespace-pre-line text-[16px] leading-relaxed text-[var(--ev-muted)]">{open.bio}</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Programme: day tabs, then the sessions with the time in its own column. */
function Programme({ e, people, H, now }: { e: ChurchEvent; people: EventPerson[]; H: string; now: number }) {
  const days = daysOf(e);
  const live = happeningNow(e, now);
  const [d, setD] = useState(live?.dayIndex ?? 0);
  const day = days[d] ?? days[0];
  const look = lookOf(e);
  const sessions = day.sessions?.length ? [...day.sessions].sort((a, b) => a.start.localeCompare(b.start)) : e.schedule.map((s, i) => ({ id: `o${i}`, start: "", title: s.item, label: s.time }));
  return (
    <section className="ev-r grid gap-10 md:grid-cols-12">
      <div className="md:col-span-4">
        <p id="programme" className="ev-k ev-num scroll-mt-28">Programme</p>
        <h2 className={cx(H, "mt-4 text-[clamp(38px,5vw,64px)]")}>{days.length > 1 ? <>{days.length} days, <span className="ev-s">hour by hour</span></> : <>On the <span className="ev-s">day</span></>}</h2>
        {days.length > 1 && (
          <div className="ev-noscroll mt-8 flex gap-2 overflow-x-auto md:flex-col">{days.map((x, i) => {
            const on = i === d;
            return (
              <button type="button" key={x.date} onClick={() => setD(i)} aria-pressed={on}
                className={cx("shrink-0 px-5 py-4 text-left transition md:w-full",
                  look === "editorial" ? cx("border-b border-[var(--ev-line)]", on ? "border-l-[3px] border-l-[var(--ev-accent)] pl-4 text-[var(--ev-accent)]" : "") : cx("rounded-2xl", on ? "bg-[var(--ev-accent)] text-[var(--ev-on-accent)]" : "bg-[var(--ev-card)] text-[var(--ev-card-fg)] ring-1 ring-[var(--ev-line)]"))}>
                <span className="block text-[12px] font-semibold uppercase tracking-[.16em] opacity-75">Day {i + 1}{live?.dayIndex === i ? " · Today" : ""}</span>
                <span className="mt-0.5 block text-[17px] font-bold">{fmtDay(x.date, { weekday: "short", day: "numeric", month: "short" })}{x.title ? <span className="font-normal opacity-80"> · {x.title}</span> : null}</span>
              </button>
            );
          })}</div>
        )}
      </div>
      <ol className="md:col-span-7 md:col-start-6">
        {sessions.map((s) => {
          const isNow = live?.dayIndex === d && live.session?.id === s.id;
          const who = "personIds" in s ? (s.personIds ?? []).map((id) => people.find((p) => p.id === id)).filter(Boolean) as EventPerson[] : [];
          const venue = "venueId" in s && s.venueId ? e.venues?.find((v) => v.id === s.venueId) : undefined;
          return (
            <li key={s.id} className={cx("grid grid-cols-[88px_1fr] gap-5 border-b border-[var(--ev-line)] py-6 md:grid-cols-[120px_1fr]", isNow && "relative")}>
              <span className="pt-1 text-[14.5px] font-semibold tabular-nums text-[var(--ev-icon)]">{"label" in s ? s.label : t12(s.start)}</span>
              <div>
                <p className={cx("text-[21px] leading-snug md:text-[24px]", look === "editorial" ? "ev-s not-italic" : "font-bold tracking-tight")}>{s.title}
                  {isNow && <span className="ml-3 inline-flex translate-y-[-3px] items-center gap-1.5 rounded-full bg-[#e11d48] px-2.5 py-1 align-middle text-[11px] font-bold uppercase tracking-wider text-white">● Now</span>}</p>
                {(who.length > 0 || venue) && (
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-[var(--ev-muted)]">
                    {who.length > 0 && <span className="flex items-center gap-2"><span className="flex -space-x-2">{who.map((p) => <Face key={p.id} p={p} size={26} ring="ring-2 ring-[var(--ev-page)]" />)}</span>{who.map((p) => p.name).join(", ")}</span>}
                    {venue && <span className="flex items-center gap-1"><MapPin size={13} />{venue.name}</span>}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** When and where: the days, the venue with a real map, and the online card. */
function WhenWhere({ e, H, dark }: { e: ChurchEvent; H: string; dark: boolean }) {
  const days = daysOf(e);
  const venues = e.mode === "virtual" ? [] : e.venues?.length ? e.venues : e.venue ? [{ id: "v", name: e.venue }] : [];
  const main = venues[0];
  const addr = main && (("address" in main && main.address) || main.name);
  const maps = main && (("mapUrl" in main && main.mapUrl) || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(String(addr))}`);
  return (
    <section className="ev-r">
      <SectionTitle id="when" kicker="When and where" title={<>{e.mode === "virtual" ? "Join from " : "Come and "}<span className="ev-s">{e.mode === "virtual" ? "anywhere" : "find us"}</span></>} H={H} />
      <div className="grid gap-4 md:grid-cols-12">
        {main && (
          <div className={cx(card, "relative min-h-[380px] overflow-hidden md:col-span-7 md:min-h-[460px]")}>
            <iframe title={`Map: ${main.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="absolute inset-0 h-full w-full border-0"
              style={{ filter: dark ? "invert(.92) hue-rotate(180deg) saturate(.35) brightness(.9)" : "grayscale(.6) contrast(1.05)" }}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(String(addr))}&z=15&output=embed`} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(transparent, var(--ev-card))" }} />
            <div className="absolute inset-x-5 bottom-5 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0"><p className="text-[22px] font-bold tracking-tight">{main.name}</p>{"address" in main && main.address && <p className="mt-0.5 text-[14px] text-[var(--ev-muted)]">{main.address}</p>}</div>
              <a href={maps} target="_blank" rel="noreferrer" className="ev-btn inline-flex items-center gap-2 rounded-full bg-[var(--ev-accent)] px-5 py-3 text-[14px] font-semibold text-[var(--ev-on-accent)]"><Navigation size={15} /> Get directions</a>
            </div>
          </div>
        )}
        <div className={cx("flex flex-col gap-4", main ? "md:col-span-5" : "md:col-span-12")}>
          <div className={cx(card, "p-6")}>
            <p className="ev-k mb-4">{days.length > 1 ? "The days" : "The day"}</p>
            <ul className="divide-y divide-[var(--ev-line)]">{days.map((d, i) => (
              <li key={d.date} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 py-3 text-[15px]">
                <span className="text-[13px] font-bold uppercase tracking-wider text-[var(--ev-icon)]">{fmtDay(d.date, { weekday: "short", day: "numeric" })}</span>
                <span className="min-w-0 truncate">{d.title || (days.length > 1 ? `Day ${i + 1}` : fmtDay(d.date, { month: "long" }))}</span>
                <span className="text-[14px] text-[var(--ev-muted)]">{t12(d.start)} – {t12(d.end)}</span>
              </li>
            ))}</ul>
            {main && "directions" in main && main.directions && <p className="mt-4 border-t border-[var(--ev-line)] pt-4 text-[14px] leading-relaxed text-[var(--ev-muted)]">{main.directions}</p>}
          </div>
          {venues.slice(1).map((v) => (
            <div key={v.id} className={cx(card, "flex items-center gap-3 p-5")}>
              <MapPin size={18} className="shrink-0 text-[var(--ev-icon)]" />
              <span className="min-w-0 flex-1"><b className="block font-semibold">{v.name}</b><span className="text-[13.5px] text-[var(--ev-muted)]">{("address" in v && v.address) || ("note" in v && v.note) || ""}</span></span>
            </div>
          ))}
          {e.mode !== "physical" && (
            <div className="flex-1 rounded-[var(--ev-radius)] p-6 text-white" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--ev-icon) 55%, #000), color-mix(in oklab, var(--ev-accent) 45%, #000))" }}>
              <p className="text-[12px] font-semibold uppercase tracking-[.2em] opacity-80">{e.mode === "virtual" ? "Online" : "Can't make it in person?"}</p>
              <p className="mt-2 text-[22px] font-bold tracking-tight">Join online, live.</p>
              <p className="mt-1.5 text-[14px] leading-relaxed opacity-80">Register{e.mode === "hybrid" ? " as Online" : ""} and we&apos;ll send you the link and reminders.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Faq({ items, H }: { items: { q: string; a: string }[]; H: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="ev-r grid gap-10 md:grid-cols-12">
      <div className="md:col-span-4">
        <p id="faq" className="ev-k ev-num scroll-mt-28">Questions</p>
        <h2 className={cx(H, "mt-4 text-[clamp(38px,5vw,64px)]")}>Good to <span className="ev-s">know</span></h2>
      </div>
      <ul className="border-t border-[var(--ev-line)] md:col-span-7 md:col-start-6">
        {items.map((f, i) => (
          <li key={i} className="border-b border-[var(--ev-line)]">
            <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-4 py-6 text-left" aria-expanded={open === i}>
              <span className="flex-1 text-[19px] font-semibold leading-snug md:text-[21px]">{f.q}</span>
              <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-[var(--ev-line)] transition", open === i && "rotate-45 bg-[var(--ev-accent)] text-[var(--ev-on-accent)] ring-transparent")}><Plus size={17} /></span>
            </button>
            <div className={cx("grid transition-[grid-template-rows] duration-300", open === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <p className="overflow-hidden pr-12 text-[16px] leading-relaxed text-[var(--ev-muted)]"><span className="block pb-6">{f.a}</span></p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The experience: three cards (Cinematic: pictures; Editorial: numbered columns; Bold: colour blocks). */
function Experience({ e, H }: { e: ChurchEvent; H: string }) {
  const items = (e.page?.experience ?? []).filter((x) => x.title.trim()).slice(0, 3);
  const look = lookOf(e);
  // Different pictures from the About section where there are enough
  const all = [...(e.page?.media?.kind === "carousel" ? e.page.media.slides ?? [] : []), ...(e.gallery ?? [])];
  const pics = all.length >= 5 ? all.slice(2) : [...all].reverse();
  const numerals = ["I", "II", "III"];
  return (
    <section className="ev-r">
      <SectionTitle id="experience" kicker="What to expect" title={<>The <span className="ev-s">experience</span></>} H={H} />
      <div className="grid gap-4 md:grid-cols-3 md:gap-5">{items.map((x, i) => {
        if (look === "editorial") return (
          <div key={i} className="border-t border-[var(--ev-fg)] pt-6">
            <p className="ev-d text-[64px] text-[var(--ev-accent)]">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="ev-s mt-4 text-[28px] not-italic leading-tight">{x.title}</h3>
            {x.body && <p className="mt-3 text-[16px] leading-relaxed text-[var(--ev-muted)]">{x.body}</p>}
          </div>
        );
        if (look === "bold") return (
          <div key={i} className={cx("rounded-[var(--ev-radius)] p-7 md:p-8", i === 1 ? "bg-[var(--ev-fg)] text-[var(--ev-page)]" : "bg-[var(--ev-card)] text-[var(--ev-card-fg)]")}>
            <p className="ev-d text-[72px] leading-none">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="mt-8 text-[26px] font-extrabold uppercase leading-tight tracking-tight" style={{ fontFamily: '"Archivo Variable"' }}>{x.title}</h3>
            {x.body && <p className="mt-3 text-[16px] leading-relaxed opacity-80">{x.body}</p>}
          </div>
        );
        const pic = pics[i];
        return (
          <div key={i} className="ev-zoom relative flex h-[420px] items-end overflow-hidden rounded-[var(--ev-radius)] bg-[var(--ev-card)] md:h-[520px]">
            {pic ? <img src={pic} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Art />}
            <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 35%, rgba(0,0,0,.88))" }} />
            <div className="relative p-7 text-white">
              <span className="text-[14px] font-semibold" style={{ color: "var(--ev-accent)" }}>{numerals[i]}</span>
              <h3 className="mt-2 text-[28px] font-bold leading-tight tracking-tight">{x.title}</h3>
              {x.body && <p className="mt-2 text-[15px] leading-relaxed text-white/75">{x.body}</p>}
            </div>
          </div>
        );
      })}</div>
    </section>
  );
}

/** Testimonials: one big quote at a time (Cinematic, Bold), or side by side (Editorial). */
function Testimonials({ e, H }: { e: ChurchEvent; H: string }) {
  const items = (e.page?.testimonials ?? []).filter((t) => t.quote.trim() && t.name.trim());
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length]);
  if (lookOf(e) === "editorial") return (
    <section className="ev-r">
      <SectionTitle id="testimonials" kicker="In their words" title={<>What people <span className="ev-s">said</span></>} H={H} />
      <div className="grid gap-12 md:grid-cols-2">{items.slice(0, 4).map((t, k) => (
        <figure key={k}>
          <p className="ev-d text-[96px] leading-[.5] text-[var(--ev-accent)]">“</p>
          <blockquote className="ev-s mt-4 text-[28px] not-italic leading-[1.25] md:text-[32px]">{t.quote}</blockquote>
          <figcaption className="mt-5 text-[14.5px]"><b>{t.name}</b>{t.role && <span className="text-[var(--ev-muted)]"> · {t.role}</span>}</figcaption>
        </figure>
      ))}</div>
    </section>
  );
  const t = items[i % items.length];
  return (
    <section className="ev-r mx-auto max-w-5xl text-center">
      <p id="testimonials" className="ev-k ev-num scroll-mt-28">In their words</p>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--ev-accent)" aria-hidden className="mx-auto mt-8"><path d="M7 7h4v4H8c0 2 1 3 3 3v3c-4 0-6-2-6-6V7zm9 0h4v4h-3c0 2 1 3 3 3v3c-4 0-6-2-6-6V7z" /></svg>
      <blockquote key={i} className="ev-s mt-6 text-[clamp(28px,4.4vw,56px)] leading-[1.15] transition-opacity duration-700">{t.quote}</blockquote>
      <p className="mt-8 text-[13.5px] font-semibold uppercase tracking-[.18em] text-[var(--ev-muted)]">{t.name}{t.role ? ` · ${t.role}` : ""}</p>
      {items.length > 1 && <div className="mt-8 flex justify-center gap-2">{items.map((_, k) => <button key={k} type="button" onClick={() => setI(k)} aria-label={`Quote ${k + 1}`} className={cx("h-1.5 rounded-full transition-all", k === i % items.length ? "w-8 bg-[var(--ev-accent)]" : "w-2 bg-[var(--ev-line)]")} />)}</div>}
    </section>
  );
}

/** The closing invitation: the one loud moment of the page. */
function Invitation({ e, H, closed, regOn, label, onRegister }: { e: ChurchEvent; H: string; closed: boolean; regOn: boolean; label: string; onRegister: () => void }) {
  const inv = e.page?.invite;
  const look = lookOf(e);
  const theme = themeOf(e);
  const title = inv?.title?.trim() || (theme ? `${theme} with us` : `Don't miss ${e.title}`);
  const body = inv?.body?.trim() || "Come expectant. Bring someone with you. We can't wait to see you there.";
  const m = headline(e);
  const pic = m.kind === "carousel" ? m.slides[m.slides.length - 1] : m.kind === "video" ? m.poster : e.gallery?.[0] ?? (isFlyer(e) ? undefined : m.src);
  const inner = (light: boolean) => (
    <div className="relative mx-auto max-w-[1240px] px-5 py-28 text-center md:px-10 md:py-40">
      <p className="text-[12.5px] font-semibold uppercase tracking-[.3em]" style={{ color: light ? undefined : "var(--ev-accent)", opacity: light ? 0.75 : 1 }}>{whenLine(e)}</p>
      <h2 className={cx(H, "mx-auto mt-6 max-w-5xl text-[clamp(48px,9vw,128px)]")}>{title}</h2>
      <p className="mx-auto mt-7 max-w-xl text-[18px] leading-relaxed opacity-80">{body}</p>
      <div className="mt-10 flex justify-center"><RegButton closed={closed} regOn={regOn} label={label} onClick={onRegister} className={cx(look === "editorial" ? "rounded-full" : look === "bold" ? "rounded-2xl uppercase tracking-wide !bg-[var(--ev-card-fg)] !text-[var(--ev-card)]" : "rounded-full", "text-[17px]")} /></div>
    </div>
  );
  if (look === "editorial") return <section className="bg-[var(--ev-fg)] text-[var(--ev-page)]">{inner(true)}</section>;
  if (look === "bold") return <section className="bg-[var(--ev-card)] text-[var(--ev-card-fg)]">{inner(true)}</section>;
  return (
    <section className="relative overflow-hidden text-white">
      {pic ? <img src={pic} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-[var(--ev-card)]"><Art /></div>}
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--ev-page) 72%, transparent), color-mix(in oklab, var(--ev-page) 90%, transparent))" }} />
      {inner(false)}
    </section>
  );
}

function Footer({ e, church, url, share, nav }: { e: ChurchEvent; church: ChurchInfo; url: string; share: string; nav: { id: string; label: string }[] }) {
  const c = e.contact;
  const wa = c?.whatsapp ? digits(c.whatsapp).replace(/^0/, "234") : undefined;
  const p = church.profile;
  return (
    <footer className="mt-24 border-t border-[var(--ev-line)] pb-32 pt-16 lg:pb-14">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 md:grid-cols-12 md:px-10">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3"><ChurchMark church={{ name: church.name, profile: church.profile as ChurchProfile }} size={42} /><span className="text-[20px] font-bold tracking-tight">{church.name}</span></div>
          <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-[var(--ev-muted)]">{[p?.address, p?.city].filter(Boolean).join(", ") || placeOf(e)}. {c?.name ? `${c.name} will help with anything you need.` : "Questions? We're happy to help."}</p>
        </div>
        <div className="md:col-span-3">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[.2em] text-[var(--ev-muted)]">{e.title.split(":")[0]}</p>
          <ul className="space-y-2 text-[14.5px]">{nav.map((x) => <li key={x.id}><a href={`#${x.id}`} className="ev-ul">{x.label}</a></li>)}</ul>
        </div>
        <div className="md:col-span-4">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[.2em] text-[var(--ev-muted)]">Talk to us</p>
          <ul className="space-y-2 text-[14.5px]">
            {c?.phone && <li><a href={`tel:${c.phone}`} className="ev-ul inline-flex items-center gap-2"><Phone size={14} /> {c.phone}</a></li>}
            {wa && <li><a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hello, I have a question about ${e.title}.`)}`} target="_blank" rel="noreferrer" className="ev-ul inline-flex items-center gap-2"><WhatsAppIcon size={14} /> WhatsApp</a></li>}
            {c?.email && <li><a href={`mailto:${c.email}`} className="ev-ul inline-flex items-center gap-2"><Mail size={14} /> {c.email}</a></li>}
            {url && <li><button type="button" onClick={() => icsFile(e, church.name, url)} className="ev-ul inline-flex items-center gap-2"><CalendarPlus size={14} /> Add to calendar</button></li>}
            {(!e.page || e.page.share === false) && url && <li><a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" className="ev-ul inline-flex items-center gap-2"><Share2 size={14} /> Invite a friend</a></li>}
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-14 flex max-w-[1240px] flex-col gap-2 border-t border-[var(--ev-line)] px-5 pt-6 text-[13px] text-[var(--ev-muted)] sm:flex-row sm:justify-between md:px-10">
        <span>© {new Date(e.start).getFullYear()} {church.name}</span><span>Made with <b className="text-[var(--ev-fg)]">Traqi</b></span><a href="#top" className="ev-ul">Back to top ↑</a>
      </div>
    </footer>
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

