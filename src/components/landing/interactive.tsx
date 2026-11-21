"use client";

import { useEffect, useState } from "react";
import { SAMPLE, ScenePastor, SceneFrame } from "./scenes";

/** "Welcome" in languages spoken across Africa. */
const WELCOME = [
  { w: "Welcome", l: "English" }, { w: "Ẹ káàbọ̀", l: "Yorùbá" }, { w: "Nnọọ", l: "Igbo" }, { w: "Barka da zuwa", l: "Hausa" },
  { w: "Bienvenue", l: "Français" }, { w: "Karibu", l: "Kiswahili" },
];
export function WelcomeWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % WELCOME.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="lp-welcome" aria-label="Welcome, in six languages">
      <span key={i} className="lp-welcome__w">{WELCOME[i].w}</span>
      <span key={`l${i}`} className="lp-welcome__l">{WELCOME[i].l}</span>
    </span>
  );
}

/** On Sundays (in the visitor's own time), a small "Happy Sunday". */
export function HappySunday() {
  const [sunday, setSunday] = useState(false);
  useEffect(() => { setSunday(new Date().getDay() === 0); }, []);
  if (!sunday) return null;
  return <span className="lp-sunday"><span aria-hidden>☀</span> Happy Sunday</span>;
}

/** Pick your seat: the same church, seen from each role's Home. */
const SEATS = [
  { k: "pastor", label: "Lead pastor", line: "The whole church at a glance, every morning.", points: ["Attendance, first-timers and giving trends", "Who hasn't been reached in 48 hours", "Approvals waiting for you, in one place"] },
  { k: "admin", label: "Admin", line: "Records, events and people, without the spreadsheets.", points: ["Add people once; everyone sees what they're allowed to", "Events with registration, tickets and check-in", "Leaders' roll call and church-wide messages"] },
  { k: "follow", label: "Follow-up", line: "Every visitor has a name next to them.", points: ["First-timers assigned the moment they check in", "Ready-made WhatsApp messages", "Log each call; nothing slips"] },
  { k: "usher", label: "Head usher", line: "The headcount and the count, done before the benediction.", points: ["Headcount by service", "Offering counts with a witness", "Hand it to an assistant when you're away"] },
  { k: "finance", label: "Finance", line: "Every naira asked for, approved, paid and accounted for.", points: ["Fund requests with budgets and send-back", "Part payments and refunds", "Spending reports with receipts"] },
  { k: "member", label: "Member", line: "Church in your pocket.", points: ["Check in on Sundays from your phone", "“I met someone” and “I need help”, one tap away", "Your classes, events and sermons"] },
] as const;

function SeatScene({ k }: { k: (typeof SEATS)[number]["k"] }) {
  if (k === "pastor") return <ScenePastor />;
  const rows: Record<string, [string, string, string?][]> = {
    admin: [["Rise: Youth Conference", "318 registered · committee of 5"], ["Leaders' roll call", "Sunday · 41 of 44 present", "ok"], ["New people this week", "12 added · 3 need a department"]],
    follow: [["Adaeze Okafor", "First-timer · assigned to you · call today", "glow"], ["Chinedu Obi", "Called · would like a visit", "ok"], ["Precious Danjuma", "Came back for a second Sunday", "ok"]],
    usher: [["1st service headcount", "486 · men 201 · women 238 · children 47", "ok"], ["Offering count", "Waiting for your witness", "glow"], ["Assistant", "Bola takes headcount when you're away"]],
    finance: [["Two wireless microphones", "₦588,500 · with you to review", "glow"], ["Choir robes repair", "Part paid · ₦50,000 left"], ["Welfare store restock", "Report accepted · ₦6,800 returned", "ok"]],
    member: [["Sunday service", "Check in opens 30 minutes before", "ok"], ["Foundation School", "Week 4 of 6 · Thursday 6 PM"], ["Your counselling session", "Booked · Saturday, 10:00 AM", "ok"]],
  };
  const title = { admin: "Admin · Home", follow: "Follow-up · Home", usher: "Head usher · Home", finance: "Finance · Home", member: "Your Home" }[k];
  return (
    <SceneFrame title={`${title} · ${SAMPLE}`} tag="Sample church">
      <ul className="sc-rows">{rows[k].map(([a, b, t], i) => (
        <li key={a} style={{ "--i": i } as React.CSSProperties} className={t ? `t-${t}` : ""}><b>{a}</b><small>{b}</small></li>
      ))}</ul>
    </SceneFrame>
  );
}

