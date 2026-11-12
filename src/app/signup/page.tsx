"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Building2, Camera, Check, Church, Crosshair, Loader2, Network, Pencil, Plus, Sparkles, Trash2, Users, Wand2, X } from "lucide-react";
import { LiveSignIn } from "@/components/auth";
import { useStore } from "@/lib/store";
import { COUNTRIES } from "@/lib/templates";
import { LEVELS, RESERVED_SLUGS, departmentsFor, recommend, suggestSlug, type DeptDraft, type RecommendAnswers } from "@/lib/setup";
import { defaultJourney, type Journey } from "@/lib/journey";
import { findChurches, slugAvailable, type FoundChurch } from "@/lib/live";
import { DEMO_CHURCHES, rankChurches } from "@/lib/church-search";
import { uploadImage } from "@/lib/upload";
import { digits } from "@/lib/format";
import { OnboardFrame, Steps } from "@/components/onboarding";
import { BrandPicker } from "@/components/brand-picker";
import { JourneyEditor } from "@/components/journey-editor";
import { Button, Field, Sheet, cx, inputCls } from "@/components/ui";
import { ChurchMark } from "@/components/brand";
import { DEFAULT_PROFILE } from "@/lib/seed-more";
import type { ChurchLevel, ChurchProfile } from "@/lib/types";

const LEVEL_ICON = { close: Church, growing: Users, branches: Building2, network: Network };
type SlugState = { checking: boolean; ok?: boolean; reason?: string; suggest?: string[] };

