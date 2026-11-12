"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, Mail, MoonStar, PauseCircle, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Button, Empty, PageHeader, Panel, cx, toast } from "@/components/ui";
import { dailyEmail, eventReminderEmail, monthlyEmail, mondayEmail, testEmail } from "@/lib/email/templates";
import { summaryFromState } from "@/lib/email/from-state";

const KINDS = [
  { k: "daily", name: "Daily email", when: "Every day at 7:00 AM", who: "Pastors, admin, and anyone who follows up or updates people" },
  { k: "monday", name: "Monday summary", when: "Mondays at 7:00 AM", who: "The lead pastor" },
  { k: "monthly", name: "Month-end report", when: "Last day of the month at 8:00 PM", who: "The lead pastor and admin" },
  { k: "event", name: "Event reminders", when: "7:00 AM, on the days you choose for each event", who: "People who registered with an email" },
] as const;
type K = (typeof KINDS)[number]["k"];

/** Email: what goes out, when, a preview of each, and a test. Sending stays off until it's switched on in Vercel. */
export default function EmailSettings() {
  const { state, access, me, mode } = useStore();
  const [on, setOn] = useState<boolean | null>(null);
  const [pick, setPick] = useState<K>("monday");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (mode === "live") fetch("/api/email/test").then((r) => r.json()).then((x) => setOn(!!x.sendingOn)).catch(() => setOn(false)); else setOn(false); }, [mode]);
  const base = typeof window !== "undefined" ? location.origin : "https://traqi.space";
  const mail = useMemo(() => {
    const s = summaryFromState(state);
    const name = me?.firstName ?? "Pastor";
    const ev = state.events.find((e) => e.status === "published");
    return pick === "daily" ? dailyEmail(s, base, name) : pick === "monday" ? mondayEmail(s, base, name) : pick === "monthly" ? monthlyEmail(s, base, name)
      : ev ? eventReminderEmail(s.church, base, { ...ev, theme: ev.theme ?? ev.tagline }, me ? `${me.firstName} ${me.lastName}` : "Ada Obi", "RISE-7KQ2PM") : testEmail(s, base, name);
  }, [state, pick, me, base]);
  if (!access || !me) return null;
  if (!access.isLead && !access.can("roles.manage")) return <Empty title="For the lead pastor and admin" body="Email settings are managed by the church's leaders." />;

  const test = async () => {
    if (mode !== "live" || !supabase) return toast("In this preview, emails can't be sent. The preview below shows what it looks like.");
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/email/test", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify({ churchId: state.church.id }) });
      const x = await r.json();
      if (!r.ok) toast(x.error ?? "That didn't work");
      else toast(x.status === "sent" ? `Sent to ${x.to}` : x.status === "skipped" ? "Sending is off, so nothing went out. It was recorded in the log." : `Not sent: ${x.status}`);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Email" sub="The emails Traqi sends for your church, and when. All times are Lagos time." actions={<Button onClick={test} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send me a test</Button>} />
      <div className={cx("mb-6 flex items-start gap-3 rounded-2xl p-4 ring-1", on ? "bg-good-soft ring-good/30" : "bg-glow-soft ring-glow/30")}>
        {on ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-good" /> : <PauseCircle size={20} className="mt-0.5 shrink-0 text-glow-ink" />}
        <div className="text-[14.5px]">
          {on === null ? "Checking…" : on ? <><b>Sending is on.</b> Emails go out through Resend. The free plan allows 100 a day; Traqi stops before that and records anything held back.</>
            : <><b>Sending is off.</b> Everything is built and scheduled, but nothing goes out until it&apos;s switched on in Vercel (EMAIL_SENDING=on with your Resend key). Until then, each email is recorded as &ldquo;skipped&rdquo; so you can see it would have gone.</>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-2">
          {KINDS.map((x) => (
            <button key={x.k} onClick={() => setPick(x.k)} className={cx("flex w-full gap-3 rounded-2xl p-4 text-left ring-1 transition", pick === x.k ? "bg-surface shadow-sm ring-2 ring-brand" : "bg-surface/60 ring-line hover:bg-surface")}>
              <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl", pick === x.k ? "bg-brand text-white" : "bg-page text-ink-soft")}><Mail size={18} /></span>
              <span className="min-w-0"><b className="block text-[15px]">{x.name}</b><span className="flex items-center gap-1 text-[13px] text-ink-soft"><CalendarClock size={12} />{x.when}</span><span className="mt-0.5 block text-[12.5px] text-muted">{x.who}</span></span>
            </button>
          ))}
          <p className="flex items-center gap-2 px-1 pt-2 text-[13px] text-muted"><MoonStar size={14} /> Nothing is sent between 10:00 PM and 6:00 AM.</p>
          <p className="px-1 text-[13px] text-muted">Each person can switch these off from Messages, then &ldquo;How Traqi reaches you&rdquo;.</p>
        </div>
        <Panel title={<span className="truncate">Preview: {mail.subject}</span>}>
          <iframe title="Email preview" srcDoc={mail.html} className="h-[640px] w-full rounded-xl bg-[#f4f3f8] ring-1 ring-line" sandbox="" />
        </Panel>
      </div>
    </div>
  );
}
