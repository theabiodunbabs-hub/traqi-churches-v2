"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, AtSign, Camera, Check, Hash, Phone, Search, UserPlus, X } from "lucide-react";
import type { Desk, DoorEvent, DoorReg, DoorStats, MarkResult } from "@/lib/checkin";
import { lookupKind } from "@/lib/event-mgmt";
import { dayName, digits, todayLagos } from "@/lib/format";
import type { CheckinVia } from "@/lib/types";
import { Button, Field, cx, inputCls } from "./ui";
import { QrScanner, codeFromScan } from "./qr-scanner";

type Mode = "scan" | "ticket" | "phone" | "email";
const MODES: { k: Mode; label: string; icon: typeof Camera; ph: string; im?: "tel" | "email" | "text" }[] = [
  { k: "scan", label: "Scan QR", icon: Camera, ph: "" },
  { k: "ticket", label: "Ticket ID", icon: Hash, ph: "e.g. CH26-00125", im: "text" },
  { k: "phone", label: "Phone", icon: Phone, ph: "Phone number they registered with", im: "tel" },
  { k: "email", label: "Email", icon: AtSign, ph: "Email they registered with", im: "email" },
];
const timeOf = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }) : "");

/**
 * The door: check people in by scanning their ticket, or by ticket ID, phone or email.
 * Built for phones and for many people at once: numbers refresh every few seconds, and anyone already
 * checked in shows who let them in and when, even if a team-mate did it a moment ago.
 */
