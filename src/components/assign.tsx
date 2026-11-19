"use client";

import { useState } from "react";
import { MapPin, MessageSquarePlus, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { teamLoad } from "@/lib/metrics";
import { fullName } from "@/lib/format";
import { Avatar, Button, Field, Sheet, cx, inputCls, toast } from "./ui";

/** Pick who follows up a first-timer: lightest load first, neighbours on top. */
export function AssignPicker({ caseId, open, onClose }: { caseId: string | null; open: boolean; onClose: () => void }) {
  const { state, person, assignCase, toggleHelper, access } = useStore();
  const c = state.cases.find((x) => x.id === caseId);
  const p = person(c?.personId);
  if (!c || !p) return null;
  const team = teamLoad(state, p);
  return (
    <Sheet open={open} onClose={onClose} title={`Who will reach ${p.firstName}?`}>
      <p className="mb-4 text-sm text-ink-soft">
        {p.location ? <>{p.firstName} lives in <span className="font-medium text-ink">{p.location}</span>. </> : null}
        Best matches first: same gender, living nearby, coming to church regularly, and not too busy.
        {c.assigneeId && access?.assignsCases ? " Tap Helper to have someone else follow up too." : ""}
      </p>
      <ul className="space-y-2">
        {team.map((t, i) => (
          <li key={t.person.id} className="flex items-center gap-2">
            <button type="button"
              onClick={() => { assignCase(c.id, t.person.id); onClose(); }}
              className={cx("flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 transition hover:ring-brand/50",
                c.assigneeId === t.person.id ? "bg-brand-soft ring-brand" : "bg-surface ring-line")}
            >
              <Avatar person={t.person} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium">
                  {fullName(t.person)}
                  {i === 0 && <span className="inline-flex items-center gap-1 rounded-md bg-glow-soft px-1.5 text-[12px] font-semibold text-glow-ink"><Sparkles size={11} /> Suggested</span>}
                </span>
                <span className="mt-0.5 flex items-center gap-3 text-[13px] text-muted">
                  <span>{t.open === 0 ? "Free" : `${t.open} open`}</span>
                  {t.person.location && <span className={cx("flex items-center gap-1", t.near && "font-medium text-good")}><MapPin size={12} />{t.person.location}</span>}
                </span>
              </span>
              <LoadBar n={t.open} />
            </button>
            {c.assigneeId && c.assigneeId !== t.person.id && access?.assignsCases && (
              <button type="button" onClick={() => toggleHelper(c.id, t.person.id)} className={cx("min-h-11 shrink-0 rounded-xl px-3 text-[13px] font-medium ring-1", c.helperIds?.includes(t.person.id) ? "bg-brand text-white ring-brand" : "bg-surface text-brand ring-line")}>
                {c.helperIds?.includes(t.person.id) ? "Helping" : "Helper"}
              </button>
            )}
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

/** Anyone following up logs what happened, so everyone sees where things stand with this person. */
export function LogFeedback({ caseId, name, className }: { caseId: string; name: string; className?: string }) {
  const { logContact } = useStore();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"call" | "whatsapp" | "visit">("call");
  const [reached, setReached] = useState(true);
  const [text, setText] = useState("");
  const save = () => { if (!text.trim()) return; logContact(caseId, { method, outcome: text.trim(), reached }); setOpen(false); setText(""); toast("Feedback logged"); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-brand hover:bg-brand-soft"}><MessageSquarePlus size={14} /> Log</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`What happened with ${name}?`} footer={<Button variant="primary" className="w-full py-3" disabled={!text.trim()} onClick={save}>Save feedback</Button>}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1.5">{(["call", "whatsapp", "visit"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setMethod(m)} className={cx("min-h-11 rounded-xl text-sm ring-1", method === m ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{m === "call" ? "Call" : m === "whatsapp" ? "WhatsApp" : "Visit"}</button>
          ))}</div>
          <div className="grid grid-cols-2 gap-1.5">{([[true, "Reached them"], [false, "Couldn't reach"]] as const).map(([v, l]) => (
            <button type="button" key={l} onClick={() => setReached(v)} className={cx("min-h-11 rounded-xl text-sm ring-1", reached === v ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-page ring-line")}>{l}</button>
          ))}</div>
          <Field label="What they said"><textarea autoFocus className={cx(inputCls, "min-h-28")} value={text} onChange={(e) => setText(e.target.value)} placeholder="Happy to come on Sunday with her sister. Asked about the youth programme." /></Field>
          <p className="text-[12.5px] text-muted">Everyone following up {name} sees this, so nobody calls twice with the same question.</p>
        </div>
      </Sheet>
    </>
  );
}
