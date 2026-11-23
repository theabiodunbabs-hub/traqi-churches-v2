"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { PERSONAS } from "@/lib/seed";
import { STAGES_NOW, fullName } from "@/lib/format";
import { Avatar, Button, Field, cx, inputCls } from "@/components/ui";
import { LiveSignIn } from "@/components/auth";

export default function Login() {
  const { signIn, person, state, resetDemo, mode } = useStore();
  const router = useRouter();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const enter = (personId: string) => { signIn(personId); router.push("/today"); };
  const isDemo = state.church.slug === "heirs";

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* The journey, as a picture: six bands deepening from first visit to leadership */}
      <section className="relative hidden overflow-hidden bg-deep p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-surface font-display text-lg font-bold text-ink">t</span>
          <span className="font-display text-lg font-semibold">Traqi for Churches</span>
        </div>
        <div className="mt-auto">
          <div className="mb-10 space-y-2.5" aria-hidden>
            {STAGES_NOW().map((s, i) => (
              <div key={s.key} className="rise flex items-center gap-4" style={{ animationDelay: `${i * 90}ms` }}>
                <span className={cx("h-10 rounded-full", s.tone)} style={{ width: `${34 + i * 12}%` }} />
                <span className="text-sm text-white/70">{s.label}</span>
              </div>
            ))}
          </div>
          <h1 className="max-w-md font-display text-[44px] font-semibold leading-[1.05] tracking-tight">
            Know every person, from their first visit to the day they lead.
          </h1>
          <p className="mt-4 max-w-md text-[17px] text-white/70">
            Follow up first-timers within 48 hours, see who has gone quiet, and give every pastor a clear view of the people in their care.
          </p>
        </div>
      </section>

      <section className="flex min-w-0 items-center justify-center px-5 py-10">
        <div className="w-full min-w-0 max-w-md">
          <div className="mb-8 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-deep font-display text-xl font-bold text-white">t</span>
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">{mode === "live" ? "Welcome to Traqi" : `Sign in to ${state.church.name}`}</h2>
          <p className="mt-1.5 text-ink-soft">{mode === "live" ? "Sign in with Google or your email." : "Use your phone number or email."}</p>

          <LocalNotice live={mode === "live"} />
          {mode === "live" ? <div className="mt-8"><LiveSignIn /></div> : (
          <>
          <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); setErr("This is the demo. Choose a person below to sign in."); }}>
            <Field label="Phone or email"><input className={inputCls} value={id} onChange={(e) => { setId(e.target.value); setErr(null); }} placeholder="0803 123 4567" /></Field>
            <Field label="Password"><input type="password" className={inputCls} value={pw} onChange={(e) => { setPw(e.target.value); setErr(null); }} /></Field>
            {err && <p className="text-sm text-glow-ink" role="alert">{err}</p>}
            <Button variant="primary" type="submit" className="w-full py-3">Sign in</Button>
          </form>

          <div className="mt-10">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-display text-lg font-semibold">Try it as</p>
              <p className="text-xs text-muted">{`Demo data for ${state.church.name}`}</p>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              {(isDemo ? PERSONAS : state.assignments.map((a) => ({ id: a.personId, label: state.roles.find((r) => r.id === a.roleId)?.name ?? "", note: "Your church" })))
                .filter((p, i, arr) => person(p.id) && arr.findIndex((x) => x.id === p.id) === i).map((p) => {
                const who = person(p.id);
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => enter(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-soft/60">
                      <Avatar person={who} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium">{fullName(who)}</span>
                        <span className="block truncate text-[13px] text-muted">{p.label}: {p.note.charAt(0).toLowerCase() + p.note.slice(1)}</span>
                      </span>
                      <ChevronRight size={16} className="text-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 rounded-2xl bg-surface p-5 ring-1 ring-line">
              <p className="font-display text-lg font-semibold">New to Traqi?</p>
              <p className="mt-1 text-sm text-ink-soft">Join your church in seconds, or set up a new church. Free during early access.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => router.push("/join")}>Join a church</Button>
                <Button onClick={() => router.push("/signup")}>Start a church</Button>
                {!isDemo && <Button onClick={() => resetDemo()}>Back to the Heirs Church demo</Button>}
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Only on your laptop (localhost): says which data you are signing in to.
 * Live: real accounts on Supabase, so type a test login or your own. Demo: the .env.local settings are missing.
 */
function LocalNotice({ live }: { live: boolean }) {
  const [local, setLocal] = useState(false);
  useEffect(() => { setLocal(["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)); }, []);
  if (!local) return null;
  return live ? (
    <div className="mt-5 rounded-2xl bg-good-soft px-4 py-3 text-[13.5px] text-good ring-1 ring-good/20">
      <p className="font-semibold">Localhost, real data</p>
      <p className="mt-0.5 text-ink-soft">You are signing in to your Supabase database. Type your own email and password, or a test login from <code className="rounded bg-surface px-1">traqi-demo-church-logins.json</code> (password <code className="rounded bg-surface px-1">Graceville@2026</code>), or use Google.</p>
    </div>
  ) : (
    <div className="mt-5 rounded-2xl bg-glow-soft px-4 py-3 text-[13.5px] text-glow-ink ring-1 ring-glow/30" role="status">
      <p className="font-semibold">Localhost is on demo data</p>
      <p className="mt-0.5">To sign in with real accounts, put your Supabase publishable key in <code className="rounded bg-surface px-1">.env.local</code> (<code className="rounded bg-surface px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>), then stop and start <code className="rounded bg-surface px-1">npm run dev</code>.</p>
    </div>
  );
}