export function CheckinDesk({ event: e, desk, compact }: { event: DoorEvent; desk: Desk; compact?: boolean }) {
  const today = todayLagos();
  const [day, setDay] = useState(e.days.some((d) => d.date === today) ? today : (e.days.find((d) => d.date > today) ?? e.days[0])?.date ?? today);
  const plan = e.days.find((d) => d.date === day);
  const sessions = e.sessionCheckin ? (plan?.sessions ?? []).filter((s) => s.checkin !== false) : [];
  const [session, setSession] = useState("");
  const [mode, setMode] = useState<Mode>("scan");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<DoorReg[] | null>(null);
  const [last, setLast] = useState<MarkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState<DoorStats | null>(null);
  const [walk, setWalk] = useState<null | { firstName: string; lastName: string; phone: string; altPhone: string; email: string }>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => { desk.stats(day, session || undefined).then(setStats).catch(() => {}); }, [desk, day, session]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 4000); return () => clearInterval(t); }, [refresh]);

  const mark = async (r: DoorReg, via: CheckinVia) => {
    setBusy(true); setErr("");
    try { const m = await desk.mark(r.id, day, via, session || undefined); setLast(m); setFound(null); setQ(""); refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "That didn't work. Try again."); }
    finally { setBusy(false); input.current?.focus(); }
  };
  const search = async (raw: string, via: CheckinVia) => {
    const text = raw.trim(); if (!text) return;
    setBusy(true); setErr(""); setLast(null);
    try {
      const list = await desk.find(text);
      // A scanned code or a typed ticket ID that matches exactly checks the person straight in
      if (list.length === 1 && (via === "qr" || (via === "ticket" && list[0].ticket.toUpperCase() === text.toUpperCase()))) { setBusy(false); return void mark(list[0], via); }
      setFound(list);
      if (!list.length) setErr(via === "qr" ? `No registration for ${text}. Is it a ticket for this event?` : "No registration found. Check what was typed, or add them as a walk-in.");
    } catch (x) { setErr(x instanceof Error ? x.message : "Search failed. Check your connection."); }
    finally { setBusy(false); }
  };
  const submit = () => {
    const k = lookupKind(q);
    const via: CheckinVia = mode === "ticket" ? "ticket" : mode === "phone" ? "phone" : mode === "email" ? "email" : k.by === "name" ? "name" : k.by;
    if (mode === "phone" && digits(q).length < 7) return setErr("Type at least the last 7 digits.");
    if (mode === "email" && !q.includes("@")) return setErr("Type the full email address.");
    void search(q, via);
  };

  return (
    <div className="space-y-4">
      {/* Live numbers */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[["Registered", stats?.registered], ["In", stats?.in], ["Yet to come", stats?.notYet], ["Progress", stats ? `${Math.round(stats.pct * 100)}%` : undefined]].map(([l, v], i) => (
          <div key={l as string} className={cx("rounded-2xl px-1 py-2.5 ring-1 ring-line", i === 1 ? "bg-good-soft" : "bg-surface")}>
            <p className={cx("num font-semibold leading-none", compact ? "text-[22px]" : "text-[26px]", i === 1 && "text-good")}>{v ?? "–"}</p>
            <p className="mt-1 text-[11.5px] text-muted">{l}</p>
          </div>
        ))}
      </div>
      {stats && <div className="h-2 overflow-hidden rounded-full bg-page"><div className="h-full rounded-full bg-good transition-all" style={{ width: `${stats.pct * 100}%` }} /></div>}

      {(e.days.length > 1 || sessions.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {e.days.length > 1 && <select aria-label="Day" className="min-h-10 rounded-xl bg-page px-3 text-[14px] ring-1 ring-line" value={day} onChange={(x) => { setDay(x.target.value); setSession(""); }}>{e.days.map((d, i) => <option key={d.date} value={d.date}>Day {i + 1} · {dayName(d.date, { weekday: "short", day: "numeric", month: "short" })}</option>)}</select>}
          {sessions.length > 0 && <button type="button" onClick={() => setSession("")} className={cx("min-h-10 rounded-full px-3 text-[13px] ring-1", !session ? "bg-deep text-white ring-deep" : "bg-page ring-line")}>The whole day</button>}
          {sessions.map((s) => <button type="button" key={s.id} onClick={() => setSession(s.id)} className={cx("min-h-10 rounded-full px-3 text-[13px] ring-1", session === s.id ? "bg-deep text-white ring-deep" : "bg-page ring-line")}>{s.title || s.start}</button>)}
        </div>
      )}

      {/* The four ways in */}
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-page p-1 ring-1 ring-line" role="tablist">
        {MODES.map((m) => (
          <button type="button" role="tab" aria-selected={mode === m.k} key={m.k} onClick={() => { setMode(m.k); setFound(null); setErr(""); setQ(""); setTimeout(() => input.current?.focus(), 30); }}
            className={cx("flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[12px] font-medium", mode === m.k ? "bg-surface text-brand shadow-sm ring-1 ring-line" : "text-ink-soft")}>
            <m.icon size={17} />{m.label}
          </button>
        ))}
      </div>

      {mode === "scan" ? (
        <QrScanner paused={busy} onClose={() => setMode("ticket")} onCode={(raw) => void search(codeFromScan(raw), "qr")} />
      ) : (
        <form onSubmit={(x) => { x.preventDefault(); submit(); }} className="flex gap-2">
          <div className="relative flex-1"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input ref={input} autoFocus inputMode={MODES.find((m) => m.k === mode)!.im} autoCapitalize={mode === "ticket" ? "characters" : "off"} autoComplete="off" className={cx(inputCls, "py-3.5 pl-11 text-[17px]", mode === "ticket" && "num uppercase tracking-wider")}
              value={q} onChange={(x) => { setQ(x.target.value); setErr(""); }} placeholder={MODES.find((m) => m.k === mode)!.ph} aria-label={MODES.find((m) => m.k === mode)!.ph} />
          </div>
          <Button variant="primary" type="submit" disabled={busy || !q.trim()} className="px-5">Find</Button>
        </form>
      )}

      {err && <p className="flex items-start gap-2 rounded-2xl bg-alert-soft px-4 py-3 text-[14px] text-alert" role="alert"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{err}</p>}

      {last && <Result m={last} onDone={() => setLast(null)} />}

      {found && found.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">{found.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1"><b className="block truncate text-[15px]">{r.name}</b><span className="num text-[12.5px] text-muted">{r.ticket} · {r.phone}{r.email ? ` · ${r.email}` : ""}</span>
              {r.inBy && <span className="block text-[12.5px] font-medium text-glow-ink">Already in · {r.inBy}, {timeOf(r.inAt)}</span>}
              {r.status !== "confirmed" && <span className="block text-[12.5px] font-medium text-alert">{r.status === "waitlist" ? "On the waiting list" : "Not confirmed yet"}</span>}
            </span>
            {r.inBy ? <span className="rounded-full bg-good-soft px-3 py-1.5 text-[13px] font-medium text-good"><Check size={13} className="inline" /> In</span>
              : <Button variant="primary" disabled={busy || r.status !== "confirmed"} onClick={() => void mark(r, mode === "scan" ? "qr" : mode === "ticket" ? "ticket" : mode === "phone" ? "phone" : "email")}>Check in</Button>}
          </li>
        ))}</ul>
      )}

      <div className="border-t border-line pt-4">
        {walk ? (
          <div className="space-y-3 rounded-2xl bg-page p-4 ring-1 ring-line">
            <p className="font-semibold">Walk-in (not registered)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="First name"><input className={inputCls} autoComplete="off" value={walk.firstName} onChange={(x) => setWalk({ ...walk, firstName: x.target.value })} /></Field>
              <Field label="Last name"><input className={inputCls} autoComplete="off" value={walk.lastName} onChange={(x) => setWalk({ ...walk, lastName: x.target.value })} /></Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Phone number (WhatsApp number)"><input className={inputCls} inputMode="tel" value={walk.phone} onChange={(x) => setWalk({ ...walk, phone: x.target.value })} /></Field>
              <Field label="Alternative number (optional - hotline or call number)"><input className={inputCls} inputMode="tel" value={walk.altPhone} onChange={(x) => setWalk({ ...walk, altPhone: x.target.value })} /></Field>
              <Field label="Email (optional)"><input className={inputCls} inputMode="email" value={walk.email} onChange={(x) => setWalk({ ...walk, email: x.target.value })} /></Field>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" disabled={busy || !walk.firstName.trim() || !walk.lastName.trim() || digits(walk.phone).length < 10} onClick={async () => {
                setBusy(true); setErr("");
                const w = { firstName: walk.firstName.trim(), lastName: walk.lastName.trim(), name: `${walk.firstName.trim()} ${walk.lastName.trim()}`, phone: walk.phone, altPhone: walk.altPhone.trim() || undefined, email: walk.email.trim() || undefined };
                try { setLast(await desk.walkin(w, day, session || undefined)); setWalk(null); refresh(); } catch (x) { setErr(x instanceof Error ? x.message : "Couldn't add them."); } finally { setBusy(false); }
              }}><UserPlus size={15} /> Register and check in</Button>
              <Button variant="ghost" onClick={() => setWalk(null)}>Cancel</Button>
            </div>
          </div>
        ) : <Button onClick={() => setWalk({ firstName: "", lastName: "", phone: "", altPhone: "", email: "" })}><UserPlus size={15} /> Add a walk-in</Button>}
      </div>
    </div>
  );
}