/** Starting a church: about two minutes, with only the essentials required. */
export default function Signup() {
  const { createChurch, mode, authStatus, authEmail, state } = useStore();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [church, setChurch] = useState({ name: "", country: "Nigeria", address: "", city: "", state: "", directions: "", goal: "" });
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [photo, setPhoto] = useState<string | undefined>();
  const [slug, setSlug] = useState(""); const [slugEdited, setSlugEdited] = useState(false); const [editingSlug, setEditingSlug] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>({ checking: false });
  const [similar, setSimilar] = useState<FoundChurch[]>([]); const [dismissSimilar, setDismissSimilar] = useState(false);
  const [me, setMe] = useState({ firstName: "", lastName: "", gender: "" as "" | "M" | "F", phone: "", email: "", role: "lead" as "lead" | "pastor" | "admin" });
  const [level, setLevel] = useState<ChurchLevel>("growing");
  const [recOpen, setRecOpen] = useState(false);
  const [look, setLook] = useState<Pick<ChurchProfile, "logo" | "color" | "accent" | "heading">>({ color: "#4f46e5", heading: "modern" });
  const [journey, setJourneyState] = useState<Journey>(defaultJourney("class_first"));
  const [depts, setDepts] = useState<DeptDraft[]>(departmentsFor("growing"));
  const photoInput = useRef<HTMLInputElement>(null);
  const origin = typeof window !== "undefined" ? location.host.replace(/^www\./, "") : "traqi.space";

  // The web address follows the name until someone edits it
  useEffect(() => { if (!slugEdited) setSlug(suggestSlug(church.name)); }, [church.name, slugEdited]);
  useEffect(() => {
    const s = slug.trim();
    if (s.length < 2) { setSlugState({ checking: false }); return; }
    if (mode !== "live") {
      const taken = [state.church.slug, ...DEMO_CHURCHES.map((c) => c.slug)].includes(s);
      setSlugState(RESERVED_SLUGS.has(s) ? { checking: false, ok: false, reason: "Reserved", suggest: [`${s}-church`] } : taken ? { checking: false, ok: false, reason: "Taken", suggest: [`${s}-lagos`, `${s}-ng`] } : { checking: false, ok: true });
      return;
    }
    setSlugState({ checking: true });
    const t = setTimeout(() => slugAvailable(s).then((r) => setSlugState({ checking: false, ...r })).catch(() => setSlugState({ checking: false })), 350);
    return () => clearTimeout(t);
  }, [slug, mode, state.church.slug]);
  // "Is your church already on Traqi?"
  useEffect(() => {
    if (church.name.trim().length < 4) { setSimilar([]); return; }
    const t = setTimeout(() => {
      if (mode === "live") findChurches(church.name).then((r) => setSimilar(r.slice(0, 3))).catch(() => {});
      else setSimilar(rankChurches(church.name, [{ id: "heirs", name: state.church.name, slug: state.church.slug, city: "Lagos", verified: true, branches: [] }, ...DEMO_CHURCHES.map((c, i) => ({ ...c, id: `d${i}` }))], 0.55).slice(0, 3));
    }, 400);
    return () => clearTimeout(t);
  }, [church.name, mode, state.church]);
  useEffect(() => { setDepts(departmentsFor(level)); }, [level]);

  const steps = ["Your church", "You", "Setup", "Look", "Journey"];

  const next = async () => {
    setErr("");
    if (step === 0) {
      if (church.name.trim().length < 3) return setErr("Enter your church's name.");
      if (!slugState.ok) return setErr("Choose a web address that's available.");
      if (church.address.trim().length < 5) return setErr("Enter your church's street address.");
      if (!church.city.trim()) return setErr("Enter the city or area.");
      if (church.directions.trim().length < 8) return setErr("Add a short description of how to find the church.");
    }
    if (step === 1) {
      if (!me.firstName.trim() || !me.lastName.trim()) return setErr("Enter your first and last name.");
      if (!me.gender) return setErr("Choose male or female.");
      if (digits(me.phone).length < 10) return setErr("Enter a phone number with at least 10 digits.");
    }
    if (step === 4) {
      if (journey.stages.some((s) => !s.name.trim())) return setErr("Give every stage a name.");
      if (!depts.length) return setErr("Keep at least one department. You can change them later.");
      const c = COUNTRIES.find((x) => x.name === church.country)!;
      setBusy(true);
      try {
        const profile: ChurchProfile = {
          ...DEFAULT_PROFILE(), ...look, level, journey, address: church.address.trim(), city: church.city.trim(), state: church.state.trim() || undefined,
          directions: church.directions.trim(), pin: pin ?? undefined, buildingPhoto: photo,
          offeringsAt: level === "branches" || level === "network" ? "branch" : undefined,
        };
        await createChurch({
          church: { name: church.name.trim(), slug: slug.trim(), country: c.name, currency: c.currency, timeZone: c.timeZone, attendanceGoal: Number(church.goal) || undefined, profile },
          me: { firstName: me.firstName.trim(), lastName: me.lastName.trim(), gender: me.gender as "M" | "F", phone: me.phone.trim(), email: me.email.trim() || authEmail || undefined },
          role: me.role, departments: depts.filter((d) => d.name.trim()),
        });
        router.push("/today?welcome=1");
      } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong. Try again."); }
      setBusy(false);
      return;
    }
    setStep(step + 1);
  };

  if (mode === "live" && authStatus === "loading") return <OnboardFrame title="Start your church on Traqi"><p className="flex items-center gap-2 text-ink-soft"><Loader2 size={18} className="animate-spin" /> One moment…</p></OnboardFrame>;
  if (mode === "live" && authStatus === "ready") return (
    <OnboardFrame title="Start your church on Traqi">
      <h2 className="font-display text-[30px] leading-tight">You already belong to a church</h2>
      <p className="mt-2 text-ink-soft">Starting another church from this account is coming soon. For now, sign out and use a different account.</p>
      <Button variant="primary" className="mt-6" onClick={() => router.push("/today")}>Go to my church</Button>
    </OnboardFrame>
  );
  if (mode === "live" && authStatus === "signed-out") return (
    <OnboardFrame title="Start your church on Traqi" points={["Free during early access", "Set up in about two minutes", "Everything can be changed later"]} back={{ href: "/login", label: "Back to sign in" }}>
      <h2 className="font-display text-[30px] leading-tight">First, create your account</h2>
      <p className="mb-6 mt-1.5 text-ink-soft">You&apos;ll use it to sign in to your church on Traqi.</p>
      <LiveSignIn returnTo="/signup" startMode="up" />
    </OnboardFrame>
  );

  return (
    <OnboardFrame title="Start your church on Traqi" points={["Free during early access", "Set up in about two minutes", "Everything can be changed later"]}
      back={step === 0 ? { href: mode === "live" ? "/start" : "/login", label: "Back" } : undefined} wide={step >= 2}>
      <Steps steps={steps} at={step} />
      <form className="rise space-y-4" key={step} onSubmit={(e) => { e.preventDefault(); void next(); }}>
        {step === 0 && (
          <>
            <h2 className="font-display text-[30px] leading-tight">Tell us about your church</h2>
            <Field label="Church name">
              <input autoFocus className={inputCls} value={church.name} onChange={(e) => { setChurch({ ...church, name: e.target.value }); setDismissSimilar(false); }} placeholder="Grace Chapel Ikeja" />
            </Field>
            {church.name.trim().length >= 2 && (
              <div className="-mt-2 rounded-xl bg-page px-3 py-2.5 ring-1 ring-line">
                {editingSlug ? (
                  <div className="flex items-center gap-1.5 text-[14px]">
                    <span className="text-muted">{origin}/</span>
                    <input autoFocus className="min-w-0 flex-1 rounded-lg bg-surface px-2 py-1 font-medium ring-1 ring-brand outline-none" value={slug}
                      onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugEdited(true); }} aria-label="Web address" />
                    <button type="button" onClick={() => setEditingSlug(false)} className="rounded-lg bg-brand px-2.5 py-1 text-[12.5px] font-medium text-white">Done</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[14px]">
                    <span className="min-w-0 flex-1 truncate"><span className="text-muted">{origin}/</span><b className="font-semibold">{slug || "…"}</b></span>
                    {slugState.checking ? <Loader2 size={15} className="animate-spin text-muted" /> : slugState.ok ? <span className="flex items-center gap-1 text-[12.5px] font-medium text-good"><Check size={14} /> Available</span>
                      : slugState.reason ? <span className="text-[12.5px] font-medium text-alert">{slugState.reason === "Taken" ? "Taken" : slugState.reason === "Reserved" ? "Not allowed" : slugState.reason}</span> : null}
                    <button type="button" onClick={() => setEditingSlug(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-medium text-brand hover:bg-brand-soft"><Pencil size={12} /> Edit</button>
                  </div>
                )}
                {!slugState.ok && slugState.suggest && slugState.suggest.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px]"><span className="text-muted">Try:</span>{slugState.suggest.slice(0, 3).map((x) => <button type="button" key={x} onClick={() => { setSlug(x); setSlugEdited(true); }} className="rounded-full bg-surface px-2.5 py-1 font-medium ring-1 ring-line hover:ring-brand">{x}</button>)}</div>
                )}
                <p className="mt-1 text-[12px] text-muted">Your church&apos;s page, check-in and events live here. Keep it short.</p>
              </div>
            )}
            {similar.length > 0 && !dismissSimilar && (
              <div className="rounded-2xl bg-glow-soft p-3.5 ring-1 ring-glow/30">
                <p className="text-[14px] font-semibold text-glow-ink">Is your church already on Traqi?</p>
                <ul className="mt-2 space-y-1.5">{similar.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 rounded-xl bg-surface p-2">
                    <ChurchMark church={{ name: c.name, profile: { logo: c.logo, color: c.color } as never }} size={32} />
                    <span className="min-w-0 flex-1 text-[13.5px]"><b className="flex items-center gap-1 font-medium"><span className="truncate">{c.name}</span>{c.verified && <BadgeCheck size={14} className="text-brand" />}</b><span className="text-muted">{c.city}</span></span>
                    <button type="button" onClick={() => router.push(`/join?church=${c.slug}`)} className="rounded-lg bg-brand px-2.5 py-1.5 text-[12.5px] font-medium text-white">Join instead</button>
                  </li>
                ))}</ul>
                <button type="button" onClick={() => setDismissSimilar(true)} className="mt-2 text-[12.5px] font-medium text-glow-ink">No, mine is a different church</button>
              </div>
            )}
            <Field label="Street address"><input className={inputCls} value={church.address} onChange={(e) => setChurch({ ...church, address: e.target.value })} placeholder="12 Allen Avenue" autoComplete="street-address" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City or area"><input className={inputCls} value={church.city} onChange={(e) => setChurch({ ...church, city: e.target.value })} placeholder="Ikeja" /></Field>
              <Field label="State"><input className={inputCls} value={church.state} onChange={(e) => setChurch({ ...church, state: e.target.value })} placeholder="Lagos" /></Field>
            </div>
            <Field label="Country">
              <select className={inputCls} value={church.country} onChange={(e) => setChurch({ ...church, country: e.target.value })}>{COUNTRIES.map((c) => <option key={c.name}>{c.name}</option>)}</select>
            </Field>
            <Field label="How to find you" hint="In plain words, the way you'd tell a visitor on the phone.">
              <textarea className={cx(inputCls, "min-h-20")} value={church.directions} onChange={(e) => setChurch({ ...church, directions: e.target.value })} placeholder="Opposite First Bank. Turn into the second street on the left; white gate with our blue sign." />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setPin({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }), () => setErr("We couldn't get your location. You can add it later."))}
                className={cx("flex items-center gap-2.5 rounded-xl p-3 text-left text-[13.5px] ring-1", pin ? "bg-good-soft ring-good/30" : "bg-page ring-line hover:ring-brand/40")}>
                <Crosshair size={17} className={pin ? "text-good" : "text-muted"} />
                <span className="flex-1">{pin ? <><b className="font-medium">Map pin added</b><br /><span className="text-muted">{pin.lat}, {pin.lng}</span></> : <><b className="font-medium">Add a map pin</b> <span className="text-muted">(optional)</span><br /><span className="text-muted">Best done inside the church</span></>}</span>
                {pin && <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setPin(null); }} className="rounded p-1 text-muted hover:bg-surface" aria-label="Remove pin"><X size={14} /></span>}
              </button>
              <button type="button" onClick={() => photoInput.current?.click()} className={cx("flex items-center gap-2.5 overflow-hidden rounded-xl p-3 text-left text-[13.5px] ring-1", photo ? "bg-good-soft ring-good/30" : "bg-page ring-line hover:ring-brand/40")}>
                {photo ? <img src={photo} alt="" className="size-9 rounded-lg object-cover" /> : <Camera size={17} className="text-muted" />}
                <span className="flex-1"><b className="font-medium">{photo ? "Building photo added" : "Photo of the building"}</b> {!photo && <span className="text-muted">(optional)</span>}<br /><span className="text-muted">Helps visitors recognise it</span></span>
              </button>
              <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await uploadImage(f, "building", 1200).catch(() => undefined)); }} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="font-display text-[30px] leading-tight">And you?</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name"><input autoFocus className={inputCls} value={me.firstName} onChange={(e) => setMe({ ...me, firstName: e.target.value })} autoComplete="given-name" /></Field>
              <Field label="Last name"><input className={inputCls} value={me.lastName} onChange={(e) => setMe({ ...me, lastName: e.target.value })} autoComplete="family-name" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">{(["F", "M"] as const).map((g) => (
              <button type="button" key={g} onClick={() => setMe({ ...me, gender: g })} className={cx("h-11 rounded-xl text-sm ring-1", me.gender === g ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{g === "F" ? "Female" : "Male"}</button>
            ))}</div>
            <Field label="Phone number"><input className={inputCls} inputMode="tel" value={me.phone} onChange={(e) => setMe({ ...me, phone: e.target.value })} placeholder="0803 123 4567" autoComplete="tel" /></Field>
            {!(mode === "live" && authEmail) && <Field label="Email (optional)"><input className={inputCls} type="email" value={me.email} onChange={(e) => setMe({ ...me, email: e.target.value })} /></Field>}
            <Field label="Your role">
              <div className="grid gap-2 sm:grid-cols-3">{([["lead", "Lead pastor"], ["pastor", "A pastor"], ["admin", "Church admin"]] as const).map(([k, l]) => (
                <button type="button" key={k} onClick={() => setMe({ ...me, role: k })} className={cx("rounded-xl py-3 text-sm ring-1", me.role === k ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{l}</button>
              ))}</div>
            </Field>
            {me.role !== "lead" && <p className="rounded-xl bg-page px-3 py-2.5 text-[13px] text-ink-soft">You&apos;ll have full access while you set things up, and can hand the lead pastor role to your pastor later.</p>}
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="font-display text-[30px] leading-tight">How is your church set up?</h2><p className="mt-1 text-ink-soft">Pick the closest. You can change it any time without losing anything.</p></div>
              <Button type="button" onClick={() => setRecOpen(true)}><Wand2 size={15} /> Let Traqi recommend</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {LEVELS.map((l) => {
                const I = LEVEL_ICON[l.k]; const on = level === l.k;
                return (
                  <button type="button" key={l.k} onClick={() => setLevel(l.k)} className={cx("relative rounded-2xl p-4 text-left ring-1 transition", on ? "bg-brand-soft ring-2 ring-brand" : "bg-surface ring-line hover:ring-ink/20")}>
                    {on && <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-brand text-white"><Check size={14} /></span>}
                    <span className={cx("flex size-11 items-center justify-center rounded-xl", on ? "bg-brand text-white" : "bg-page text-ink-soft")}><I size={20} /></span>
                    <b className="mt-3 block font-display text-[18px]">{l.name}</b>
                    <span className="mt-0.5 block text-[13.5px] text-ink-soft">{l.who}</span>
                    <ul className="mt-3 space-y-1 text-[12.5px] text-muted">{l.points.map((p) => <li key={p} className="flex items-center gap-1.5"><Check size={12} className="text-good" />{p}</li>)}</ul>
                  </button>
                );
              })}
            </div>
            {(level === "branches" || level === "network") && <p className="rounded-xl bg-page px-3 py-2.5 text-[13px] text-ink-soft">You&apos;ll add your branches{level === "network" ? " and regions" : ""} from Settings once you&apos;re in. What you set up now becomes your headquarters.</p>}
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="font-display text-[30px] leading-tight">Make it look like your church</h2><p className="mt-1 text-ink-soft">Everyone in your church will see Traqi in your colours.</p></div>
              <button type="submit" className="text-sm font-medium text-brand">Add later</button>
            </div>
            <BrandPicker name={church.name} value={look} onChange={setLook} />
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="font-display text-[30px] leading-tight">Your journey and departments</h2>
            <p className="-mt-2 text-ink-soft">How people grow in your church, and where they serve. Rename anything; change it all later.</p>
            <div className="card p-4"><p className="mb-3 font-display text-[18px]">The journey</p><JourneyEditor value={journey} onChange={setJourneyState} simple /></div>
            <div className="card p-4">
              <p className="mb-3 font-display text-[18px]">Departments</p>
              <DeptList value={depts} onChange={setDepts} />
            </div>
          </>
        )}

        {err && <p className="text-sm text-alert" role="alert">{err}</p>}
        <div className="flex gap-2 pt-2">
          {step > 0 && <Button type="button" onClick={() => { setStep(step - 1); setErr(""); }}>Back</Button>}
          <Button variant="primary" type="submit" disabled={busy} className="h-12 flex-1 text-[16px]">{busy && <Loader2 size={16} className="animate-spin" />}{step === 4 ? "Create my church" : "Continue"}{step < 4 && <ArrowRight size={16} />}</Button>
        </div>
      </form>

      <Sheet open={recOpen} onClose={() => setRecOpen(false)} title="Let Traqi recommend"><Recommender onPick={(l) => { setLevel(l); setRecOpen(false); }} /></Sheet>
    </OnboardFrame>
  );
}

