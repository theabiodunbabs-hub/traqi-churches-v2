"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button, PageHeader, cx } from "@/components/ui";

/** Plans are tiered by active members. Prices are placeholders until Traqi sets them. */
const PLANS = [
  { name: "Seed", members: "Up to 150 members", points: ["Everything in Traqi", "Email and WhatsApp buttons", "Google Sheets copy"] },
  { name: "Grow", members: "Up to 500 members", points: ["Everything in Seed", "Priority support", "Custom roles"], popular: true },
  { name: "Flourish", members: "Up to 1,500 members", points: ["Everything in Grow", "Help importing your records", "Training for your team"] },
  { name: "Cathedral", members: "1,500+ members", points: ["Everything in Flourish", "Several branches (coming)", "A named contact at Traqi"] },
];

export default function Billing() {
  const { state, access } = useStore();
  const [yearly, setYearly] = useState(true);
  if (!access) return null;
  const members = state.people.filter((p) => !p.isChild && p.stage !== "first_timer").length;
  const fit = members <= 150 ? 0 : members <= 500 ? 1 : members <= 1500 ? 2 : 3;
  return (
    <div>
      <PageHeader title="Plan and billing" sub={`${state.church.name} has ${members} members. Traqi is free during early access, with everything unlocked and nothing to pay.`} />
      <div className="mb-6 inline-flex rounded-xl bg-surface p-1 ring-1 ring-line">
        {[["Monthly", false], ["Yearly, 2 months free", true]].map(([l, v]) => (
          <button key={String(l)} onClick={() => setYearly(v as boolean)} className={cx("rounded-lg px-3.5 py-1.5 text-sm", yearly === v ? "bg-deep text-white" : "text-ink-soft")}>{l as string}</button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p, i) => (
          <div key={p.name} className={cx("flex flex-col rounded-3xl bg-surface p-6 ring-1", i === fit ? "ring-2 ring-brand" : "ring-line")}>
            {i === fit && <span className="mb-3 self-start rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">Fits your church</span>}
            <p className="font-display text-xl font-semibold">{p.name}</p>
            <p className="text-sm text-ink-soft">{p.members}</p>
            <p className="mt-5 font-display text-2xl font-semibold text-muted">Price coming soon</p>
            <p className="text-xs text-muted">{yearly ? "Billed yearly" : "Billed monthly"} in {state.church.currency}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {p.points.map((t) => <li key={t} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-good" />{t}</li>)}
            </ul>
            <Button variant={i === fit ? "primary" : "secondary"} className="mt-6" disabled>Choose {p.name}</Button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">Plans will start after early access. We&apos;ll tell you well in advance, and nothing will be locked.</p>
    </div>
  );
}
