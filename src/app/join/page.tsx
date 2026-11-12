"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Building2, Loader2, MapPin, Search, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { findChurches, type FoundChurch } from "@/lib/live";
import { DEMO_CHURCHES, rankChurches } from "@/lib/church-search";
import { digits } from "@/lib/format";
import { OnboardFrame, Steps } from "@/components/onboarding";
import { LiveSignIn } from "@/components/auth";
import { Button, Confetti, Field, cx, inputCls } from "@/components/ui";
import { ChurchMark } from "@/components/brand";

/** Join a church found by search. Instant member access; the church confirms you later. */
export default function Join() {
  const { mode, authStatus, state, joinChurch } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoundChurch[]>([]);
  const [searching, setSearching] = useState(false);
  const [church, setChurch] = useState<FoundChurch | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [step, setStep] = useState<"find" | "branch" | "details" | "done">("find");
  const [f, setF] = useState({ firstName: "", lastName: "", gender: "" as "" | "M" | "F", phone: "", birthday: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // In the demo, Heirs Church is the one you can actually join
  const demoList = useMemo<FoundChurch[]>(() => [
    { id: "heirs", name: state.church.name, slug: state.church.slug || "heirs", city: state.church.profile?.city ?? "Lagos", address: state.church.profile?.address,
      logo: state.church.profile?.logo, color: state.church.profile?.color, verified: true, branches: (state.church.profile?.branches ?? []).map((b) => ({ id: b.id, name: b.name, city: b.city })) },
    ...DEMO_CHURCHES.map((c, i) => ({ ...c, id: `demo-${i}` })),
  ], [state.church]);

  // Arriving from a church's "Join on Traqi" button: the church is already chosen
  useEffect(() => {
    const slug = new URLSearchParams(location.search).get("church");
    if (!slug) return;
    if (mode === "live") findChurches(slug).then((r) => { const c = r.find((x) => x.slug === slug); if (c) pick(c); }).catch(() => {});
    else { const c = demoList.find((x) => x.slug === slug); if (c) pick(c); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    if (mode !== "live") { setResults(rankChurches(q, demoList)); return; }
    setSearching(true);
    timer.current = setTimeout(() => {
      findChurches(q.trim()).then(setResults).catch(() => setResults([])).finally(() => setSearching(false));
    }, 220);
  }, [q, mode, demoList]);

  function pick(c: FoundChurch) { setChurch(c); setBranch(null); setStep(c.branches.length ? "branch" : "details"); setErr(""); }

  const submit = async () => {
    setErr("");
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("Please enter your first and last name.");
    if (!f.gender) return setErr("Please choose male or female.");
    if (digits(f.phone).length < 10) return setErr("Please enter your phone number.");
    if (mode !== "live" && church!.id !== "heirs") return setErr(`In this demo you can join ${state.church.name}. On your live site, every church on Traqi can be joined.`);
    setBusy(true);
    try {
      await joinChurch({ church: church!.id, branch: branch ?? undefined, firstName: f.firstName, lastName: f.lastName, gender: f.gender as "M" | "F", phone: f.phone, birthday: f.birthday || undefined });
      setStep("done");
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong. Try again."); }
    setBusy(false);
  };

  if (mode === "live" && authStatus === "loading") return <OnboardFrame title="Find your church"><p className="flex items-center gap-2 text-ink-soft"><Loader2 size={18} className="animate-spin" /> One moment…</p></OnboardFrame>;
  if (mode === "live" && authStatus === "signed-out") return (
    <OnboardFrame title="Find your church on Traqi" back={{ href: "/login", label: "Back" }}>
      <h2 className="font-display text-[30px] leading-tight">First, sign in</h2>
      <p className="mb-6 mt-1.5 text-ink-soft">Use Google or your email. It takes a few seconds.</p>
      <LiveSignIn returnTo="/join" startMode="up" />
    </OnboardFrame>
  );

  const steps = church?.branches.length ? ["Find", "Branch", "You"] : ["Find", "You"];
  const at = step === "find" ? 0 : step === "branch" ? 1 : step === "details" ? steps.length - 1 : steps.length;

  return (
    <OnboardFrame title="Find your church on Traqi" points={["Search by name, initials or area", "You're in straight away", "Your church confirms you soon after"]} back={step === "find" ? { href: mode === "live" ? "/start" : "/login", label: "Back" } : undefined}>
      {step !== "done" && <Steps steps={steps} at={at} />}

      {step === "find" && (
        <div className="rise">
          <h2 className="font-display text-[30px] leading-tight">Which church do you attend?</h2>
          <p className="mt-1.5 text-ink-soft">Type its name, its initials (like RCCG or CAC) or the area.</p>
          <div className="relative mt-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Heirs, CAC Ikeja, Living Faith" aria-label="Church name"
              className={cx(inputCls, "h-14 pl-11 pr-11 text-[16px]")} />
            {searching ? <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-muted" />
              : q && <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:bg-ink/5"><X size={16} /></button>}
          </div>
          <ul className="mt-3 space-y-2" aria-live="polite">
            {results.map((c, i) => (
              <li key={c.id} className="rise" style={{ animationDelay: `${i * 40}ms` }}>
                <button onClick={() => pick(c)} className="card card-hover flex w-full items-center gap-3.5 p-3.5 text-left">
                  <ChurchMark church={{ name: c.name, profile: { logo: c.logo, color: c.color } as never }} size={46} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium"><span className="truncate">{c.name}</span>{c.verified && <BadgeCheck size={16} className="shrink-0 text-brand" aria-label="Verified" />}</span>
                    <span className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted"><MapPin size={12} className="shrink-0" />{[c.address, c.city].filter(Boolean).join(", ") || "Address not added"}</span>
                    {c.branches.length > 0 && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-medium text-brand"><Building2 size={11} /> {c.branches.length} branches</span>}
                  </span>
                  <ArrowRight size={18} className="text-muted" />
                </button>
              </li>
            ))}
            {q.trim().length >= 2 && !searching && results.length === 0 && (
              <li className="rounded-2xl bg-page p-5 text-center text-sm text-ink-soft ring-1 ring-line">
                No church matches “{q}”. Check the spelling, try the area, or ask your church for their Traqi link.
              </li>
            )}
          </ul>
        </div>
      )}

      {step === "branch" && church && (
        <div className="rise">
          <ChosenChurch c={church} onChange={() => setStep("find")} />
          <h2 className="mt-6 font-display text-[26px] leading-tight">Which branch do you attend?</h2>
          <ul className="mt-4 grid gap-2">
            {church.branches.map((b) => (
              <li key={b.id}>
                <button onClick={() => { setBranch(b.id); setStep("details"); }} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left ring-1 ring-line transition hover:ring-brand">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Building2 size={18} /></span>
                  <span className="flex-1"><b className="block font-medium">{b.name}</b><span className="text-[13px] text-muted">{[b.address, b.city].filter(Boolean).join(", ")}</span></span>
                  <ArrowRight size={17} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === "details" && church && (
        <form className="rise space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <ChosenChurch c={church} branch={church.branches.find((b) => b.id === branch)?.name} onChange={() => setStep("find")} />
          <h2 className="pt-2 font-display text-[26px] leading-tight">A little about you</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><input autoFocus className={inputCls} autoComplete="given-name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
            <Field label="Last name"><input className={inputCls} autoComplete="family-name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
          </div>
          <Field label="I am">
            <div className="grid grid-cols-2 gap-2">{(["F", "M"] as const).map((g) => (
              <button type="button" key={g} onClick={() => setF({ ...f, gender: g })} className={cx("h-12 rounded-xl text-[15px] ring-1", f.gender === g ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{g === "F" ? "Female" : "Male"}</button>
            ))}</div>
          </Field>
          <Field label="Phone number" hint="Your church uses it to reach you."><input className={inputCls} inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0803 123 4567" /></Field>
          <Field label="Birthday (optional)" hint="So the church can celebrate you."><input type="date" className={inputCls} value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} /></Field>
          {err && <p className="text-sm text-alert" role="alert">{err}</p>}
          <Button variant="primary" type="submit" disabled={busy} className="h-12 w-full text-[16px]">{busy ? <Loader2 size={17} className="animate-spin" /> : null}Join {church.name.split(/[,(]/)[0]}</Button>
          <p className="text-center text-[12.5px] text-muted">You can use Traqi as a member straight away. Your church confirms you soon after.</p>
        </form>
      )}

      {step === "done" && church && (
        <div className="rise text-center">
          <Confetti show />
          <div className="mx-auto w-fit"><ChurchMark church={{ name: church.name, profile: { logo: church.logo, color: church.color } as never }} size={72} className="shadow-xl" /></div>
          <h2 className="mt-5 font-display text-[30px] leading-tight">Welcome to {church.name.split(/[,(]/)[0]}, {f.firstName}!</h2>
          <p className="mx-auto mt-2 max-w-sm text-ink-soft">You&apos;re in. Check in on Sundays, join classes and register for events. Your church will confirm you soon.</p>
          <Button variant="primary" className="mt-6 h-12 px-6 text-[16px]" onClick={() => router.push("/today")}>Go to my church <ArrowRight size={17} /></Button>
        </div>
      )}
    </OnboardFrame>
  );
}

function ChosenChurch({ c, branch, onChange }: { c: FoundChurch; branch?: string; onChange: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-brand-soft/60 p-3 ring-1 ring-brand/20">
      <ChurchMark church={{ name: c.name, profile: { logo: c.logo, color: c.color } as never }} size={40} />
      <span className="min-w-0 flex-1"><b className="flex items-center gap-1 truncate font-medium">{c.name}{c.verified && <BadgeCheck size={15} className="shrink-0 text-brand" />}</b><span className="text-[13px] text-ink-soft">{branch ?? c.city}</span></span>
      <button type="button" onClick={onChange} className="rounded-lg px-2 py-1 text-[13px] font-medium text-brand hover:bg-surface">Change</button>
    </div>
  );
}
