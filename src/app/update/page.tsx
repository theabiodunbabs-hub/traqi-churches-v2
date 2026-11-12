"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Field, inputCls } from "@/components/ui";
import { Consent, PublicFrame } from "@/components/public";
import type { Person } from "@/lib/types";

/**
 * The church-wide "update your details" link. People confirm their phone,
 * then fill in what's missing. In the live app the code goes out by SMS or WhatsApp.
 */
export default function UpdateDetails() {
  const { ready, state, findByPhone, updatePerson, mode } = useStore();
  const church = state.church.name;
  const [step, setStep] = useState<"phone" | "code" | "form" | "done">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [who, setWho] = useState<Person | null>(null);
  const [f, setF] = useState<Partial<Person>>({});
  const [agree, setAgree] = useState(false);
  const demoCode = useMemo(() => String(1000 + Math.floor(Math.random() * 9000)), []);
  if (!ready) return null;
  if (mode === "live") return (
    <PublicFrame church={state.church.name || "Traqi for Churches"}>
      <div className="rise rounded-3xl bg-surface p-6 text-center shadow-xl shadow-ink/5 ring-1 ring-line md:p-8">
        <h1 className="font-display text-[26px] font-semibold tracking-tight">Update your details</h1>
        <p className="mt-2 text-ink-soft">Sign in with Google, or with the email your church has for you. You&apos;ll go straight to your profile, where you can fill in anything missing.</p>
        <a href="/login" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 font-medium text-white">Sign in</a>
        <p className="mt-4 text-sm text-muted">Codes by text message are coming soon.</p>
      </div>
    </PublicFrame>
  );

  const field = (k: keyof Person, label: string, props: Record<string, string> = {}) => (
    <Field label={label}><input className={inputCls} value={(f[k] as string) ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></Field>
  );

  return (
    <PublicFrame church={church}>
      <div className="rise rounded-3xl bg-surface p-6 shadow-xl shadow-ink/5 ring-1 ring-line md:p-8">
        {step === "phone" && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const p = findByPhone(phone);
            if (!p) return setErr(`We couldn't find that number at ${church}. Check it, or speak to the admin desk on Sunday.`);
            setWho(p); setF({ ...p }); setStep("code"); setErr("");
          }}>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Keep your details up to date</h1>
            <p className="mt-1.5 text-ink-soft">Enter the phone number {church} has for you. We&apos;ll send a short code to confirm it&apos;s you.</p>
            <div className="mt-6"><Field label="Phone number"><input className={inputCls} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setErr(""); }} placeholder="0803 123 4567" /></Field></div>
            {err && <p className="mt-3 text-sm text-alert" role="alert">{err}</p>}
            <Button variant="primary" type="submit" className="mt-5 h-12 w-full text-[16px]">Send code</Button>
          </form>
        )}

        {step === "code" && who && (
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim() !== demoCode) return setErr("That code doesn't match. Try again."); setStep("form"); setErr(""); }}>
            <h1 className="font-display text-[26px] font-semibold tracking-tight">Enter your code</h1>
            <p className="mt-1.5 text-ink-soft">We sent a 4-digit code to the number ending {who.phone.slice(-4)}.</p>
            <p className="mt-3 rounded-xl bg-glow-soft px-3 py-2 text-sm text-glow-ink">Demo only: your code is <span className="font-semibold">{demoCode}</span>.</p>
            <input className={`${inputCls} mt-5 text-center text-2xl tracking-[.5em]`} inputMode="numeric" maxLength={4} autoFocus value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }} aria-label="Code" />
            {err && <p className="mt-3 text-sm text-alert" role="alert">{err}</p>}
            <Button variant="primary" type="submit" className="mt-5 h-12 w-full text-[16px]">Confirm</Button>
          </form>
        )}

        {step === "form" && who && (
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (!agree) return setErr("Please tick the box so we can keep your details.");
            const patch = Object.fromEntries(Object.entries(f).filter(([k, v]) => ["whatsapp", "email", "birthday", "location", "occupation"].includes(k) && v !== (who as Record<string, unknown>)[k])) as Partial<Person>;
            updatePerson(who.id, { ...patch, consent: { at: new Date().toISOString(), via: "update-link" } }, "self");
            setStep("done");
          }}>
            <h1 className="font-display text-[26px] font-semibold tracking-tight">Hi {who.firstName}</h1>
            <p className="-mt-2 text-ink-soft">Check what we have and fill in anything missing.</p>
            {field("whatsapp", "WhatsApp number", { inputMode: "tel" })}
            {field("email", "Email", { type: "email", autoComplete: "email" })}
            {field("birthday", "Birthday (day, month and year)", { type: "date" })}
            <div className="grid grid-cols-2 gap-3">
              {field("location", "Area you live in")}
              {field("occupation", "Occupation")}
            </div>
            <Consent church={church} checked={agree} onChange={(v) => { setAgree(v); setErr(""); }} />
            {err && <p className="text-sm text-alert" role="alert">{err}</p>}
            <Button variant="primary" type="submit" className="h-12 w-full text-[16px]">Save my details</Button>
          </form>
        )}

        {step === "done" && (
          <div className="py-6 text-center">
            <CheckCircle2 size={48} className="mx-auto text-good" />
            <h1 className="mt-4 font-display text-[26px] font-semibold tracking-tight">Thank you, {who?.firstName}</h1>
            <p className="mt-2 text-ink-soft">Your details are saved. You can use this link again any time something changes.</p>
          </div>
        )}
      </div>
    </PublicFrame>
  );
}