export function Seats() {
  const [k, setK] = useState<(typeof SEATS)[number]["k"]>("pastor");
  const s = SEATS.find((x) => x.k === k)!;
  return (
    <div className="lp-seats">
      <div className="lp-seats__tabs" role="tablist" aria-label="Pick your seat">
        {SEATS.map((x) => <button key={x.k} type="button" role="tab" aria-selected={x.k === k} onClick={() => setK(x.k)} className={x.k === k ? "on" : ""}>{x.label}</button>)}
      </div>
      <div className="lp-seats__body" key={k}>
        <div className="lp-seats__copy">
          <h3>{s.line}</h3>
          <ul>{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="lp-seats__scene"><SeatScene k={k} /></div>
      </div>
    </div>
  );
}

/** A Sunday in 60 seconds: tap through what happens when a visitor walks in. */
const STEPS = [
  { t: "9:41 AM", h: "Adaeze walks in for the first time", p: "She scans the code at the door and fills a short welcome form on her phone. No paper, no queue." },
  { t: "9:41 AM", h: "Traqi finds the right person", p: "Tola from the follow-up team lives nearby and has room this week, so Adaeze is assigned to her straight away." },
  { t: "10:02 AM", h: "Tola sends a warm hello", p: "A ready-made WhatsApp message, with Adaeze's name in it. One tap to send, one tap to log it." },
  { t: "1:15 PM", h: "The pastor sees it on Home", p: "9 first-timers today, all assigned. If anyone isn't reached in 48 hours, it rises to the top." },
  { t: "6 weeks later", h: "Adaeze finishes Foundation School", p: "Her journey moves on: member, then worker. Nobody had to remember; Traqi did." },
];
export function SundayStory() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => (i < STEPS.length - 1 ? setI(i + 1) : setAuto(false)), 4200);
    return () => clearTimeout(t);
  }, [auto, i]);
  return (
    <div className="lp-story">
      <ol className="lp-story__steps">{STEPS.map((s, k) => (
        <li key={k} className={k === i ? "on" : k < i ? "done" : ""}>
          <button type="button" onClick={() => { setI(k); setAuto(false); }}><span>{s.t}</span><b>{s.h}</b></button>
        </li>
      ))}</ol>
      <div className="lp-story__stage" aria-live="polite">
        <div className="lp-phone" key={i}>
          <div className="lp-phone__notch" />
          {i === 0 && <div className="ph ph-form"><small>{SAMPLE}</small><b>Welcome! We&apos;re glad you came.</b><span className="ph-in">Adaeze Okafor</span><span className="ph-in">0803 ••• 4417</span><span className="ph-in">Lekki</span><span className="ph-btn">Say hello</span></div>}
          {i === 1 && <div className="ph ph-assign"><small>Assigned automatically</small><b>Adaeze → Tola</b><span className="ph-why">Same area</span><span className="ph-why">Room this week</span><span className="ph-why">Comes every Sunday</span></div>}
          {i === 2 && <div className="ph ph-wa"><small>WhatsApp</small><p>Hi Adaeze! It was lovely having you at {SAMPLE} today. How did you find the service? 🙂</p><p className="me">Thank you Tola! I really enjoyed it 🙏🏾</p></div>}
          {i === 3 && <div className="ph ph-home"><small>Pastor&apos;s Home</small><b>9 first-timers today</b><span className="ph-bar"><i style={{ width: "100%" }} /></span><span className="ph-ok">All assigned</span><span className="ph-ok">6 already reached</span></div>}
          {i === 4 && <div className="ph ph-journey"><small>Adaeze&apos;s journey</small>{["First visit", "Followed up", "Foundation School", "Member", "Worker"].map((x, k) => <span key={x} className={k <= 3 ? "on" : ""}>{x}</span>)}</div>}
        </div>
        <div className="lp-story__copy">
          <span className="lp-story__time">{STEPS[i].t}</span>
          <h3>{STEPS[i].h}</h3>
          <p>{STEPS[i].p}</p>
          <div className="lp-story__nav">
            <button type="button" onClick={() => { setI(Math.max(0, i - 1)); setAuto(false); }} disabled={i === 0}>Back</button>
            {i < STEPS.length - 1 ? <button type="button" className="pri" onClick={() => { setI(i + 1); setAuto(false); }}>Next</button> : <button type="button" className="pri" onClick={() => { setI(0); setAuto(true); }}>Watch again</button>}
            {!auto && i === 0 && <button type="button" className="ghost" onClick={() => setAuto(true)}>▶ Play it for me</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Your church, in numbers: worked out only from what the pastor types in. */
export function ChurchNumbers() {
  const [att, setAtt] = useState(300);
  const [ft, setFt] = useState(20);
  const [team, setTeam] = useState(6);
  const perWorker = team > 0 ? Math.ceil(ft / team) : ft;
  const perWeek = Math.round((ft / 4.3) * 10) / 10;
  const firstYear = ft * 12;
  const num = (v: number, set: (n: number) => void, max: number, label: string) => (
    <label className="lp-num">
      <span>{label}</span>
      <input type="range" min={0} max={max} value={v} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
      <input type="number" min={0} max={max * 4} value={v} onChange={(e) => set(Math.max(0, Number(e.target.value)))} aria-label={`${label} (type a number)`} />
    </label>
  );
  return (
    <div className="lp-calc">
      <div className="lp-calc__in">
        {num(att, setAtt, 3000, "People on a Sunday")}
        {num(ft, setFt, 200, "First-timers a month")}
        {num(team, setTeam, 60, "People on your follow-up team")}
      </div>
      <div className="lp-calc__out">
        <div><b>{perWeek}</b><span>new people to call each week</span></div>
        <div><b>{perWorker}</b><span>a month for each follow-up worker, shared out fairly</span></div>
        <div><b>{firstYear.toLocaleString()}</b><span>first-timers a year, each with a name beside them</span></div>
        <p>With {att.toLocaleString()} people on a Sunday, Traqi keeps the headcount, the check-ins and every first-timer&apos;s journey in one place, so none of those {firstYear.toLocaleString()} depends on someone remembering.</p>
      </div>
    </div>
  );
}

const FAQ = [
  ["Who owns our church's data?", "Your church does. You can download your people, attendance and records as Excel at any time. Care notes, welfare and counselling never leave Traqi in a download."],
  ["What does it cost?", "Traqi is free during early access, with everything switched on. We'll tell you well ahead of any change, and early churches will be looked after."],
  ["What if some workers only have basic phones?", "Ushers and leaders can record for them. Members without smartphones can still be checked in, followed up and added to classes by someone else."],
  ["We have branches. Can they use it?", "Yes. Each branch sees its own people; headquarters and regional overseers see across the branches they oversee."],
  ["What about poor network?", "Traqi keeps a copy on your phone, so Home opens straight away, then catches up when the network does."],
  ["Can we leave and take our records?", "Yes. Download everything and go. No contracts."],
];
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="lp-faq">{FAQ.map(([q, a], i) => (
      <li key={q} className={open === i ? "open" : ""}>
        <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}><span>{q}</span><i aria-hidden>+</i></button>
        <div className="lp-faq__a"><p>{a}</p></div>
      </li>
    ))}</ul>
  );
}
