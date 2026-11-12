"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { redeemInvite } from "@/lib/live";
import { Button } from "@/components/ui";
import { ChurchMark, Logo } from "@/components/brand";
import { LiveSignIn } from "@/components/auth";
import { fullName } from "@/lib/format";

/**
 * An invite link from the church: whoever opens it signs in with any Google account or email,
 * and that account is linked to their person in the church. No email matching needed.
 */
export default function Invite() {
  const { token } = useParams<{ token: string }>();
  const { ready, mode, state, authStatus, signIn, put, reload } = useStore();
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Live: once signed in, link the account and load the church.
  useEffect(() => {
    if (mode !== "live" || authStatus !== "no-church" || busy) return;
    setBusy(true);
    redeemInvite(token).then((e) => { if (e) { setErr(e); setBusy(false); } else { reload(); router.replace("/today"); } });
  }, [mode, authStatus, token, busy, reload, router]);
  useEffect(() => { if (mode === "live" && authStatus === "ready") router.replace("/today"); }, [mode, authStatus, router]);

  if (!ready) return null;
  const inv = mode === "demo" ? state.invites.find((i) => i.token === token) : undefined;
  const person = inv && state.people.find((p) => p.id === inv.personId);
  const by = inv && state.people.find((p) => p.id === inv.byId);
  const role = inv?.roleId && state.roles.find((r) => r.id === inv.roleId);

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4 py-10" style={{ background: "radial-gradient(800px 400px at 80% -10%, rgb(79 70 229 / .14), transparent 60%), #f5f5fa" }}>
      <div className="rise w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card overflow-hidden">
          <div className="hero rounded-none px-6 pb-6 pt-7 text-center">
            <div className="flex justify-center"><ChurchMark church={state.church.name ? state.church : { name: "Church", profile: undefined }} size={56} className="ring-4 ring-white/15" /></div>
            <p className="mt-4 font-display text-2xl font-semibold">{person ? `${person.firstName}, you're invited` : "You're invited"}</p>
            <p className="mt-1 text-white/70">{by ? `${fullName(by)} invited you to ${state.church.name} on Traqi` : "Join your church on Traqi"}{role ? ` as ${role.name}` : ""}.</p>
          </div>
          <div className="p-6">
            {mode === "demo" ? (
              !inv ? <p className="text-center text-ink-soft">This invite link isn&apos;t valid. Ask your church admin for a new one.</p> : (
                <>
                  <ul className="mb-5 space-y-2 text-[14px] text-ink-soft">
                    <li className="flex gap-2"><ShieldCheck size={17} className="shrink-0 text-good" /> Sign in with any Google account or email.</li>
                    <li className="flex gap-2"><ShieldCheck size={17} className="shrink-0 text-good" /> You&apos;ll only see what your role allows.</li>
                  </ul>
                  <Button variant="primary" className="w-full py-3" onClick={() => { put("invites", { ...inv, usedAt: inv.usedAt ?? new Date().toISOString() }, "joined Traqi with an invite link"); signIn(inv.personId); router.push("/today"); }}>Accept and continue</Button>
                </>
              )
            ) : authStatus === "signed-out" ? (
              <LiveSignIn returnTo={`/invite/${token}`} />
            ) : err ? (
              <div className="text-center"><p className="font-semibold text-alert">{err}</p><p className="mt-2 text-sm text-ink-soft">Ask your church admin for a new invite link.</p></div>
            ) : (
              <p className="flex items-center justify-center gap-2 text-ink-soft"><Loader2 size={18} className="animate-spin" /> Linking your account…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
