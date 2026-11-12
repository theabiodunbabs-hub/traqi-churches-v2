"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Church, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { OnboardFrame } from "@/components/onboarding";

/** After signing in without a church: join yours, or start a new one. */
export default function Start() {
  const { mode, authStatus, authEmail, signOut } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (mode !== "live") return;
    if (authStatus === "signed-out") router.replace("/login");
    if (authStatus === "ready") router.replace("/today");
  }, [mode, authStatus, router]);

  return (
    <OnboardFrame title="Welcome to Traqi. Let's get you to your church." points={["Find your church in seconds", "Check in, join classes and register for events", "Or set up your own church in about two minutes"]}>
      <h2 className="font-display text-[32px] leading-tight">What would you like to do?</h2>
      {authEmail && <p className="mt-1.5 text-ink-soft">Signed in as <b className="font-medium text-ink">{authEmail}</b></p>}
      <div className="mt-8 grid gap-3">
        <Link href="/join" className="card card-hover group flex items-center gap-4 p-5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30"><Search size={24} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[20px]">Join my church</span>
            <span className="mt-0.5 block text-[14px] text-ink-soft">Find your church and you&apos;re in straight away.</span>
          </span>
          <ArrowRight size={20} className="text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
        </Link>
        <Link href="/signup" className="card card-hover group flex items-center gap-4 p-5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-deep text-white"><Church size={24} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[20px]">Start a new church</span>
            <span className="mt-0.5 block text-[14px] text-ink-soft">I&apos;m a pastor or church admin.</span>
          </span>
          <ArrowRight size={20} className="text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
        </Link>
      </div>
      <p className="mt-6 text-[13.5px] text-muted">Have an invite link from your church? Open it on this device instead; it sets up your role too.</p>
      {mode === "live" && <button onClick={() => { signOut(); router.push("/login"); }} className="mt-4 text-sm font-medium text-brand">Use a different account</button>}
    </OnboardFrame>
  );
}
