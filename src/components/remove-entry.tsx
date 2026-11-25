"use client";

import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Button, Field, Sheet, cx, inputCls, toast } from "./ui";
import { digits, fullName, shortDate } from "@/lib/format";
import type { Person } from "@/lib/types";

export const REMOVE_REASONS = ["It's a test entry", "Double entry", "Not a real person", "They asked to be removed", "Other"] as const;
/** Removed entries are kept this long, so a mistake can be undone. */
export const KEEP_REMOVED_DAYS = 30;

/**
 * Remove a first-timer entry, with a reason that is always kept.
 * For a double entry, they choose which record stays.
 */
export function RemoveEntrySheet({ person, open, onClose, onRemoved }: { person: Person; open: boolean; onClose: () => void; onRemoved?: () => void }) {
  const { state, removePerson } = useStore();
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [keep, setKeep] = useState("");
  // Likely copies: same phone, or the same name
  const twins = state.people.filter((x) => x.id !== person.id && ((digits(x.phone).length >= 10 && digits(x.phone).slice(-10) === digits(person.phone).slice(-10))
    || (x.firstName.trim().toLowerCase() === person.firstName.trim().toLowerCase() && x.lastName.trim().toLowerCase() === person.lastName.trim().toLowerCase())));
  const go = () => {
    if (!reason) return toast("Choose a reason");
    if (reason === "Other" && !note.trim()) return toast("Write the reason");
    const kept = twins.find((x) => x.id === keep);
    removePerson(person.id, reason, [kept ? `kept ${fullName(kept)}'s record` : "", note.trim()].filter(Boolean).join("; "));
    toast(`${person.firstName} removed. You can restore them for ${KEEP_REMOVED_DAYS} days from People › Removed.`);
    onClose(); onRemoved?.();
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Remove ${fullName(person)}?`}>
      <p className="text-[14px] text-ink-soft">They disappear from every list, report and follow-up queue now. The entry is kept for {KEEP_REMOVED_DAYS} days in case it was a mistake, and the reason is always kept.</p>
      <div role="radiogroup" aria-label="Reason" className="mt-4 grid gap-2">
        {REMOVE_REASONS.map((r) => (
          <button type="button" role="radio" aria-checked={reason === r} key={r} onClick={() => setReason(r)}
            className={cx("rounded-xl px-4 py-3 text-left text-[14.5px] ring-1 transition", reason === r ? "bg-brand-soft font-medium text-brand ring-2 ring-brand" : "bg-page ring-line")}>{r}</button>
        ))}
      </div>
      {reason === "Double entry" && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Which record stays?</p>
          {twins.length ? (
            <div className="grid gap-2">{twins.map((x) => (
              <button type="button" key={x.id} onClick={() => setKeep(x.id)} className={cx("flex items-center gap-3 rounded-xl p-3 text-left ring-1", keep === x.id ? "bg-brand-soft ring-2 ring-brand" : "bg-page ring-line")}>
                <Avatar person={x} size={34} /><span className="min-w-0 flex-1"><b className="block text-[14px] font-medium">{fullName(x)}</b><span className="text-[12.5px] text-muted">{x.phone} · first visit {shortDate(x.firstVisit)}</span></span>
              </button>
            ))}</div>
          ) : <p className="text-[13.5px] text-muted">No other record with the same phone or name. Add a note about which record stays.</p>}
        </div>
      )}
      {reason && <Field label={reason === "Other" ? "The reason" : "Note (optional)"}><textarea className={cx(inputCls, "min-h-16")} value={note} onChange={(e) => setNote(e.target.value)} /></Field>}
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button variant="primary" className="flex-1 bg-alert" onClick={go}><Trash2 size={15} /> Remove</Button>
      </div>
    </Sheet>
  );
}

/** People › Removed: the last 30 days of removed entries, with who removed them, why, and Restore. */
export function RemovedSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, removedPeople, restorePerson } = useStore();
  const name = (id?: string) => state.people.find((p) => p.id === id)?.firstName ?? "Someone";
  const list = [...removedPeople].sort((a, b) => (b.removed?.at ?? "").localeCompare(a.removed?.at ?? ""));
  return (
    <Sheet open={open} onClose={onClose} title="Removed entries">
      {list.length === 0 ? <p className="py-8 text-center text-ink-soft">Nothing removed in the last {KEEP_REMOVED_DAYS} days.</p> : (
        <ul className="space-y-2.5">{list.map((p) => {
          const left = Math.max(0, KEEP_REMOVED_DAYS - Math.floor((Date.now() - Date.parse(p.removed!.at)) / 864e5));
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-page p-3 ring-1 ring-line">
              <Avatar person={p} size={38} />
              <span className="min-w-0 flex-1">
                <b className="block text-[14.5px] font-medium">{fullName(p)}</b>
                <span className="block text-[12.5px] text-muted">{p.removed!.reason}{p.removed!.note ? `: ${p.removed!.note}` : ""}</span>
                <span className="block text-[12px] text-muted">By {name(p.removed!.byId)}, {shortDate(p.removed!.at.slice(0, 10))} · gone for good in {left} days</span>
              </span>
              <Button onClick={() => { restorePerson(p.id); toast(`${p.firstName} restored`); }}><RotateCcw size={14} /> Restore</Button>
            </li>
          );
        })}</ul>
      )}
    </Sheet>
  );
}
