"use client";

import { copyText } from "@/lib/share";

import { useMemo, useState } from "react";
import { Check, ClipboardCheck, Copy, Link2, RefreshCw, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { liveDesk, newLinkToken, storeDesk, type DoorEvent } from "@/lib/checkin";
import { DUTY_LABEL, managesTeams, teamOf } from "@/lib/event-mgmt";
import { daysOf } from "@/lib/events";
import { fullName } from "@/lib/format";
import type { ChurchEvent, DutyTeam, EventDuty, Registration } from "@/lib/types";
import { Avatar, Badge, Button, Panel, Toggle, cx, toast } from "./ui";
import { CheckinDesk } from "./checkin-desk";
import { PeopleAdder } from "./people-adder";
import { WhatsAppIcon } from "./care";

export const doorEvent = (e: ChurchEvent, churchName: string, churchId?: string): DoorEvent => ({
  id: e.id, churchId, title: e.title, churchName, days: daysOf(e), sessionCheckin: e.sessionCheckin, start: e.start, end: e.end,
});

/** The check-in desk inside the app: database functions in live mode, this browser's data in demo mode. */
export function EventDoor({ e }: { e: ChurchEvent }) {
  const { state, me, mode, put, absorb, newId, findByPhone } = useStore();
  const churchId = state.church.id;
  const nameOf = (id?: string) => { const p = state.people.find((x) => x.id === id); return p ? fullName(p) : ""; };
  // Reads the latest data each time without rebuilding the desk
  const ref = useMemo(() => ({ regs: state.registrations }), []); // eslint-disable-line react-hooks/exhaustive-deps
  ref.regs = state.registrations;
  const desk = useMemo(() => mode === "live" && churchId
    ? liveDesk(churchId, e.id, (id, r) => {
        const cur = ref.regs.find((x) => x.id === id);
        absorb("registrations", [{ ...(cur ?? ({ id, eventId: e.id, name: r.name, phone: "", guests: 0, days: [], answers: {}, ticket: r.ticket, status: r.status, checkins: [], at: new Date().toISOString(), type: "individual" } as Registration)), checkins: r.checkins, sessions: r.sessions, checkinLog: r.checkinLog }]);
      })
    : storeDesk({ e, regs: () => ref.regs, meId: me?.id ?? "", nameOf, save: (r, log) => put("registrations", r, log), newId, personByPhone: (p) => findByPhone(p)?.id, day: () => "", session: () => undefined }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [mode, churchId, e.id, me?.id]);
  return <CheckinDesk event={doorEvent(e, state.church.name, churchId)} desk={desk} />;
}

/**
 * Who follows up, supports registration and checks people in. The committee picks a whole department
 * (everyone in it can check in, nobody added one by one) and/or named people, and a Registration Lead.
 * Then one tap makes the shared check-in link for the team's WhatsApp group.
 */
export function TeamsPanel({ e }: { e: ChurchEvent }) {
  const { state, access, me, put } = useStore();
  const [adding, setAdding] = useState<EventDuty | "lead" | null>(null);
  const [copied, setCopied] = useState(false);
  if (!access || !me) return null;
  const can = managesTeams(e, access);
  const save = (next: ChurchEvent, log: string) => put("events", next, log);
  const depts = state.groups.filter((g) => g.kind === "department");
  const team = (d: EventDuty): DutyTeam => e.duties?.[d] ?? { groupIds: [], personIds: [] };
  const setTeam = (d: EventDuty, t: DutyTeam, log: string) => save({ ...e, duties: { ...(e.duties ?? {}), [d]: t } }, log);
  const lead = state.people.find((p) => p.id === e.regLeadId);
  const url = e.checkinLink && !e.checkinLink.revoked ? `${typeof window !== "undefined" ? location.origin : ""}/door/${e.checkinLink.token}` : "";
  const shareText = `Check-in for *${e.title}*\nOpen this on your phone, sign in to Traqi, and start checking people in:\n${url}\n\nOnly people on the check-in team can use it.`;

  return (
    <div className="space-y-5">
      <Panel title={<span className="flex items-center gap-2"><ShieldCheck size={17} className="text-brand" /> Registration Lead</span>}
        action={can && <Button onClick={() => setAdding("lead")}>{lead ? "Change" : "Choose"}</Button>}>
        {lead ? (
          <div className="flex flex-wrap items-center gap-3"><Avatar person={lead} size={36} /><span className="flex-1"><b className="block font-medium">{fullName(lead)}</b><span className="text-[13px] text-muted">Manages follow-up, registration and check-in for this event</span></span>
            {can && <label className="flex items-center gap-2 text-[13.5px]">Can add helpers<Toggle label="Registration Lead can add helpers" on={e.regLeadAdds !== false} onChange={(v) => save({ ...e, regLeadAdds: v }, `${v ? "let" : "stopped"} ${fullName(lead)} ${v ? "add" : "adding"} helpers for ${e.title}`)} /></label>}
          </div>
        ) : <p className="text-[14px] text-muted">Optional. A Registration or Follow-up Lead can manage the teams below and share the check-in link.</p>}
      </Panel>

      {(["checkin", "followup", "registration"] as EventDuty[]).map((d) => {
        const t = team(d); const everyone = teamOf(state, t);
        return (
          <Panel key={d} title={<span className="flex items-center gap-2"><Users size={17} className="text-brand" /> {DUTY_LABEL[d].title} <span className="text-[13px] font-normal text-muted">· {everyone.length} {everyone.length === 1 ? "person" : "people"}</span></span>}
            action={can && <Button onClick={() => setAdding(d)}><UserPlus size={15} /> Add people</Button>}>
            <p className="mb-3 text-[13.5px] text-ink-soft">{DUTY_LABEL[d].says}. Tick a department and everyone in it is on the team, as it changes.</p>
            <div className="flex flex-wrap gap-1.5">
              {depts.map((g) => { const on = t.groupIds.includes(g.id); return (
                <button type="button" key={g.id} disabled={!can} aria-pressed={on} onClick={() => setTeam(d, { ...t, groupIds: on ? t.groupIds.filter((x) => x !== g.id) : [...t.groupIds, g.id] }, `${on ? "took" : "gave"} ${g.name} ${on ? "off" : ""} ${DUTY_LABEL[d].title.toLowerCase()} for ${e.title}`.replace(/\s+/g, " "))}
                  className={cx("flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] ring-1", on ? "bg-brand-soft font-medium text-brand ring-brand" : "bg-surface ring-line", !can && "opacity-70")}>
                  {on && <Check size={14} />}{g.name}
                </button>
              ); })}
            </div>
            {t.personIds.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">{t.personIds.map((id) => { const p = state.people.find((x) => x.id === id); if (!p) return null; return (
                <li key={id} className="flex items-center gap-1.5 rounded-full bg-page py-1 pl-1 pr-2 text-[13px] ring-1 ring-line"><Avatar person={p} size={22} />{fullName(p)}
                  {can && <button type="button" onClick={() => setTeam(d, { ...t, personIds: t.personIds.filter((x) => x !== id) }, `took ${fullName(p)} off ${DUTY_LABEL[d].title.toLowerCase()} for ${e.title}`)} aria-label={`Remove ${fullName(p)}`} className="text-muted hover:text-alert"><X size={13} /></button>}</li>
              ); })}</ul>
            )}
          </Panel>
        );
      })}

      <Panel title={<span className="flex items-center gap-2"><Link2 size={17} className="text-brand" /> Shared check-in link</span>}>
        <p className="mb-3 text-[13.5px] text-ink-soft">One link for everyone checking people in. Share it in the team&apos;s WhatsApp group. It opens the check-in screen and nothing else, and only works for people on the check-in team who sign in. Make a new one to stop the old link working.</p>
        {e.status !== "published" ? <p className="text-[14px] text-muted">Available once the event is published.</p> : url ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-2xl bg-page p-2 pl-4 ring-1 ring-line"><span className="num flex-1 truncate text-[14px]">{url.replace(/^https?:\/\//, "")}</span>
              <Button onClick={() => { void copyText(url).then((ok) => { if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }); }}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}</Button></div>
            <div className="flex flex-wrap gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-3.5 py-2 text-sm font-medium text-white"><WhatsAppIcon /> Share to WhatsApp</a>
              {can && <Button onClick={() => { save({ ...e, checkinLink: { token: newLinkToken(), at: new Date().toISOString(), byId: me.id } }, `made a new check-in link for ${e.title} (the old one stopped working)`); toast("New link made. The old one no longer works."); }}><RefreshCw size={15} /> New link</Button>}
              {can && <Button variant="ghost" className="text-alert" onClick={() => { save({ ...e, checkinLink: { ...e.checkinLink!, revoked: true } }, `turned off the check-in link for ${e.title}`); toast("Link turned off"); }}>Turn off</Button>}
            </div>
            <p className="text-[12.5px] text-muted">Made {new Date(e.checkinLink!.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })} by {fullName(state.people.find((p) => p.id === e.checkinLink!.byId))}. Every check-in records who did it and when.</p>
          </div>
        ) : can ? <Button variant="primary" onClick={() => { save({ ...e, checkinLink: { token: newLinkToken(), at: new Date().toISOString(), byId: me.id } }, `made the check-in link for ${e.title}`); toast("Check-in link ready"); }}><ClipboardCheck size={15} /> Make the check-in link</Button>
          : <p className="text-[14px] text-muted">The committee or Registration Lead will share it.</p>}
        {e.checkinLink?.revoked && <Badge tone="alert">The last link was turned off</Badge>}
      </Panel>

      <PeopleAdder open={!!adding} onClose={() => setAdding(null)} title={adding === "lead" ? "Registration Lead" : adding ? `Add to ${DUTY_LABEL[adding].title.toLowerCase()}` : ""}
        exclude={adding && adding !== "lead" ? team(adding).personIds : []}
        onAdd={(ids, what) => {
          if (adding === "lead") { save({ ...e, regLeadId: ids[0] }, `made ${what} the Registration Lead for ${e.title}`); setAdding(null); return; }
          if (!adding) return;
          const t = team(adding);
          setTeam(adding, { ...t, personIds: [...new Set([...t.personIds, ...ids])] }, `added ${what} to ${DUTY_LABEL[adding].title.toLowerCase()} for ${e.title}`); toast("Added");
        }} />
    </div>
  );
}
