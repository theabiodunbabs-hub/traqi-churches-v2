"use client";

import { MapPin, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { teamLoad } from "@/lib/metrics";
import { fullName } from "@/lib/format";
import { Avatar, Sheet, cx } from "./ui";

/** Pick who follows up a first-timer: lightest load first, neighbours on top. */
export function AssignPicker({ caseId, open, onClose }: { caseId: string | null; open: boolean; onClose: () => void }) {
  const { state, person, assignCase } = useStore();
  const c = state.cases.find((x) => x.id === caseId);
  const p = person(c?.personId);
  if (!c || !p) return null;
  const team = teamLoad(state, p);
  return (
    <Sheet open={open} onClose={onClose} title={`Who will reach ${p.firstName}?`}>
      <p className="mb-4 text-sm text-ink-soft">
        {p.location ? <>{p.firstName} lives in <span className="font-medium text-ink">{p.location}</span>. </> : null}
        People with the fewest open follow-ups are listed first.
      </p>
      <ul className="space-y-2">
        {team.map((t, i) => (
          <li key={t.person.id}>
            <button
              onClick={() => { assignCase(c.id, t.person.id); onClose(); }}
              className={cx("flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 transition hover:ring-brand/50",
                c.assigneeId === t.person.id ? "bg-brand-soft ring-brand" : "bg-surface ring-line")}
            >
              <Avatar person={t.person} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium">
                  {fullName(t.person)}
                  {i === 0 && <span className="inline-flex items-center gap-1 rounded-md bg-glow-soft px-1.5 text-[11px] font-semibold text-glow-ink"><Sparkles size={11} /> Suggested</span>}
                </span>
                <span className="mt-0.5 flex items-center gap-3 text-[13px] text-muted">
                  <span>{t.open === 0 ? "Free" : `${t.open} open`}</span>
                  {t.person.location && <span className={cx("flex items-center gap-1", t.near && "font-medium text-good")}><MapPin size={12} />{t.person.location}</span>}
                </span>
              </span>
              <LoadBar n={t.open} />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function LoadBar({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={cx("h-5 w-1.5 rounded-full", i < n ? (n >= 4 ? "bg-alert" : "bg-j4") : "bg-line")} />)}
    </span>
  );
}