function Recommender({ onPick }: { onPick: (l: ChurchLevel) => void }) {
  const [a, setA] = useState<RecommendAnswers>({});
  const qs = useMemo(() => {
    const list: { k: keyof RecommendAnswers; q: string; opts: [RecommendAnswers[keyof RecommendAnswers], string][] }[] = [
      { k: "onlyPastor", q: "Are you the only pastor?", opts: [[true, "Yes, just me"], [false, "No, there are others"]] },
      { k: "size", q: "How many people come on a typical Sunday?", opts: [["lt100", "Under 100"], ["100-500", "100 to 500"], ["500-2000", "500 to 2,000"], ["gt2000", "Over 2,000"]] },
      { k: "places", q: "Does your church meet in more than one place?", opts: [["one", "No, one place"], ["few", "Yes, 2 to 5 places"], ["many", "Yes, more than 5"]] },
    ];
    if (a.places === "many") list.push({ k: "regions", q: "Are your branches grouped into regions or zones?", opts: [[true, "Yes"], [false, "No"]] });
    return list;
  }, [a.places]);
  const i = qs.findIndex((q) => a[q.k] === undefined);
  const done = i === -1;
  const r = done ? recommend(a) : null;
  const L = r ? LEVELS.find((l) => l.k === r.level)! : null;
  return (
    <div>
      <div className="mb-5 flex gap-1.5">{qs.map((q, j) => <span key={q.k} className={cx("h-1.5 flex-1 rounded-full", done || j < i ? "bg-brand" : j === i ? "bg-brand/40" : "bg-line")} />)}</div>
      {!done ? (
        <div key={i} className="rise">
          <p className="font-display text-[22px] leading-snug">{qs[i].q}</p>
          <div className="mt-5 grid gap-2">{qs[i].opts.map(([v, l]) => (
            <button key={String(v)} onClick={() => setA({ ...a, [qs[i].k]: v })} className="rounded-2xl bg-page px-4 py-3.5 text-left text-[15px] font-medium ring-1 ring-line transition hover:bg-brand-soft hover:ring-brand">{l}</button>
          ))}</div>
          {i > 0 && <button onClick={() => { const n = { ...a }; delete n[qs[i - 1].k]; setA(n); }} className="mt-4 text-sm text-muted">Back</button>}
        </div>
      ) : L && r && (
        <div className="rise text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30"><Sparkles size={24} /></span>
          <p className="mt-4 text-sm text-muted">We recommend</p>
          <p className="font-display text-[26px]">{L.name}</p>
          <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-ink-soft">{r.why}</p>
          <Button variant="primary" className="mt-6 w-full py-3" onClick={() => onPick(r.level)}>Use this</Button>
          <button onClick={() => setA({})} className="mt-3 text-sm text-muted">Start again</button>
        </div>
      )}
    </div>
  );
}

