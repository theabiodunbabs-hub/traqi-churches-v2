"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, Field, cx, inputCls } from "./ui";

export function GoogleButton({ returnTo, label = "Continue with Google" }: { returnTo: string; label?: string }) {
  const { signInGoogle } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div>
      <button
        type="button" disabled={busy}
        onClick={async () => { setBusy(true); const e = await signInGoogle(returnTo); if (e) { setErr(e); setBusy(false); } }}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-surface text-[15px] font-medium ring-1 ring-line transition hover:ring-ink/25 active:scale-[.99] disabled:opacity-60"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <GoogleMark />}
        {label}
      </button>
      {err && <p className="mt-2 text-sm text-alert" role="alert">{err}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function Divider() {
  return <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>;
}

/** Real sign-in: Google, or email and password. */
export function LiveSignIn({ returnTo = "/login", startMode = "in" }: { returnTo?: string; startMode?: "in" | "up" }) {
  const { signInEmail, signUpEmail, authStatus, authEmail, signOut, syncError } = useStore();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">(startMode);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => { if (authStatus === "ready") router.replace("/today"); }, [authStatus, router]);

  if (authStatus === "loading") return <p className="flex items-center gap-2 text-ink-soft"><Loader2 size={18} className="animate-spin" /> Checking your account…</p>;

  if (authStatus === "no-church") return <GoStart />;

  if (checkEmail) return (
    <div className="rise text-center">
      <MailCheck size={44} className="mx-auto text-brand" />
      <h2 className="mt-4 font-display text-2xl font-semibold">Check your email</h2>
      <p className="mt-2 text-ink-soft">We sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Open it on this device to finish.</p>
    </div>
  );

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter your email address.");
    if (pw.length < (mode === "up" ? 8 : 1)) return setErr(mode === "up" ? "Use at least 8 characters for your password." : "Enter your password.");
    setBusy(true); setErr("");
    const e = mode === "in" ? await signInEmail(email.trim(), pw) : await signUpEmail(email.trim(), pw);
    setBusy(false);
    if (e === "CHECK_EMAIL") return setCheckEmail(true);
    if (e) setErr(e);
  };

  return (
    <div>
      <GoogleButton returnTo={returnTo} />
      <Divider />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Email"><input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="you@example.com" /></Field>
        <Field label="Password" hint={mode === "up" ? "At least 8 characters." : undefined}>
          <input className={inputCls} type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} />
        </Field>
        {(err || syncError) && <p className="text-sm text-alert" role="alert">{err || syncError}</p>}
        <Button variant="primary" type="submit" disabled={busy} className="h-12 w-full text-[15px]">
          {busy && <Loader2 size={16} className="animate-spin" />}{mode === "in" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-soft">
        {mode === "in" ? "No account yet? " : "Already have an account? "}
        <button className={cx("font-medium text-brand")} onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }}>{mode === "in" ? "Create one" : "Sign in"}</button>
      </p>
      {returnTo !== "/signup" && <p className="mt-2 text-center text-sm text-ink-soft">Setting up a new church? <Link href="/signup" className="font-medium text-brand">Start here</Link></p>}
    </div>
  );
}

/** Signed in but not in a church yet: on to "Join or start". */
function GoStart() {
  const router = useRouter();
  useEffect(() => { router.replace("/start"); }, [router]);
  return <p className="flex items-center gap-2 text-ink-soft"><Loader2 size={18} className="animate-spin" /> Taking you to your church…</p>;
}
