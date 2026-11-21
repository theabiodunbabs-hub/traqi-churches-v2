/**
 * Small, live-looking pieces of Traqi drawn in HTML: the same screens the app shows,
 * filled with Graceville Church, the sample church. Labelled as a sample wherever it appears.
 */
import type { ReactNode } from "react";

export const SAMPLE = "Graceville Church";

const av = (n: string, c: string) => <span className="sc-av" style={{ background: c }} aria-hidden>{n.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>;

export function SceneFrame({ title, tag, children, dark }: { title: string; tag?: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className={`sc ${dark ? "sc--dark" : ""}`}>
      <div className="sc-bar"><span className="sc-dot" /><span className="sc-dot" /><span className="sc-dot" /><b>{title}</b>{tag && <em>{tag}</em>}</div>
      <div className="sc-body">{children}</div>
    </div>
  );
}

/** Sunday: people checking in, the headcount ticking up */
export function SceneSunday() {
  const rows = [["Adaeze Okafor", "First-timer", "#f59e0b"], ["Tunde Bakare", "Worker · Ushering", "#4f46e5"], ["Grace Mensah", "Member", "#7a70f0"], ["Kofi Asante", "Member", "#2e2a8f"]];
  return (
    <SceneFrame title="Sunday service" tag="Live">
      <div className="sc-kpis">
        <div className="sc-k"><span>Checked in</span><b className="sc-count" style={{ "--to": 412 } as React.CSSProperties}>412</b></div>
        <div className="sc-k"><span>Headcount</span><b>486</b></div>
        <div className="sc-k sc-k--glow"><span>First-timers</span><b>9</b></div>
      </div>
      <ul className="sc-list">{rows.map(([n, s, c], i) => (
        <li key={n} style={{ "--i": i } as React.CSSProperties}>{av(n, c)}<span><b>{n}</b><small>{s}</small></span><i>{["9:41", "9:39", "9:38", "9:36"][i]} AM</i></li>
      ))}</ul>
    </SceneFrame>
  );
}

/** Follow-up: a first-timer assigned the moment they check in, with a ready WhatsApp message */
export function SceneFollow() {
  return (
    <SceneFrame title="Follow-up" tag="Just now">
      <div className="sc-assign">
        <div className="sc-person">{av("Adaeze Okafor", "#f59e0b")}<span><b>Adaeze Okafor</b><small>First-timer · Lekki · came with a friend</small></span></div>
        <div className="sc-arrow" aria-hidden><span /></div>
        <div className="sc-person">{av("Tola Adeyemi", "#4f46e5")}<span><b>Tola Adeyemi</b><small>Follow-up team · same area · 2 open</small></span></div>
      </div>
      <div className="sc-wa">
        <span className="sc-wa__h">WhatsApp</span>
        <p>Hi Adaeze! It was lovely having you at {SAMPLE} today. I&apos;m Tola, and I&apos;d love to know how you found the service. 🙂</p>
        <span className="sc-wa__t">10:02 ✓✓</span>
      </div>
      <p className="sc-note"><span className="sc-pulse" />Reminder in 48 hours if no one has called</p>
    </SceneFrame>
  );
}

/** Care: a private counselling request, booked */
export function SceneCare() {
  return (
    <SceneFrame title="Counselling" tag="Private">
      <div className="sc-lock"><span aria-hidden>🔒</span>Only the pastor and the person handling it can read this.</div>
      <div className="sc-req">
        <span className="sc-chip sc-chip--glow">Soon · 1–2 weeks</span><span className="sc-chip">Marriage</span>
        <div className="sc-booked"><b>Saturday, 10:00 AM</b><small>Pastor&apos;s office · Add to calendar</small></div>
      </div>
      <ul className="sc-steps"><li className="on">Received</li><li className="on">Booked</li><li>Session held</li></ul>
    </SceneFrame>
  );
}

/** Grow: a class in progress and a certificate */
export function SceneGrow() {
  const people = [["Grace Mensah", 6], ["Kofi Asante", 5], ["Ngozi Eze", 6], ["Yemi Alade", 3]] as const;
  return (
    <SceneFrame title="Foundation School" tag="Week 6 of 6">
      <ul className="sc-meters">{people.map(([n, d], i) => (
        <li key={n} style={{ "--i": i, "--v": d / 6 } as React.CSSProperties}><span>{n}</span><span className="sc-meter"><i /></span><small>{d}/6</small></li>
      ))}</ul>
      <div className="sc-cert"><small>Certificate of completion</small><b>Grace Mensah</b><span>Foundation School · {SAMPLE}</span></div>
    </SceneFrame>
  );
}

/** Gather: an event with tickets and a committee */
export function SceneGather() {
  return (
    <SceneFrame title="Events" tag="Registration open">
      <div className="sc-event">
        <span className="sc-event__d"><small>DEC</small><b>12</b></span>
        <span><b>Rise: Youth Conference</b><small>3 days · Main auditorium and online</small></span>
      </div>
      <div className="sc-kpis sc-kpis--2">
        <div className="sc-k"><span>Registered</span><b>318</b></div>
        <div className="sc-k"><span>Committee</span><b>5 people</b></div>
      </div>
      <div className="sc-ticket"><span>Ticket</span><b>RISE-4F2K</b><i aria-hidden /></div>
    </SceneFrame>
  );
}

/** Steward: a fund request moving through its route */
export function SceneSteward() {
  return (
    <SceneFrame title="Fund requests" tag="With the pastor">
      <div className="sc-fund"><b>Two wireless microphones</b><small>Media · ₦588,500</small></div>
      <ol className="sc-route"><li className="on">Sent</li><li className="on">Finance checked</li><li className="cur">Pastor</li><li>Paid</li><li>Report</li></ol>
      <div className="sc-kpis sc-kpis--2">
        <div className="sc-k"><span>Paid this year</span><b>₦4.2m</b></div>
        <div className="sc-k"><span>Reports due</span><b>1</b></div>
      </div>
    </SceneFrame>
  );
}

/** The pastor's Home: church health at a glance */
export function ScenePastor() {
  const bars = [62, 70, 66, 74, 81, 78, 86, 92];
  return (
    <SceneFrame title={`Good morning, Pastor · ${SAMPLE}`} tag="Sample church">
      <div className="sc-kpis">
        <div className="sc-k"><span>Sunday attendance</span><b>486</b><small className="up">+6% on last month</small></div>
        <div className="sc-k"><span>First-timers this month</span><b>31</b><small className="up">24 already reached</small></div>
        <div className="sc-k"><span>Workers serving</span><b>128</b><small>11 departments</small></div>
      </div>
      <div className="sc-chart" aria-hidden>{bars.map((b, i) => <i key={i} style={{ "--h": `${b}%`, "--i": i } as React.CSSProperties} />)}</div>
      <p className="sc-insight"><b>3 first-timers</b> haven&apos;t been reached in 48 hours. Tap to see who.</p>
    </SceneFrame>
  );
}
