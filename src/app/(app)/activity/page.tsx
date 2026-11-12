"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Avatar, Empty, PageHeader, cx, inputCls } from "@/components/ui";
import { fullName } from "@/lib/format";

const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(new Date(iso));
const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso));

export default function Activity() {
  const { state, access, person } = useStore();
  const [who, setWho] = useState("");
  const [q, setQ] = useState("");

  const actors = useMemo(() => [...new Set(state.activity.map((a) => a.actorId))].map((id) => person(id)).filter(Boolean), [state.activity, person]);
  const days = useMemo(() => {
    const list = state.activity.filter((a) => (!who || a.actorId === who) && (!q || a.text.toLowerCase().includes(q.toLowerCase())));
    const m = new Map<string, typeof list>();
    list.forEach((a) => { const k = dayKey(a.at); m.set(k, [...(m.get(k) ?? []), a]); });
    return [...m.entries()];
  }, [state.activity, who, q]);

  if (!access) return null;
  if (!access.can("activity.view")) return <Empty title="Not available" body="Only the lead pastor and admin can see the activity log." />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Activity log" sub="Every change anyone makes in Traqi, in Lagos time. Entries can't be edited or deleted." />
      <div className="mb-6 flex flex-wrap gap-2">
        <input className={cx(inputCls, "max-w-xs")} placeholder="Search what happened" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={cx(inputCls, "max-w-[220px]")} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter by person">
          <option value="">Everyone</option>
          {actors.map((p) => <option key={p!.id} value={p!.id}>{fullName(p)}</option>)}
        </select>
      </div>

      {days.length === 0 ? <Empty title="Nothing matches" body="Try a different word or person." /> : days.map(([day, items]) => (
        <section key={day} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-ink-soft">{day}</h2>
          <ol className="relative space-y-1 border-l border-line pl-6">
            {items.map((a) => (
              <li key={a.id} className="relative rounded-xl py-2">
                <span className="absolute -left-[37px] top-2 rounded-full ring-4 ring-page"><Avatar person={person(a.actorId)} size={26} /></span>
                <p className="text-[15px]"><span className="font-medium">{fullName(person(a.actorId))}</span> <span className="text-ink-soft">{a.text}</span></p>
                <p className="text-xs text-muted">{timeOf(a.at)}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
