"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, MapPin, QrCode, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { eventPage, registerEvent, venueCheckin, venueFind } from "@/lib/live";
import { ChurchMark, COVERS } from "./brand";
import { Confetti, cx } from "./ui";
import { usePublicTheme } from "./theme";
import { EV_CSS, RegisterPanel, TicketCard, eventVars, evCard, whenLine, type MemberFlow, type RegInput, type RegResult, type RegTicket } from "./event-landing";
import { useDemoRegister } from "./event-page";
import { useMemberFlow } from "./public-event";
import { codeOk, headline, lookOf, maskName } from "@/lib/event-page";
import { digits, todayLagos } from "@/lib/format";
import type { ChurchEvent, ChurchProfile } from "@/lib/types";

type Info = { church: { name: string; slug: string; profile: Partial<ChurchProfile> }; event: ChurchEvent };
type Step = "who" | "isit" | "register" | "in" | "bad-code" | "closed";

/**
 * Check-in at the venue (round 8): scan the code at the venue, type your phone or email, tap "Yes, that's me".
 * Not registered? Register now, and you're registered and checked in at once, with your ticket on the same screen.
 * Works only with the venue's code, during event hours.
 */
export function VenueCheckin({ church, event }: { church: string; event: string }) {
  const { ready, mode, state, put } = useStore();
  const demoRegister = useDemoRegister();
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("who");
  const [who, setWho] = useState("");
  const [masked, setMasked] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<RegTicket[]>([]);
  const [already, setAlready] = useState(false);
  const [wasMember, setWasMember] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const k = q.get("k") ?? (() => { try { return sessionStorage.getItem(`traqi-venue:${event}`); } catch { return null; } })() ?? "";
    setCode(k);
    try { if (k) sessionStorage.setItem(`traqi-venue:${event}`, k); } catch { /* storage unavailable */ }
    // Back from Google: straight to the registration form
    if (q.get("member")) setStep("register");
  }, [event]);
  useEffect(() => { if (mode === "live") eventPage(church, event).then((x) => setInfo(x as Info | null)).catch(() => setInfo(null)); }, [mode, church, event]);
  const demoE = state.events.find((x) => x.slug === event && x.status === "published");
  const data: Info | null | undefined = mode === "live" ? info : demoE ? { church: { name: state.church.name, slug: state.church.slug, profile: state.church.profile ?? {} }, event: demoE } : null;
  usePublicTheme(data?.church.profile);
  const baseMember = useMemberFlow(church, event, `/${church}/${event}/here?k=${encodeURIComponent(code)}&member=1`);

  // Demo: the code is checked here, as the database does it live
  const demoGate = (): Step | null => {
    if (!demoE) return "bad-code";
    const ok = codeOk(demoE, code);
    return ok === "ok" ? null : ok === "closed" ? "closed" : "bad-code";
  };
  const demoReg = (v: string) => {
    const t = v.trim().toLowerCase(), d = digits(v).slice(-10);
    return state.registrations.filter((r) => r.eventId === demoE?.id).sort((a, b) => Number(!!a.byRegId) - Number(!!b.byRegId))
      .find((r) => (t.includes("@") ? r.email?.toLowerCase() === t : d.length >= 10 && (digits(r.phone).slice(-10) === d || digits(r.altPhone ?? "").slice(-10) === d)));
  };
  /** Check someone in for today; returns their ticket. */
  const checkIn = async (v: string): Promise<{ status: string; t?: RegTicket }> => {
    if (mode === "live") {
      const r = await venueCheckin(church, event, code, v);
      return { status: r.status, t: r.ticket ? { name: r.name ?? "", ticket: r.ticket, status: r.ticketStatus ?? "confirmed", category: r.category } : undefined };
    }
    const g = demoGate(); if (g) return { status: g };
    const r = demoReg(v);
    if (!r) return { status: "not-found" };
    const day = todayLagos();
    const inn = r.checkins.includes(day);
    if (!inn && r.status === "confirmed") put("registrations", { ...r, checkins: [...r.checkins, day], checkinLog: [...(r.checkinLog ?? []), { day, at: new Date().toISOString(), via: "self" }] }, `${r.name} checked in at the venue`);
    return { status: r.status !== "confirmed" ? "not-confirmed" : inn ? "already" : "in", t: { name: r.name, ticket: r.ticket, status: r.status, category: r.category } };
  };

  const find = async () => {
    setErr("");
    const v = who.trim();
    if (!v.includes("@") && digits(v).length < 10) return setErr("Enter your phone number or email.");
    setBusy(true);
    try {
      if (mode === "live") {
        const r = await venueFind(church, event, code, v);
        if (r.status === "found") { setMasked(r.name ?? ""); setStep("isit"); }
        else if (r.status === "not-found") setErr("We couldn't find a registration with that. Check it, or register now below.");
        else if (r.status === "closed") setStep("closed");
        else setStep("bad-code");
      } else {
        const g = demoGate(); if (g) { setStep(g); return; }
        const r = demoReg(v);
        if (r) { setMasked(maskName(r.name)); setStep("isit"); } else setErr("We couldn't find a registration with that. Check it, or register now below.");
      }
    } catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };
  const yes = async () => {
    setBusy(true); setErr("");
    try {
      const r = await checkIn(who.trim());
      if (r.status === "closed" || r.status === "bad-code") { setStep(r.status); return; }
      if (r.status === "not-confirmed") { setErr("Your registration isn't confirmed yet, so you can't check in here. Please see the registration desk."); return; }
      if (!r.t) { setErr("We couldn't find your registration. Please see the registration desk."); return; }
      setTickets([r.t]); setAlready(r.status === "already"); setStep("in");
    } catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  // Register now: registered and checked in at once
  const afterRegister = async (r: RegResult, phone: string, member: boolean): Promise<RegResult> => {
    if (r.status === "confirmed" || r.status === "already") { try { await checkIn(phone); } catch { /* the ticket still shows; the door can check them in */ } }
    setWasMember(member);
    return r;
  };
  const onRegister = async (r: RegInput) => afterRegister(mode === "live" ? (await registerEvent(church, event, r as unknown as Record<string, unknown>)) as RegResult : await demoRegister(demoE!, r), r.phone, false);
  const member = useMemo<MemberFlow | undefined>(() => baseMember && { ...baseMember, register: async (r) => afterRegister(await baseMember.register(r), r.phone, true) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseMember, code]);

  if (!ready || data === undefined) return <div className="skeleton h-screen rounded-none" />;
  if (!data) return <div className="flex min-h-screen items-center justify-center p-6 text-center"><p className="font-display text-2xl font-semibold">Event not found</p></div>;
  const { church: c, event: e } = data;
  const m = headline(e);
  const pic = m.kind === "carousel" ? m.slides[0] : m.kind === "video" ? m.poster : m.src;
  const H = "ev-d";
  const url = typeof window !== "undefined" ? `${location.origin}/${c.slug}/${e.slug}` : "";
  const first = (n: string) => n.split(" ")[0];

  return (
    <div className="ev min-h-screen bg-[var(--ev-page)] text-[var(--ev-fg)]" data-look={lookOf(e)} style={eventVars(e, c.profile.color ?? "#4f46e5")}>
      <style>{EV_CSS}</style>
      <header className="mx-auto flex max-w-xl items-center gap-3 px-4 py-4">
        <ChurchMark church={{ name: c.name, profile: c.profile as ChurchProfile }} size={36} />
        <span className="min-w-0 truncate font-semibold">{c.name}</span>
      </header>
      <main className="mx-auto max-w-xl space-y-4 px-4 pb-16">
        <div className="flex items-center gap-4">
          {pic ? <img src={pic} alt="" className="aspect-[4/5] w-20 shrink-0 rounded-2xl object-cover shadow-xl" /> : <div className="aspect-[4/5] w-20 shrink-0 rounded-2xl shadow-xl" style={{ background: COVERS[e.cover % COVERS.length] }} />}
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold uppercase tracking-[.18em] text-[var(--ev-icon)]">Check in</p>
            <h1 className={cx(H, "text-[26px] font-bold leading-tight")}>{e.title}</h1>
            <p className="text-[13.5px] text-[var(--ev-muted)]">{whenLine(e)}</p>
          </div>
        </div>

        {step === "bad-code" && (
          <div className={cx(evCard, "p-6 text-center")}>
            <QrCode size={34} className="mx-auto text-[var(--ev-icon)]" />
            <p className={cx(H, "mt-3 text-[22px] font-semibold")}>Scan the code at the venue</p>
            <p className="mt-1 text-[14.5px] text-[var(--ev-muted)]">Check-in here works with the code at {e.title}. Scan it again, or ask an usher.</p>
          </div>
        )}
        {step === "closed" && (
          <div className={cx(evCard, "p-6 text-center")}>
            <MapPin size={34} className="mx-auto text-[var(--ev-icon)]" />
            <p className={cx(H, "mt-3 text-[22px] font-semibold")}>Check-in opens during the event</p>
            <p className="mt-1 text-[14.5px] text-[var(--ev-muted)]">From an hour before it starts until it ends. See you then!</p>
          </div>
        )}

        {step === "who" && (
          <div className={cx(evCard, "space-y-4 p-5 md:p-6")}>
            <p className={cx(H, "text-[22px] font-semibold")}>Welcome! Let&apos;s check you in.</p>
            <label className="block"><span className="mb-1.5 block text-[14px] font-medium">Your phone number or email</span>
              <input autoFocus className="w-full rounded-xl bg-[var(--ev-page)] px-3.5 py-3 text-[16px] text-[var(--ev-fg)] ring-1 ring-[var(--ev-line)] outline-none focus:ring-2 focus:ring-[var(--ev-accent)]" inputMode="email" autoComplete="email"
                value={who} onChange={(x) => { setWho(x.target.value); setErr(""); }} onKeyDown={(x) => { if (x.key === "Enter") void find(); }} placeholder="0803 123 4567 or you@email.com" />
            </label>
            {err && <p className="rounded-xl px-3 py-2 text-[14px] text-[#be123c]" style={{ background: "#ffe4e6" }} role="alert">{err}</p>}
            <button type="button" disabled={busy} onClick={() => void find()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ev-accent)] py-3.5 text-[16px] font-semibold text-[var(--ev-on-accent)] shadow-lg disabled:opacity-60">{busy ? "Looking…" : "Continue"} <ArrowRight size={17} /></button>
            <button type="button" onClick={() => setStep("register")} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-semibold ring-1 ring-[var(--ev-line)]"><UserPlus size={17} /> Not registered? Register now</button>
          </div>
        )}

        {step === "isit" && (
          <div className={cx(evCard, "space-y-4 p-6 text-center")}>
            <p className="text-[14.5px] text-[var(--ev-muted)]">Is this you?</p>
            <p className={cx(H, "text-[32px] font-bold")}>{masked}</p>
            {err && <p className="rounded-xl px-3 py-2 text-[14px] text-[#be123c]" style={{ background: "#ffe4e6" }} role="alert">{err}</p>}
            <button type="button" disabled={busy} onClick={() => void yes()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ev-accent)] py-3.5 text-[16px] font-semibold text-[var(--ev-on-accent)] shadow-lg disabled:opacity-60"><Check size={18} /> {busy ? "Checking you in…" : "Yes, that's me"}</button>
            <button type="button" onClick={() => { setStep("who"); setWho(""); setErr(""); }} className="w-full rounded-2xl py-3 text-[15px] font-semibold ring-1 ring-[var(--ev-line)]">No, that&apos;s not me</button>
          </div>
        )}

        {step === "in" && (
          <div className="space-y-3">
            <Confetti show={!already} />
            <div className={cx(evCard, "p-6 text-center")}>
              <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--ev-accent)] text-[var(--ev-on-accent)]"><Check size={32} /></span>
              <p className={cx(H, "mt-4 text-[26px] font-bold")}>{already ? "You're already checked in" : `You're checked in, ${first(tickets[0]?.name ?? "")}!`}</p>
              <p className="mt-1 text-[14.5px] text-[var(--ev-muted)]">Enjoy {e.title}. Your ticket is below.</p>
            </div>
            {tickets.map((t) => <TicketCard key={t.ticket} e={e} church={c} url={url} t={t} />)}
          </div>
        )}

        {step === "register" && (
          <>
            <div className={cx(evCard, "flex items-center gap-3 p-4 text-[14px]")}><Check size={18} className="shrink-0 text-[var(--ev-icon)]" /> Register now and you&apos;ll be checked in at the same time.</div>
            <RegisterPanel e={e} church={c} url={url} closed={false} full={false} onRegister={onRegister} member={member} H={H} checkedIn venueCode={code} />
            {wasMember === false && <button type="button" onClick={() => setStep("who")} className="w-full p-2 text-center text-[14px] text-[var(--ev-muted)]">Already registered? Check in with your phone or email</button>}
          </>
        )}
      </main>
    </div>
  );
}