function DeptList({ value, onChange }: { value: DeptDraft[]; onChange: (v: DeptDraft[]) => void }) {
  const [newName, setNewName] = useState("");
  return (
    <div>
      <ul className="space-y-1.5">
        {value.map((d, i) => (
          <li key={`${d.key}-${i}`} className="flex items-center gap-2 rounded-xl bg-page p-2 ring-1 ring-line">
            <input className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-[14.5px] font-medium outline-none focus:bg-surface focus:ring-1 focus:ring-brand" value={d.name}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label={`Department ${i + 1}`} />
            {d.units?.length ? <span className="hidden text-[12px] text-muted sm:inline">{d.units.length} units</span> : null}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-muted hover:bg-alert-soft hover:text-alert" aria-label={`Remove ${d.name}`}><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input className={cx(inputCls, "py-2")} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add a department, e.g. Sanctuary Keepers"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newName.trim()) { onChange([...value, { key: `d${Date.now().toString(36)}`, name: newName.trim(), purpose: "" }]); setNewName(""); } } }} />
        <Button type="button" onClick={() => { if (newName.trim()) { onChange([...value, { key: `d${Date.now().toString(36)}`, name: newName.trim(), purpose: "" }]); setNewName(""); } }}><Plus size={15} /> Add</Button>
      </div>
    </div>
  );
}
