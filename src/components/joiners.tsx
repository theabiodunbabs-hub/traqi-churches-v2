"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, GitMerge, UserX } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar, Badge, Button, Sheet, toast } from "./ui";
import { daysSinceJoined, isUnconfirmed } from "@/lib/domain";
import { fullName, shortDate } from "@/lib/format";

/** The admin's list of people who joined from search: confirm, merge with an existing record, or remove. */
export function JoinersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, confirmPeople, mergeJoiner, updatePerson } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const list = state.people.filter(isUnconfirmed).sort((a, b) => a.firstVisit.localeCompare(b.firstVisit));
  return (
    <Sheet open={open} onClose={onClose} title="New people who joined">
      {list.length === 0 ? <p className="py-8 text-center text-ink-soft">Everyone is confirmed.</p> : (
        <>
          <p className="mb-4 text-[14px] text-ink-soft">They joined from Traqi search and can already use Traqi as members. Confirm the people you know; merge anyone you already had on record.</p>
          <Button variant="primary" className="mb-4 w-full" onClick={() => { confirmPeople(list.filter((p) => !p.possibleMatchId).map((p) => p.id)); toast("Confirmed"); }}><Check size={15} /> Confirm everyone without a possible match</Button>
          <ul className="space-y-2.5">
            {list.map((p) => {
              const match = p.possibleMatchId ? state.people.find((x) => x.id === p.possibleMatchId) : undefined;
              const days = daysSinceJoined(p);
              return (
                <li key={p.id} className="rounded-2xl bg-page p-3 ring-1 ring-line">
                  <div className="flex items-center gap-3">
                    <Avatar person={p} size={40} />
                    <span className="min-w-0 flex-1">
                      <Link href={`/people/${p.id}`} className="block font-medium hover:text-brand">{fullName(p)}</Link>
                      <span className="text-[12.5px] text-muted">{p.phone} · joined {shortDate(p.firstVisit)}</span>
                    </span>
                    {days >= 60 && <Badge tone={days >= 90 ? "alert" : "glow"}>{days >= 90 ? "Paused" : `${days} days`}</Badge>}
                  </div>
                  {match && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-glow-soft p-2.5 text-[13px] text-glow-ink">
                      <GitMerge size={15} /> <span className="flex-1">Same phone as <b>{fullName(match)}</b>, already in your records{match.firstVisit ? ` since ${shortDate(match.firstVisit)}` : ""}.</span>
                      <Button disabled={busy === p.id} onClick={async () => { setBusy(p.id); try { await mergeJoiner(p.id, match.id); toast(`Merged into ${match.firstName}'s record`); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't merge"); } setBusy(null); }}>Same person: merge</Button>
                    </div>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <Button onClick={() => { confirmPeople([p.id]); toast(`${p.firstName} confirmed`); }}><Check size={15} /> {match ? "Different person: confirm" : "Confirm"}</Button>
                    <Button variant="ghost" className="text-alert" onClick={() => { updatePerson(p.id, { inactive: { reason: "other", note: "Not recognised by the church", at: new Date().toISOString() } }); toast(`${p.firstName} removed`); }}><UserX size={15} /> Not ours</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Sheet>
  );
}
