"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, ChevronDown, Clock, Mail, MapPin, Navigation, Phone, Radio, Ticket, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { churchPage, type PublicChurch } from "@/lib/live";
import { ChurchMark, COVERS } from "./brand";
import { WhatsAppIcon } from "./care";
import { usePublicTheme } from "./theme";
import { cx } from "./ui";
import { eventWhen } from "./event-page";
import { headline } from "@/lib/event-page";
import { eventPath, isLiveNow } from "@/lib/events";
import { WEEKDAYS } from "@/lib/domain";
import { digits } from "@/lib/format";

const fmt = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/** Google's "G". */
function G() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>;
}

/** One full-screen slide that fades and rises in as it scrolls into view. */
function Slide({ id, children, className, onSeen }: { id: string; children: ReactNode; className?: string; onSeen: (id: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setIn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([x]) => { if (x.isIntersecting) { setIn(true); onSeen(id); } }, { threshold: 0.5 });
    io.observe(el); return () => io.disconnect();
  }, [id, onSeen]);
  return (
    <section ref={ref} id={id} className={cx("relative flex min-h-[100svh] snap-start snap-always items-center px-5 py-20", className)}>
      <div className={cx("mx-auto w-full max-w-5xl transition duration-[900ms] ease-out motion-reduce:transition-none", inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0")}>{children}</div>
    </section>
  );
}

/**
 * The church's page, traqi.church/{church} (round 8): a scroll presentation in the church's colours.
 * Welcome → New here or already a member → events → about → service times, address and contact.
 */
export function ChurchPresentation({ slug }: { slug: string }) {
  const { ready, mode, state } = useStore();
  const [live, setLive] = useState<PublicChurch | null | undefined>(undefined);
  const [seen, setSeen] = useState("welcome");
  useEffect(() => { if (mode === "live") churchPage(slug).then(setLive).catch(() => setLive(null)); }, [mode, slug]);
  const demo = slug === state.church.slug || slug === "demo";
  const c: PublicChurch | null | undefined = mode === "live" ? live
    : demo ? { name: state.church.name, slug: state.church.slug, profile: state.church.profile ?? {}, events: state.events.filter((e) => e.status === "published" && Date.parse(e.end) > Date.now()) } : null;
  usePublicTheme(c?.profile);
  if (!ready || c === undefined) return <div className="h-screen bg-[#0b0a14]" />;
  if (!c) return <div className="flex min-h-screen items-center justify-center p-6 text-center"><div><p className="font-display text-2xl font-semibold">Church not found</p><Link href="/" className="mt-3 inline-block text-brand">Go to Traqi</Link></div></div>;

  const p = c.profile;
  const color = p.color ?? "#4f46e5";
  const accent = p.accent ?? "#f5b544";
  const services = (p.services ?? []).slice().sort((a, b) => a.weekdays[0] - b.weekdays[0] || a.start.localeCompare(b.start));
  const events = c.events.slice().sort((a, b) => a.start.localeCompare(b.start)).slice(0, 6);
  const about = p.about?.trim() || "";
  const wa = p.whatsapp && !/^https?:/.test(p.whatsapp) ? `https://wa.me/${digits(p.whatsapp).replace(/^0/, "234")}` : p.whatsapp;
  const short = c.name.split(/[,(]/)[0].trim();
  const slides = ["welcome", "start", ...(events.length ? ["events"] : []), ...(about || p.welcome ? ["about"] : []), "visit"];
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const btn = "inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[16px] font-semibold transition hover:-translate-y-0.5";

  return (
    <div className="h-[100svh] snap-y snap-mandatory overflow-y-auto overscroll-none text-white [scrollbar-width:none]"
      style={{ background: `radial-gradient(1100px 700px at 100% 0%, ${color}cc, transparent 65%), radial-gradient(900px 600px at 0% 100%, ${accent}40, transparent 65%), #0b0a14`, backgroundAttachment: "fixed" }}>
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 px-5 py-4">
        <ChurchMark church={{ name: c.name, profile: p as never }} size={36} className="ring-2 ring-white/20" />
        <span className="min-w-0 truncate font-semibold">{c.name}</span>
        <Link href={`/join?church=${c.slug}`} className="ml-auto rounded-full bg-white/12 px-4 py-2 text-[14px] font-medium backdrop-blur hover:bg-white/20">Log in</Link>
      </header>
      {/* Progress dots */}
      <nav className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 md:flex" aria-label="Slides">
        {slides.map((id) => <button key={id} type="button" onClick={() => go(id)} aria-label={id} className={cx("w-2 rounded-full bg-white transition-all", seen === id ? "h-7" : "h-2 opacity-40 hover:opacity-80")} />)}
      </nav>

      {/* 1. Welcome */}
      <Slide id="welcome" onSeen={setSeen}>
        <div className="text-center">
          <ChurchMark church={{ name: c.name, profile: p as never }} size={104} className="mx-auto shadow-2xl ring-4 ring-white/15" />
          <p className="mt-8 text-[14px] font-semibold uppercase tracking-[.3em] text-white/70">Welcome to</p>
          <h1 className="mx-auto mt-3 max-w-4xl font-display text-[clamp(44px,10vw,104px)] font-semibold leading-[.98] tracking-tight">{c.name}</h1>
          <p className="mt-5 text-[18px] text-white/75">on Traqi{p.city ? ` · ${p.city}` : ""}</p>
          {p.liveStream && events.some((e) => isLiveNow(e)) && <a href={p.liveStream} target="_blank" rel="noreferrer" className={cx(btn, "mt-8 bg-[#e11d48] text-white")}><Radio size={18} /> Watch live now</a>}
        </div>
        <button type="button" onClick={() => go("start")} className="absolute inset-x-0 bottom-8 mx-auto flex w-fit flex-col items-center gap-1 text-[13px] text-white/60" aria-label="Scroll down">Scroll<ChevronDown size={20} className="animate-bounce" /></button>
      </Slide>

      {/* 2. New here, or already a member */}
      <Slide id="start" onSeen={setSeen}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[32px] bg-white/[.07] p-8 ring-1 ring-white/12 backdrop-blur md:p-10">
            <UserPlus size={30} style={{ color: accent }} />
            <h2 className="mt-6 font-display text-[clamp(30px,5vw,46px)] font-semibold leading-tight tracking-tight">New to {short}?</h2>
            <p className="mt-3 text-[17px] text-white/75">We&apos;re so glad you&apos;re here. Tell us a little about you. It takes 30 seconds.</p>
            <Link href={`/welcome?church=${c.slug}`} className={cx(btn, "mt-8 w-full bg-white text-[#111] sm:w-auto")}>Say hello <ArrowRight size={18} /></Link>
          </div>
          <div className="rounded-[32px] p-8 ring-1 ring-white/12 md:p-10" style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}>
            <Ticket size={30} className="text-white/90" />
            <h2 className="mt-6 font-display text-[clamp(30px,5vw,46px)] font-semibold leading-tight tracking-tight">Already a member?</h2>
            <p className="mt-3 text-[17px] text-white/85">Open your Traqi: your department, classes, events and tickets in one place.</p>
            <Link href={`/join?church=${c.slug}`} className={cx(btn, "mt-8 w-full bg-white text-[#1f1f1f] sm:w-auto")}><G /> Continue with Google</Link>
          </div>
        </div>
      </Slide>

      {/* 3. Events */}
      {events.length > 0 && (
        <Slide id="events" onSeen={setSeen}>
          <p className="text-[13px] font-semibold uppercase tracking-[.25em]" style={{ color: accent }}>Coming up</p>
          <h2 className="mt-2 font-display text-[clamp(34px,6vw,60px)] font-semibold leading-tight tracking-tight">Have you registered?</h2>
          <div className="-mx-5 mt-8 flex snap-x gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:none]">
            {events.map((e) => {
              const m = headline(e);
              const pic = m.kind === "carousel" ? m.slides[0] : m.kind === "video" ? m.poster : m.src;
              const on = isLiveNow(e);
              return (
                <Link key={e.id} href={eventPath(c.slug, e)} className="group w-[78%] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-[28px] bg-white/[.07] ring-1 ring-white/12 transition hover:-translate-y-1 sm:w-[300px]">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    {pic ? <img src={pic} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : <div className="h-full w-full" style={{ background: COVERS[e.cover % COVERS.length] }} />}
                    <span className={cx("absolute left-3 top-3 rounded-full px-3 py-1 text-[12px] font-semibold backdrop-blur", on ? "bg-[#e11d48]" : "bg-black/55")}>{on ? "Happening now" : "Upcoming"}</span>
                  </div>
                  <div className="p-5">
                    <p className="flex items-center gap-1.5 text-[13px] text-white/70"><CalendarDays size={14} /> {eventWhen(e)}</p>
                    <p className="mt-1 font-display text-[21px] font-semibold leading-tight">{e.title}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: accent }}>{e.registration === false ? "See details" : "Register"} <ArrowRight size={15} /></span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Slide>
      )}

      {/* 4. About */}
      {(about || p.welcome) && (
        <Slide id="about" onSeen={setSeen}>
          <div className={cx("grid items-center gap-10", p.buildingPhoto && "md:grid-cols-[1.1fr_.9fr]")}>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[.25em]" style={{ color: accent }}>About {short}</p>
              {about && <p className="mt-4 whitespace-pre-line font-display text-[clamp(22px,3.2vw,34px)] leading-snug tracking-tight">{about}</p>}
              {p.welcome && (
                <blockquote className={cx("whitespace-pre-line text-white/80", about ? "mt-8 border-l-2 pl-5 text-[17px] leading-relaxed" : "mt-4 font-display text-[clamp(22px,3.2vw,34px)] leading-snug tracking-tight")} style={about ? { borderColor: accent } : undefined}>
                  {p.welcome}{about && <span className="mt-2 block text-[13px] font-semibold uppercase tracking-[.18em] text-white/55">From our pastor</span>}
                </blockquote>
              )}
            </div>
            {p.buildingPhoto && <img src={p.buildingPhoto} alt="" className="w-full rounded-[32px] object-cover shadow-2xl ring-1 ring-white/10" />}
          </div>
        </Slide>
      )}

      {/* 5. Service times, address and contact */}
      <Slide id="visit" onSeen={setSeen}>
        <p className="text-[13px] font-semibold uppercase tracking-[.25em]" style={{ color: accent }}>Come and visit</p>
        <h2 className="mt-2 font-display text-[clamp(34px,6vw,60px)] font-semibold leading-tight tracking-tight">We&apos;d love to see you.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] bg-white/[.07] p-6 ring-1 ring-white/12">
            <p className="flex items-center gap-2 font-semibold"><Clock size={18} style={{ color: accent }} /> Service times</p>
            {services.length ? (
              <ul className="mt-4 divide-y divide-white/10">{services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <span><b className="block font-semibold">{s.name}</b><span className="text-[13px] text-white/60">{s.weekdays.length > 3 ? `${WEEKDAYS[s.weekdays[0]]} to ${WEEKDAYS[s.weekdays.at(-1)!]}` : s.weekdays.map((d) => WEEKDAYS[d]).join(", ")}</span></span>
                  <span className="num text-[17px] font-semibold">{fmt(s.start)}</span>
                </li>
              ))}</ul>
            ) : <p className="mt-3 text-white/70">Ask us for our service times.</p>}
          </div>
          <div className="space-y-4 rounded-[28px] bg-white/[.07] p-6 ring-1 ring-white/12">
            {p.address && (
              <div className="flex gap-3"><MapPin size={19} className="mt-0.5 shrink-0" style={{ color: accent }} />
                <div><p>{[p.address, p.city, p.state].filter(Boolean).join(", ")}</p>{p.directions && <p className="mt-1 text-[14px] text-white/65">{p.directions}</p>}
                  <a target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[14px] font-semibold text-[#111]"
                    href={p.pin ? `https://www.google.com/maps/dir/?api=1&destination=${p.pin.lat},${p.pin.lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([p.address, p.city].filter(Boolean).join(", "))}`}><Navigation size={15} /> Directions</a></div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {p.phone && <a href={`tel:${p.phone}`} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[14px] font-medium ring-1 ring-white/20 hover:bg-white/10"><Phone size={15} /> {p.phone}</a>}
              {p.email && <a href={`mailto:${p.email}`} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[14px] font-medium ring-1 ring-white/20 hover:bg-white/10"><Mail size={15} /> Email</a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-3.5 py-2 text-[14px] font-medium text-white"><WhatsAppIcon size={15} /> WhatsApp</a>}
              {p.liveStream && <a href={p.liveStream} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[14px] font-medium ring-1 ring-white/20 hover:bg-white/10"><Radio size={15} /> Watch online</a>}
            </div>
            {p.socials && Object.values(p.socials).some(Boolean) && (
              <div className="flex flex-wrap gap-3 text-[14px] text-white/70">{(Object.entries(p.socials) as [string, string | undefined][]).filter(([, v]) => v).map(([k, v]) => (
                <a key={k} href={/^https?:/.test(v!) ? v : `https://${k === "x" ? "x.com" : `${k}.com`}/${v!.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="capitalize hover:text-white">{k === "x" ? "X" : k}</a>
              ))}</div>
            )}
          </div>
        </div>
        <p className="mt-12 text-center text-[13px] text-white/45">Powered by <b className="font-semibold text-white/70">Traqi</b></p>
      </Slide>
    </div>
  );
}