function Result({ m, onDone }: { m: MarkResult; onDone: () => void }) {
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => { if (m.result !== "in") return; const t = setTimeout(() => done.current(), 6000); return () => clearTimeout(t); }, [m]);
  const tone = m.result === "in" ? "bg-good-soft" : m.result === "already" ? "bg-glow-soft" : "bg-alert-soft";
  return (
    <div className={cx("pop flex items-center gap-4 rounded-2xl p-4", tone)} role="status">
      <span className={cx("flex size-12 shrink-0 items-center justify-center rounded-full text-white", m.result === "in" ? "bg-good" : m.result === "already" ? "bg-glow" : "bg-alert")}>
        {m.result === "in" ? <Check size={24} /> : m.result === "already" ? <AlertTriangle size={22} /> : <X size={22} />}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-lg">{m.reg.name}</b>
        <span className="text-[14px] text-ink-soft">
          {m.result === "in" ? `Checked in · ${m.reg.ticket}` : m.result === "already" ? `Already checked in by ${m.reg.inBy ?? "the team"} at ${timeOf(m.reg.inAt)}. Don't let this ticket in twice.`
            : m.result === "online" ? "Registered to join online, not in person." : m.reg.status === "waitlist" ? "On the waiting list, not confirmed." : "Registration not confirmed yet."}
        </span>
      </span>
      <button type="button" onClick={onDone} className="p-1 text-muted" aria-label="Dismiss"><X size={16} /></button>
    </div>
  );
}
