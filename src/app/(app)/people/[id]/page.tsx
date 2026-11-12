"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useRef } from "react";
import { ArrowLeft, Camera, Check, Copy, Crown, Lock, MoreHorizontal, Pencil, Plane, Share2, UserMinus, UserPlus, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useWords } from "@/components/theme";
import { Avatar, Badge, Button, Empty, Field, JourneyTrack, Panel, Sheet, Toggle, cx, inputCls, toast } from "@/components/ui";
import { WhatsAppIcon } from "@/components/care";
import { uploadImage } from "@/lib/upload";
import { CustomFieldInput, customValue } from "@/components/custom-fields";
import { isAway, progress, sundayDots } from "@/lib/domain";
import { shortDate, todayLagos, waLink } from "@/lib/format";
import { ReachOut, ReasonTag, messages } from "@/components/care";
import { FOLLOW_STAGES, ago, completeness, fullName, hoursSince, longDate } from "@/lib/format";
import type { Person } from "@/lib/types";
import { escalation, holdersOf } from "@/lib/metrics";
import { AssignPicker } from "@/components/assign";
import { PERMISSIONS, PERMISSION_SAYS, accessFor, scopeLabel } from "@/lib/access";
import { branchName } from "@/lib/branches";

export default function Profile() {
  const w = useWords();
  const { id } = useParams<{ id: string }>();
  const { me, access, state, person, addNote, shareNote, updatePerson } = useStore();
  const [editing, setEditing] = useState(false);
  const [more, setMore] = useState(false);
  const photo = useRef<HTMLInputElement>(null);
  const p = person(id);
  if (!me || !access) return null;
  const allowed = p && (p.id === me.id || access.visiblePeople().some((x) => x.id === p.id));
  if (!p || !allowed) return <Empty title="You can't open this profile" body="It's outside the departments and people in your care. Ask the admin if you need access." action={<Link href="/people" className="text-sm font-medium text-brand">Back to People</Link>} />;

  const contacts = access.canSeeContacts(p);
  const canEdit = p.id === me.id || access.can("people.edit", { personId: p.id }) || access.perms.get("people.edit") === "church";
  const groups = state.groups.filter((g) => g.memberIds.includes(p.id));
  const leads = new Set(state.groups.filter((g) => g.leaderIds.includes(p.id)).map((g) => g.id));
  const household = p.householdId ? state.people.filter((x) => x.householdId === p.householdId && x.id !== p.id) : [];
  const hh = state.households.find((h) => h.id === p.householdId);
  const fcase = state.cases.find((c) => c.personId === p.id);
  const notes = state.careNotes.filter((n) => n.personId === p.id && (n.authorId === me.id || access.canReadNote(n)));
  const canWriteNotes = access.can("care.view");
  const roles = state.assignments.filter((a) => a.personId === p.id).map((a) => state.roles.find((r) => r.id === a.roleId)?.name).filter(Boolean);
  const pct = completeness(p);
  const missing = [["birthday", "birthday"], ["whatsapp", "WhatsApp number"], ["email", "email"], ["location", "area"], ["occupation", "occupation"]].filter(([k]) => !p[k as keyof Person]).map(([, l]) => l);
  const isPastor = holdersOf(state, "pastor");

  return (
    <div>
      <Link href="/people" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"><ArrowLeft size={15} /> People</Link>

      <section className="rise card mb-6 overflow-hidden">
        <div className="hero relative h-24 rounded-none md:h-28" aria-hidden />
        <div className="px-6 pb-6 md:px-8 md:pb-8">
          <div className="-mt-12 flex flex-col gap-4 md:flex-row md:items-end">
            <button disabled={!canEdit} onClick={() => photo.current?.click()} className="group relative w-fit rounded-full ring-[5px] ring-surface" aria-label={canEdit ? "Change photo" : undefined}>
              <Avatar person={p} size={96} />
              {canEdit && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100"><Camera size={22} /></span>}
            </button>
            <input ref={photo} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { updatePerson(p.id, { photo: await uploadImage(f, "photo", 400) }, p.id === me.id ? "self" : undefined); toast("Photo updated"); } }} />
            <div className="min-w-0 flex-1 md:pt-14">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight">{fullName(p)}</h1>
                {p.isChild && <ReasonTag tone="muted">Child</ReasonTag>}
                {p.isLeader && <Badge tone="brand"><Crown size={11} /> Leader</Badge>}
                {p.probation && <Badge tone="glow">On probation until {shortDate(p.probation.until)}</Badge>}
                {p.awaitingStage && <Badge tone="brand">Waiting to be confirmed</Badge>}
                {p.inactive && <Badge tone="neutral">{p.inactive.reason === "moved" ? "Moved away" : p.inactive.reason === "other church" ? "Joined another church" : "Inactive"}</Badge>}
                {isAway(state, p.id) && <Badge tone="glow"><Plane size={11} /> Away until {shortDate(isAway(state, p.id)!.to)}</Badge>}
              </div>
              <p className="mt-1 text-ink-soft">{[p.occupation, p.location, roles.length ? roles.join(", ") : null].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex gap-2">
              {p.id !== me.id && !p.isChild && <ReachOut person={p} message={fcase?.stage === "new" ? messages.welcome(p, state.church.name) : `Hello ${p.firstName}, `} canContact={contacts} />}
              {canEdit && <Button onClick={() => setEditing(true)}><Pencil size={15} /> Edit</Button>}
              {(canEdit || access.isPastoral) && <Button variant="ghost" onClick={() => setMore(true)} aria-label="More"><MoreHorizontal size={18} /></Button>}
            </div>
          </div>
          <div className="mt-7"><JourneyTrack stage={p.stage} /></div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="space-y-6">
          <Panel title="Details" action={<span className="text-xs text-muted">{pct}% filled</span>}>
            <dl className="space-y-3 text-[14.5px]">
              <Row k="Phone" v={contacts ? p.phone : <Hidden />} />
              <Row k="WhatsApp" v={contacts ? p.whatsapp : <Hidden />} />
              <Row k="Email" v={contacts ? p.email : <Hidden />} />
              <Row k="Area" v={p.location} />
              <Row k="Address" v={contacts ? hh?.address : <Hidden />} />
              <Row k="Birthday" v={p.birthday ? longDate(p.birthday) : undefined} />
              <Row k="Occupation" v={p.occupation} />
              <Row k="Gender" v={p.gender === "F" ? "Female" : "Male"} />
              <Row k="First visit" v={longDate(p.firstVisit)} />
              {(state.church.profile?.branches ?? []).length > 0 && <Row k="Branch" v={canEdit ? <BranchMove personId={p.id} /> : branchName(state, p.branchId)} />}
              {(state.church.profile?.customFields ?? []).filter((f) => !f.hidden).map((f) => <Row key={f.id} k={f.label} v={customValue(f, p) ?? undefined} />)}
            </dl>
            {missing.length > 0 && canEdit && (
              <button onClick={() => setEditing(true)} className="mt-5 w-full rounded-xl bg-glow-soft px-4 py-3 text-left text-sm text-glow-ink hover:bg-glow/15">
                Missing: {missing.join(", ")}. Add them now.
              </button>
            )}
          </Panel>

          <Panel title={w.departments}>
            {groups.length ? (
              <ul className="space-y-2">
                {groups.map((g) => (
                  <li key={g.id}>
                    <Link href={`/departments/${g.parentId ?? g.id}`} className="flex items-center justify-between rounded-xl bg-page px-3.5 py-2.5 hover:bg-brand-soft">
                      <span className="font-medium">{g.name}{g.parentId && <span className="font-normal text-muted"> in {state.groups.find((x) => x.id === g.parentId)?.name}</span>}</span>
                      {leads.has(g.id) && <ReasonTag tone="brand">Leader</ReasonTag>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Not in a department yet.</p>}
          </Panel>

          {(access.isPastoral || access.can("roles.manage")) && !p.isChild && <CanDo personId={p.id} />}
          {!p.isChild && <Sundays personId={p.id} />}
          <ClassesPanel personId={p.id} />
          {(household.length > 0 || hh) && (
            <Panel title={hh?.name ?? "Household"}>
              <ul className="space-y-3">
                {household.map((h) => (
                  <li key={h.id}><Link href={`/people/${h.id}`} className="flex items-center gap-3 hover:text-brand"><Avatar person={h} size={34} /><span className="font-medium">{fullName(h)}</span>{h.isChild && <span className="text-xs text-muted">Child, born {h.birthday?.slice(0, 4)}</span>}</Link></li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          {fcase && <FollowUp caseId={fcase.id} />}

          {canWriteNotes && p.id !== me.id && (
            <Panel title="Care notes" action={<span className="flex items-center gap-1 text-xs text-muted"><Lock size={12} /> Private to carers</span>}>
              <NoteForm onAdd={(body, level) => addNote({ personId: p.id, body, level })} canConfidential={access.isPastoral} />
              <ul className="mt-5 space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className={cx("rounded-xl p-4", n.level === "confidential" ? "bg-deep text-white" : "bg-page")}>
                    <div className="mb-1.5 flex items-center gap-2 text-xs">
                      {n.level === "confidential" && <span className="flex items-center gap-1 font-medium"><Lock size={12} /> Confidential</span>}
                      <span className={n.level === "confidential" ? "text-white/60" : "text-muted"}>{fullName(person(n.authorId))}, {ago(n.at)}</span>
                    </div>
                    <p className="text-[14.5px] leading-relaxed">{n.body}</p>
                    {n.level === "confidential" && access.isLead && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        {n.sharedWith.length > 0 && <span className="text-white/70">Shared with {n.sharedWith.map((s) => fullName(person(s))).join(", ")}</span>}
                        {isPastor.filter((x) => !n.sharedWith.includes(x)).map((x) => (
                          <button key={x} onClick={() => shareNote(n.id, x)} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 hover:bg-white/20"><Share2 size={12} /> Share with Pastor {person(x)?.firstName}</button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
                {notes.length === 0 && <li className="text-sm text-muted">No notes yet.</li>}
              </ul>
            </Panel>
          )}

          <Panel title="Timeline">
            <ol className="relative space-y-4 border-l-2 border-line pl-5">
              {[...(fcase?.contacts ?? []).map((c) => ({ at: c.at, text: `${fullName(person(c.byId))} ${c.method === "call" ? "called" : c.method === "visit" ? "visited" : "sent a WhatsApp message"}: ${c.outcome}` })),
                ...state.activity.filter((a) => a.text.includes(fullName(p))).map((a) => ({ at: a.at, text: `${fullName(person(a.actorId))} ${a.text}` })),
                { at: new Date(p.firstVisit).toISOString(), text: `First visit to ${state.church.name}` },
              ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8).map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-surface ring-2 ring-j3" />
                  <p className="text-[14.5px]">{e.text}</p>
                  <p className="text-xs text-muted">{ago(e.at)}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      {canEdit && <EditPerson open={editing} onClose={() => setEditing(false)} person={p} />}
      <Sheet open={more} onClose={() => setMore(false)} title={p.id === me.id ? "Your settings" : `More for ${p.firstName}`}><MoreActions person={p} onDone={() => setMore(false)} /></Sheet>
    </div>
  );
}

/** "What can this person do?" Their roles and assistant titles, in plain words. */
function CanDo({ personId }: { personId: string }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const a = accessFor(state, personId);
  const can = PERMISSIONS.filter((x) => a.perms.has(x.key) || a.branchPerms.has(x.key));
  const mine = state.assignments.filter((x) => x.personId === personId);
  return (
    <Panel title="What can they do?" action={<Link href="/settings/roles" className="text-xs font-medium text-brand">Roles</Link>}>
      {mine.length === 0 && a.roleNames.length === 0 ? <p className="text-sm text-muted">No roles. They see their own details and what members see.</p> : (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {mine.map((x) => { const r = state.roles.find((y) => y.id === x.roleId); return r && (
              <li key={x.roleId} className={cx("rounded-full px-2.5 py-1 text-[12.5px] font-medium", x.pending ? "bg-glow-soft text-glow-ink" : "bg-brand-soft text-brand")}>
                {r.name}<span className="font-normal opacity-80"> · {scopeLabel(state, x.scope)}{x.until ? `, until ${shortDate(x.until)}` : ""}{x.pending ? ", waiting" : ""}</span>
              </li>
            ); })}
            {state.groups.flatMap((g) => (g.assistants ?? []).filter((x) => x.personId === personId).map((x) => (
              <li key={g.id} className="rounded-full bg-j1 px-2.5 py-1 text-[12.5px] font-medium text-on-light">{x.title || `Assistant, ${g.name}`}</li>
            )))}
          </ul>
          <button onClick={() => setOpen(!open)} className="mt-3 text-sm font-medium text-brand">{open ? "Hide" : `See all ${can.length} things they can do`}</button>
          {open && <ul className="mt-2 space-y-1 text-[14px] text-ink-soft">{can.map((x) => <li key={x.key} className="flex gap-2"><Check size={14} className="mt-1 shrink-0 text-good" />Can {PERMISSION_SAYS[x.key]}</li>)}</ul>}
        </>
      )}
    </Panel>
  );
}

/** Which branch someone belongs to; staff can move them. */
function BranchMove({ personId }: { personId: string }) {
  const { state, transferBranch } = useStore();
  const p = state.people.find((x) => x.id === personId)!;
  return (
    <select className="rounded-lg bg-page px-2 py-1 text-[14px] ring-1 ring-line" value={p.branchId ?? ""} aria-label="Branch"
      onChange={(e) => { const to = e.target.value || undefined; if (confirm(`Move ${p.firstName} to ${branchName(state, to)}? They'll leave their current branch's departments.`)) { transferBranch(p.id, to); toast(`${p.firstName} moved to ${branchName(state, to)}`); } }}>
      <option value="">Headquarters</option>
      {(state.church.profile?.branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}

function Hidden() { return <span className="inline-flex items-center gap-1 text-muted"><Lock size={12} /> Hidden</span>; }

function Row({ k, v }: { k: string; v?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v ?? <span className="text-muted">Not added</span>}</dd>
    </div>
  );
}

function NoteForm({ onAdd, canConfidential }: { onAdd: (body: string, level: "care" | "confidential") => void; canConfidential: boolean }) {
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<"care" | "confidential">("care");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!body.trim()) return setErr("Write the note first."); onAdd(body.trim(), level); setBody(""); }}>
      <textarea className={cx(inputCls, "min-h-20 resize-y")} placeholder="What happened, and what's the next step?" value={body} onChange={(e) => { setBody(e.target.value); setErr(null); }} />
      {err && <p className="mt-1 text-sm text-alert" role="alert">{err}</p>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {canConfidential ? (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={level === "confidential"} onChange={(e) => setLevel(e.target.checked ? "confidential" : "care")} className="size-4 accent-brand" />
            Confidential counselling note (lead pastor only)
          </label>
        ) : <span />}
        <Button variant="primary" type="submit">Save note</Button>
      </div>
    </form>
  );
}

function FollowUp({ caseId }: { caseId: string }) {
  const { state, person, access, me, moveCase, logContact } = useStore();
  const c = state.cases.find((x) => x.id === caseId)!;
  const [method, setMethod] = useState<"call" | "whatsapp" | "visit">("call");
  const [outcome, setOutcome] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (!access || !me) return null;
  const canAssign = access.can("followup.assign");
  const canLog = canAssign || c.assigneeId === me.id;
  const [picking, setPicking] = useState(false);
  const esc = escalation(state, c);
  const last = c.contacts.at(-1);
  return (
    <Panel title="Follow-up" action={<ReasonTag tone={c.stage === "new" ? "alert" : "brand"}>{FOLLOW_STAGES.find((s) => s.key === c.stage)?.label ?? "Not reachable"}</ReasonTag>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Assigned to">
          {canAssign ? (
            <button onClick={() => setPicking(true)} className={cx(inputCls, "flex items-center gap-2 text-left")}>
              {c.assigneeId ? <><Avatar person={person(c.assigneeId)} size={22} />{fullName(person(c.assigneeId))}</> : <span className="text-muted">Choose someone</span>}
            </button>
          ) : <p className="py-2.5">{fullName(person(c.assigneeId))}</p>}
        </Field>
        <Field label="Stage">
          <select className={inputCls} value={c.stage} disabled={!canLog} onChange={(e) => moveCase(c.id, e.target.value as typeof c.stage)}>
            {FOLLOW_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            <option value="unreachable">Not reachable</option>
          </select>
        </Field>
      </div>
      {esc.level > 0 && <p className="mt-3 rounded-xl bg-alert-soft px-3 py-2 text-sm font-medium text-alert">{esc.label}: no one has reached {person(c.personId)?.firstName} in {Math.floor(hoursSince(c.createdAt) / 24)} days.</p>}
      {last && <p className="mt-3 rounded-xl bg-brand-soft/60 px-3 py-2 text-sm text-ink-soft"><span className="font-medium text-ink">Last time:</span> {last.outcome} ({fullName(person(last.byId))}, {ago(last.at)})</p>}
      <AssignPicker caseId={c.id} open={picking} onClose={() => setPicking(false)} />
      {canLog && (
        <form className="mt-4 rounded-xl bg-page p-4" onSubmit={(e) => { e.preventDefault(); if (!outcome.trim()) return setErr("Say how it went."); logContact(c.id, { method, outcome: outcome.trim() }); setOutcome(""); }}>
          <p className="mb-2 text-sm font-medium">Log a contact</p>
          <div className="mb-2 flex gap-1.5">
            {(["call", "whatsapp", "visit"] as const).map((m) => (
              <button type="button" key={m} onClick={() => setMethod(m)} className={cx("rounded-lg px-3 py-1.5 text-sm capitalize ring-1", method === m ? "bg-surface font-medium text-brand ring-brand" : "ring-line text-ink-soft")}>{m === "whatsapp" ? "WhatsApp" : m}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className={cx(inputCls, "bg-surface")} placeholder="Reached, will come on Sunday" value={outcome} onChange={(e) => { setOutcome(e.target.value); setErr(null); }} />
            <Button variant="primary" type="submit">Log</Button>
          </div>
          {err && <p className="mt-1 text-sm text-alert" role="alert">{err}</p>}
        </form>
      )}
    </Panel>
  );
}

function EditPerson({ open, onClose, person: p }: { open: boolean; onClose: () => void; person: Person }) {
  const { updatePerson, state } = useStore();
  const [f, setF] = useState({ ...p });
  const fields = (state.church.profile?.customFields ?? []).filter((x) => !x.hidden);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Person) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value || undefined }); setErr(null); };
  return (
    <Sheet open={open} onClose={onClose} title={`Edit ${p.firstName}'s details`}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        if (!f.firstName?.trim() || !f.lastName?.trim()) return setErr("First and last name are required.");
        if (!f.phone || f.phone.replace(/\D/g, "").length < 10) return setErr("Enter a phone number with at least 10 digits.");
        updatePerson(p.id, f); onClose(); toast("Details saved");
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input className={inputCls} value={f.firstName} onChange={set("firstName")} /></Field>
          <Field label="Last name"><input className={inputCls} value={f.lastName} onChange={set("lastName")} /></Field>
        </div>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
        <Field label="WhatsApp number"><input className={inputCls} value={f.whatsapp ?? ""} onChange={set("whatsapp")} inputMode="tel" /></Field>
        <Field label="Email"><input className={inputCls} value={f.email ?? ""} onChange={set("email")} type="email" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Birthday" hint="Day, month and year"><input className={inputCls} value={f.birthday ?? ""} onChange={set("birthday")} type="date" /></Field>
          <Field label="Wedding anniversary" hint="If married"><input className={inputCls} value={f.anniversary ?? ""} onChange={set("anniversary")} type="date" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area"><input className={inputCls} value={f.location ?? ""} onChange={set("location")} /></Field>
          <Field label="Occupation"><input className={inputCls} value={f.occupation ?? ""} onChange={set("occupation")} /></Field>
        </div>
        {fields.map((cf) => (
          <Field key={cf.id} label={cf.label}><CustomFieldInput f={cf} value={f.custom?.[cf.id]} onChange={(v) => setF({ ...f, custom: { ...f.custom, [cf.id]: v } })} /></Field>
        ))}
        {err && <p className="text-sm text-alert" role="alert">{err}</p>}
        <Button variant="primary" type="submit" className="w-full py-3">Save changes</Button>
      </form>
    </Sheet>
  );
}

function Sundays({ personId }: { personId: string }) {
  const { state } = useStore();
  const dots = sundayDots(state, personId);
  if (!dots.length) return null;
  const came = dots.filter((d) => d.came).length;
  return (
    <Panel title="Sundays" action={<span className="text-xs text-muted">{came} of the last {dots.length}</span>}>
      <div className="flex flex-wrap gap-1.5">
        {dots.map((d) => <span key={d.date} title={`${shortDate(d.date)}: ${d.came ? "came" : d.away ? "away" : "missed"}`} className={cx("flex size-7 items-center justify-center rounded-lg text-[10px] font-semibold", d.came ? "bg-brand text-white" : d.away ? "bg-glow-soft text-glow-ink" : "bg-page text-muted ring-1 ring-line")}>{d.away && !d.came ? <Plane size={11} /> : new Date(`${d.date}T12:00:00Z`).getUTCDate()}</span>)}
      </div>
      <p className="mt-3 flex gap-4 text-[12px] text-muted"><span className="flex items-center gap-1"><span className="size-2.5 rounded bg-brand" /> Came</span><span className="flex items-center gap-1"><span className="size-2.5 rounded bg-glow-soft ring-1 ring-glow/30" /> Away</span><span className="flex items-center gap-1"><span className="size-2.5 rounded bg-page ring-1 ring-line" /> Missed</span></p>
    </Panel>
  );
}

function ClassesPanel({ personId }: { personId: string }) {
  const { state } = useStore();
  const enr = state.enrolments.filter((e) => e.personId === personId);
  if (!enr.length) return null;
  return (
    <Panel title="Classes">
      <ul className="space-y-3">{enr.map((e) => {
        const pr = progress(state, e);
        return (
          <li key={e.id}><Link href={`/classes/${e.programmeId}`} className="block rounded-xl bg-page p-3 hover:bg-brand-soft">
            <div className="flex items-center justify-between text-[14px]"><span className="font-medium">{pr.prog.name}</span>{e.status === "completed" ? <Badge tone="glow">Finished</Badge> : <span className="text-[12.5px] text-muted">{pr.done.length}/{pr.prog.modules.length}</span>}</div>
            <div className="mt-2 h-1.5 rounded-full bg-surface"><div className="h-full rounded-full bg-brand" style={{ width: `${(pr.done.length / pr.prog.modules.length) * 100}%` }} /></div>
          </Link></li>
        );
      })}</ul>
    </Panel>
  );
}

/** Invite, away dates, moved away, leader: the less frequent things, kept out of the way. */
function MoreActions({ person: p, onDone }: { person: Person; onDone: () => void }) {
  const { state, access, me, put, updatePerson, newId, drop } = useStore();
  const [from, setFrom] = useState(todayLagos());
  const [to, setTo] = useState(todayLagos());
  const [reason, setReason] = useState<NonNullable<Person["inactive"]>["reason"]>("moved");
  const [copied, setCopied] = useState(false);
  const self = p.id === me!.id;
  const canInvite = !self && !p.isChild && (access!.can("roles.manage") || access!.can("people.edit"));
  const invite = state.invites.find((i) => i.personId === p.id && !i.usedAt);
  const linked = state.invites.some((i) => i.personId === p.id && i.usedAt);
  const url = invite ? `${typeof window !== "undefined" ? location.origin : ""}/invite/${invite.token}` : "";
  const away = state.away.filter((w) => w.personId === p.id && w.to >= todayLagos());
  return (
    <div className="space-y-6">
      {canInvite && (
        <section>
          <p className="mb-2 flex items-center gap-2 font-semibold"><UserPlus size={17} className="text-brand" /> Invite to Traqi</p>
          {linked ? <p className="rounded-xl bg-good-soft px-3 py-2.5 text-sm text-good"><Check size={14} className="mr-1 inline" />{p.firstName} has joined Traqi.</p> : invite ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1 rounded-xl bg-page p-1.5 pl-3 ring-1 ring-line"><span className="flex-1 truncate text-[13px]">{url.replace(/^https?:\/\//, "")}</span><Button onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}>{copied ? <Check size={14} /> : <Copy size={14} />}</Button></div>
              <a href={waLink(p.whatsapp || p.phone, `Hello ${p.firstName}, here's your link to join ${state.church.name} on Traqi: ${url}`)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#25d366] py-2.5 text-sm font-semibold text-white"><WhatsAppIcon /> Send on WhatsApp</a>
              <p className="text-[12.5px] text-muted">They can sign in with any Google account or email. The link works once.</p>
            </div>
          ) : <Button variant="primary" className="w-full" onClick={() => { put("invites", { token: newId("inv").replace(/[^a-z0-9]/gi, "") + Math.random().toString(36).slice(2, 10), personId: p.id, byId: me!.id, at: new Date().toISOString() }, `created an invite link for ${fullName(p)}`); }}>Create invite link</Button>}
        </section>
      )}

      {(self || access!.can("people.edit")) && !p.isChild && (
        <section>
          <p className="mb-2 flex items-center gap-2 font-semibold"><Plane size={17} className="text-glow-ink" /> {self ? "I'll be away" : "Away dates"}</p>
          <p className="mb-2 text-[13px] text-muted">Travelling or unwell? Away Sundays don&apos;t count as missed.</p>
          <div className="grid grid-cols-2 gap-2"><input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><input type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To" /></div>
          <Button className="mt-2 w-full" onClick={() => { put("away", { id: newId("aw"), personId: p.id, from, to }); toast("Away dates saved. Safe travels!"); }}>Save away dates</Button>
          {away.map((w) => <p key={w.id} className="mt-2 flex items-center justify-between rounded-xl bg-glow-soft px-3 py-2 text-[13px] text-glow-ink">{shortDate(w.from)} to {shortDate(w.to)}<button onClick={() => drop("away", w.id)} className="font-medium">Remove</button></p>)}
        </section>
      )}

      {access!.isPastoral && !self && !p.isChild && (
        <section className="flex items-center justify-between gap-3 rounded-2xl bg-page p-4 ring-1 ring-line">
          <span><b className="flex items-center gap-1.5 font-semibold"><Crown size={15} className="text-brand" /> Treat as a leader</b><span className="text-[13px] text-muted">Their welfare requests go straight to the pastorate.</span></span>
          <Toggle label="Leader" on={!!p.isLeader} onChange={(v) => { updatePerson(p.id, { isLeader: v }); toast(v ? `${p.firstName} marked as a leader` : "Leader mark removed"); }} />
        </section>
      )}

      {access!.can("people.edit") && !self && (
        <section>
          <p className="mb-2 flex items-center gap-2 font-semibold"><UserMinus size={17} className="text-muted" /> {p.inactive ? "No longer active" : "Moved away or left"}</p>
          {p.inactive ? (
            <Button className="w-full" onClick={() => { updatePerson(p.id, { inactive: undefined }); toast(`${p.firstName} is active again`); onDone(); }}><Undo2 size={15} /> Mark as active again</Button>
          ) : (
            <>
              <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}><option value="moved">Moved to another city</option><option value="other church">Joined another church</option><option value="deceased">Passed away</option><option value="other">Other reason</option></select>
              <p className="mt-1.5 text-[12.5px] text-muted">They stay on record but leave lists, counts and reminders.</p>
              <Button className="mt-2 w-full" onClick={() => { const prev = p.inactive; updatePerson(p.id, { inactive: { reason, at: new Date().toISOString() } }); toast(`${p.firstName} marked as not active`, { undo: () => updatePerson(p.id, { inactive: prev }) }); onDone(); }}>Mark as not active</Button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
