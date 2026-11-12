"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Globe, HeartHandshake, MapPin, PartyPopper, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { checkinLive, churchPage, welcomeCustom, welcomeV2, type PublicChurch } from "@/lib/live";
import { CustomFieldInput } from "./custom-fields";
import { usePublicTheme } from "./theme";
import { openMeeting, record } from "@/lib/domain";
import { digits, timeOf } from "@/lib/format";
import { Button, Confetti, Field, cx, inputCls } from "./ui";
import { ChurchMark } from "./brand";
import { Consent } from "./public";
import type { Feedback } from "@/lib/types";

const HEARD = ["A friend or family member", "Social media", "I walked in", "Outreach", "Online church", "Other"];
const ENJOYED = ["Worship", "The Word", "Prayer", "The welcome", "Children's church", "The atmosphere", "Other"];

type Step = "phone" | "new" | "done" | "feedback" | "thanks" | "closed";
type Remembered = { phone: string; name: string }[];

/**
 * One flow for everyone who walks in: members check in with the service code,
 * first-timers fill in their details, and after service they tell us about the day.
 * A phone number never reveals what's stored; this device remembers only what was typed on it.
 */
export function CheckinFlow({ slug, startNew = false }: { slug: string; startNew?: boolean }) {
  const { ready, mode, state, findByPhone, addFirstTimer, updatePerson, put, newId, moveCase } = useStore();
  const [live, setLive] = useState<PublicChurch | null | undefined>(undefined);
  useEffect(() => { if (mode === "live") churchPage(slug).then(setLive).catch(() => setLive(null)); }, [mode, slug]);

  const church = mode === "live" ? live : { name: state.church.name, slug: state.church.slug, profile: state.church.profile ?? {}, events: state.events };
  const meeting = mode === "demo" ? openMeeting(state.meetings) : undefined;
  const key = `traqi-device-${slug || "demo"}`;
  const [saved, setSaved] = useState<Remembered>([]);
  useEffect(() => { try { setSaved(JSON.parse(localStorage.getItem(key) || "[]")); } catch { /* storage unavailable */ } }, [key]);
  const remember = (phone: string, name: string) => {
    const next = [{ phone, name }, ...saved.filter((s) => digits(s.phone) !== digits(phone))].slice(0, 6);
    setSaved(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  const [step, setStep] = useState<Step>(startNew ? "new" : "phone");
  const [who, setWho] = useState<{ phone: string; name: string } | null>(null);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<"in" | "already" | "new" | "back">("in");
  const [f, setF] = useState({ firstName: "", lastName: "", gender: "" as "" | "M" | "F" });
  const [agree, setAgree] = useState(false);
  const [fb, setFb] = useState({ location: "", heard: "", enjoyed: [] as string[], comment: "", wantsVisit: false, prayer: "" });
  const [extra, setExtra] = useState<Record<string, string>>({});

  useEffect(() => { if (saved[0] && !who && !startNew) setWho(saved[0]); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const activePhone = who?.phone ?? phone;
  const color = church?.profile?.color ?? "#4f46e5";

  if (!ready || (mode === "live" && live === undefined)) return <Frame color={color}><div className="skeleton h-80 rounded-3xl" /></Frame>;
  if (!church) return <Frame color={color}><Card><h1 className="font-display text-2xl font-semibold">This link isn&apos;t complete</h1><p className="mt-2 text-ink-soft">Please scan the code shown in church again, or ask an usher for help.</p></Card></Frame>;

  const checkIn = async () => {
    setErr("");
    if (digits(activePhone).length < 10) return setErr("Please enter your phone number.");
    if (!startNew && code.trim().length < 4) return setErr("Enter the 4-digit code shown on the screen.");
    setBusy(true);
    try {
      if (mode === "live") {
        const r = await checkinLive(slug, code.trim(), activePhone);
        if (r.status === "bad-code") { setErr("That code doesn't match. Check the screen and try again."); return; }
        if (r.status === "no-meeting") { setStep("closed"); return; }
        if (r.status === "not-found") { setStep("new"); return; }
        setResult(r.status === "already" ? "already" : "in");
      } else {
        if (!meeting) { setStep("closed"); return; }
        if (meeting.code && meeting.code !== code.trim()) { setErr("That code doesn't match. Check the screen and try again."); return; }
        const p = findByPhone(activePhone);
        if (!p) { setStep("new"); return; }
        if (state.attendance.some((a) => a.meetingId === meeting.id && a.personId === p.id)) setResult("already");
        else {
          put("attendance", record(meeting.id, p.id, online ? "online" : "link", newId("at")));
          // A first-timer from an earlier day is now returning
          if (p.stage === "first_timer" && p.firstVisit < new Date().toISOString().slice(0, 10)) {
            const c = state.cases.find((x) => x.personId === p.id && ["new", "contacted", "visited"].includes(x.stage));
            if (c) moveCase(c.id, "returned");
            setResult("back");
          } else setResult("in");
        }
      }
      if (!saved.some((s) => digits(s.phone) === digits(activePhone))) remember(activePhone, who?.name ?? "");
      setStep("done");
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const join = async () => {
    setErr("");
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("Please enter your first and last name.");
    if (!f.gender) return setErr("Please choose male or female.");
    if (digits(activePhone).length < 10) return setErr("Please enter your phone number, at least 10 digits.");
    if (!agree) return setErr("Please tick the box so we can keep in touch.");
    setBusy(true);
    try {
      if (mode === "live") {
        const r = await welcomeV2(slug, { firstName: f.firstName.trim(), lastName: f.lastName.trim(), gender: f.gender, phone: activePhone, consent: true });
        setResult(r.status === "new" ? "new" : "back");
      } else {
        const known = findByPhone(activePhone);
        if (known) setResult("back");
        else {
          const id = addFirstTimer({ firstName: f.firstName.trim(), lastName: f.lastName.trim(), gender: f.gender, phone: activePhone.trim(), consent: { at: new Date().toISOString(), via: "welcome-form" } });
          if (meeting) put("attendance", record(meeting.id, id, "welcome", newId("at")));
          setResult("new");
        }
      }
      remember(activePhone, f.firstName.trim());
      setWho({ phone: activePhone, name: f.firstName.trim() });
      setStep("done");
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  const sendFeedback = async () => {
    const feedback: Feedback = { enjoyed: fb.enjoyed, comment: fb.comment.trim() || undefined, wantsVisit: fb.wantsVisit, prayer: fb.prayer.trim() || undefined, meetingId: meeting?.id, at: new Date().toISOString() };
    setBusy(true);
    try {
      const answers = Object.fromEntries(Object.entries(extra).filter(([, v]) => v.trim()));
      if (mode === "live") {
        await welcomeV2(slug, { phone: activePhone, location: fb.location, heardFrom: fb.heard, feedback });
        if (Object.keys(answers).length) await welcomeCustom(slug, activePhone, answers);
      } else {
        const p = findByPhone(activePhone);
        if (p) updatePerson(p.id, { location: p.location ?? (fb.location.trim() || undefined), heardFrom: p.heardFrom ?? (fb.heard || undefined), feedback: [...(p.feedback ?? []), feedback], custom: { ...p.custom, ...answers } }, "self");
      }
      setStep("thanks");
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  const reset = (another: boolean) => { setWho(another ? null : who); setPhone(""); setCode(""); setF({ firstName: "", lastName: "", gender: "" }); setAgree(false); setErr(""); setStep(another ? "phone" : step); };
  const isNewcomer = result === "new" || result === "back";

  return (
    <Frame color={color} church={church}>
      {step === "closed" && (
        <Card>
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-glow-soft text-glow-ink"><HeartHandshake size={26} /></div>
          <h1 className="text-center font-display text-2xl font-semibold">Check-in isn&apos;t open right now</h1>
          <p className="mt-2 text-center text-ink-soft">It opens 30 minutes before each service and closes when the service ends. We&apos;d love to see you then.</p>
          {who && <Button variant="primary" className="mt-5 w-full" onClick={() => setStep("feedback")}>Tell us about today <ArrowRight size={16} /></Button>}
          <Button className="mt-2 w-full" onClick={() => setStep("new")}><UserPlus size={16} /> I&apos;m new: share my details</Button>
        </Card>
      )}

      {step === "phone" && (
        <Card>
          <p className="text-[13px] font-medium uppercase tracking-wider text-muted">{meeting ? `${meeting.name} · ${timeOf(meeting.start)}` : "Check in"}</p>
          <h1 className="mt-1 font-display text-[30px] font-semibold leading-tight tracking-tight">{who?.name ? `Welcome, ${who.name}!` : who ? "Welcome back!" : "Good to see you!"}</h1>
          <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void checkIn(); }}>
            <Field label="Service code" hint="The four numbers on the screen.">
              <input className={cx(inputCls, "num h-16 text-center text-[32px] font-semibold tracking-[.4em]")} inputMode="numeric" maxLength={4} autoFocus value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setErr(""); }} placeholder="••••" aria-label="Service code" />
            </Field>
            {who ? (
              <div className="flex items-center justify-between rounded-2xl bg-page px-4 py-3 ring-1 ring-line text-sm">
                <span>Checking in {who.name || "on this phone"} · ending {digits(who.phone).slice(-4)}</span>
                <button type="button" onClick={() => setWho(null)} className="font-medium text-brand">Not you?</button>
              </div>
            ) : (
              <Field label="Your phone number"><input className={inputCls} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setErr(""); }} placeholder="0803 123 4567" /></Field>
            )}
            {saved.length > 1 && !who && (
              <div className="flex flex-wrap gap-1.5">{saved.map((s) => <button type="button" key={s.phone} onClick={() => setWho(s)} className="rounded-full bg-page px-3 py-1.5 text-[13px] ring-1 ring-line">{s.name || `…${digits(s.phone).slice(-4)}`}</button>)}</div>
            )}
            {(!meeting || meeting.mode !== "physical") && (
              <label className="flex items-center gap-3 rounded-2xl bg-page px-4 py-3 text-sm ring-1 ring-line">
                <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="size-5 accent-brand" /><Globe size={16} className="text-muted" /> I&apos;m joining online
              </label>
            )}
            {err && <p className="text-sm text-alert" role="alert">{err}</p>}
            <Button variant="primary" type="submit" disabled={busy} className="h-13 w-full py-3.5 text-[16px]">{busy ? "Checking in…" : "Check me in"} <ArrowRight size={17} /></Button>
          </form>
          <button onClick={() => setStep("new")} className="mt-4 w-full rounded-2xl p-3 text-center text-[14.5px] text-ink-soft hover:bg-page">First time here? <b className="text-brand">Say hello</b></button>
        </Card>
      )}

      {step === "new" && (
        <Card>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Welcome! We&apos;re so glad you came.</h1>
          <p className="mt-1.5 text-ink-soft">Just your name and number for now. It takes 30 seconds.</p>
          <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void join(); }}>
            <Field label="Phone number" hint="For a call or WhatsApp message from us."><input className={inputCls} autoFocus={!activePhone} inputMode="tel" autoComplete="tel" value={activePhone} onChange={(e) => { setPhone(e.target.value); setWho(null); setErr(""); }} placeholder="0803 123 4567" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name"><input className={inputCls} autoComplete="given-name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} placeholder="Adaeze" /></Field>
              <Field label="Last name"><input className={inputCls} autoComplete="family-name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} placeholder="Okeke" /></Field>
            </div>
            <Field label="I am">
              <div className="grid grid-cols-2 gap-2">{(["F", "M"] as const).map((g) => (
                <button type="button" key={g} onClick={() => setF({ ...f, gender: g })} className={cx("h-12 rounded-xl text-[15px] ring-1 transition", f.gender === g ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{g === "F" ? "Female" : "Male"}</button>
              ))}</div>
            </Field>
            <Consent church={church.name} checked={agree} onChange={setAgree} />
            {err && <p className="text-sm text-alert" role="alert">{err}</p>}
            <Button variant="primary" type="submit" disabled={busy} className="w-full py-3.5 text-[16px]">{busy ? "Saving…" : "Say hello"}</Button>
          </form>
          {!startNew && <button onClick={() => setStep("phone")} className="mt-3 w-full p-2 text-center text-sm text-muted">I&apos;ve been here before</button>}
        </Card>
      )}

      {step === "done" && (
        <Card>
          <Confetti show={result !== "already"} />
          <div className="pop mx-auto flex size-20 items-center justify-center rounded-full text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, #f59e0b)` }}>{result === "already" ? <Check size={36} /> : <PartyPopper size={34} />}</div>
          <h1 className="mt-5 text-center font-display text-[30px] font-semibold tracking-tight">
            {result === "already" ? "You're already in" : result === "new" ? `Welcome, ${who?.name ?? ""}!` : result === "back" ? "Welcome back!" : `You're checked in${who?.name ? `, ${who.name}` : ""}!`}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-center text-ink-soft">
            {result === "new" ? `We're so glad you're worshipping with us. After service, tell us how it went. It helps us welcome you well.`
              : result === "back" ? "It's lovely to see you again. Thank you for coming back."
              : "Enjoy the service. God bless you."}
          </p>
          <div className="mt-6 space-y-2">
            {isNewcomer && <Button variant="primary" className="w-full py-3.5" onClick={() => setStep("feedback")}>Tell us about today <ArrowRight size={16} /></Button>}
            <Button className="w-full" onClick={() => reset(true)}><UserPlus size={16} /> Check in someone else on this phone</Button>
            <a href={`/join?church=${church.slug}`} className="block rounded-xl p-2.5 text-center text-[13.5px] text-ink-soft hover:bg-page">Get the {church.name} app on Traqi: classes, events and more</a>
          </div>
        </Card>
      )}

      {step === "feedback" && (
        <Card>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight">How was today?</h1>
          <p className="mt-1 text-ink-soft">A few quick taps. Everything is optional.</p>
          <div className="mt-6 space-y-5">
            <Field label="What did you enjoy most?">
              <div className="flex flex-wrap gap-1.5">{ENJOYED.map((h) => (
                <button type="button" key={h} onClick={() => setFb({ ...fb, enjoyed: fb.enjoyed.includes(h) ? fb.enjoyed.filter((x) => x !== h) : [...fb.enjoyed, h] })}
                  className={cx("rounded-full px-3.5 py-2 text-sm ring-1 transition", fb.enjoyed.includes(h) ? "bg-deep text-white ring-deep" : "bg-surface text-ink-soft ring-line")}>{fb.enjoyed.includes(h) && "✓ "}{h}</button>
              ))}</div>
            </Field>
            <Field label="Where do you live?"><div className="relative"><MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input className={cx(inputCls, "pl-10")} value={fb.location} onChange={(e) => setFb({ ...fb, location: e.target.value })} placeholder="Surulere" /></div></Field>
            <Field label="How did you hear about us?">
              <div className="flex flex-wrap gap-1.5">{HEARD.map((h) => <button type="button" key={h} onClick={() => setFb({ ...fb, heard: h })} className={cx("rounded-full px-3 py-2 text-sm ring-1", fb.heard === h ? "bg-brand text-white ring-brand" : "bg-surface text-ink-soft ring-line")}>{h}</button>)}</div>
            </Field>
            {(church.profile?.customFields ?? []).filter((x) => x.onWelcome && !x.hidden).map((x) => (
              <Field key={x.id} label={x.label}><CustomFieldInput f={x} value={extra[x.id]} onChange={(v) => setExtra({ ...extra, [x.id]: v })} /></Field>
            ))}
            <Field label="Anything you'd like to tell us?"><textarea className={cx(inputCls, "min-h-20")} value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value })} placeholder="It felt like home…" /></Field>
            <Field label="Prayer request" hint="Only the pastors and the follow-up team see this."><textarea className={cx(inputCls, "min-h-20")} value={fb.prayer} onChange={(e) => setFb({ ...fb, prayer: e.target.value })} /></Field>
            <label className="flex items-center gap-3 rounded-2xl bg-page p-4 text-[14.5px] ring-1 ring-line"><input type="checkbox" checked={fb.wantsVisit} onChange={(e) => setFb({ ...fb, wantsVisit: e.target.checked })} className="size-5 accent-brand" />I&apos;d love a call or visit from the church</label>
            {err && <p className="text-sm text-alert">{err}</p>}
            <Button variant="primary" className="w-full py-3.5 text-[16px]" disabled={busy} onClick={() => void sendFeedback()}>Send</Button>
          </div>
        </Card>
      )}

      {step === "thanks" && (
        <Card>
          <div className="pop mx-auto flex size-16 items-center justify-center rounded-full bg-good-soft text-good"><HeartHandshake size={30} /></div>
          <h1 className="mt-5 text-center font-display text-[28px] font-semibold tracking-tight">Thank you!</h1>
          <p className="mx-auto mt-2 max-w-sm text-center text-ink-soft">Someone from {church.name} will reach out within two days to say hello. We hope to see you again soon.</p>
          <Button className="mt-6 w-full" onClick={() => reset(true)}><UserPlus size={16} /> Add another person</Button>
        </Card>
      )}
    </Frame>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rise rounded-[28px] bg-surface p-6 shadow-xl shadow-ink/5 ring-1 ring-line md:p-8">{children}</div>;
}

/** Public pages wear the church's own colour and logo. */
export function Frame({ children, color, church }: { children: React.ReactNode; color: string; church?: { name: string; profile?: PublicChurch["profile"] } }) {
  usePublicTheme({ ...(church?.profile ?? {}), color });
  const bg = useMemo(() => `radial-gradient(600px 300px at 90% -10%, ${color}88, transparent 70%), radial-gradient(500px 260px at 0% 0%, #f59e0b33, transparent 70%), var(--color-deep)`, [color]);
  return (
    <div className="min-h-screen bg-page">
      <div className="px-5 pb-28 pt-8 text-white" style={{ background: bg }}>
        {church && <div className="mx-auto flex max-w-lg items-center gap-3">
          <ChurchMark church={{ name: church.name, profile: { ...(church.profile ?? {}), color } as never }} size={40} className="ring-2 ring-white/20" />
          <span className="font-display text-lg font-semibold">{church.name}</span>
        </div>}
      </div>
      <main className="relative mx-auto -mt-20 max-w-lg px-4 pb-14">{children}</main>
      <p className="pb-8 text-center text-xs text-muted">Powered by <b className="font-semibold text-ink-soft">Traqi</b> for Churches</p>
    </div>
  );
}
