"use client";

import "./landing.css";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createStageEngine, splitWords } from "./engine";
import { SceneCare, SceneFollow, SceneGather, SceneGrow, ScenePastor, SceneSteward, SceneSunday } from "./scenes";
import { ChurchNumbers, Faq, HappySunday, Seats, SundayStory, WelcomeWord } from "./interactive";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL;

/** The orbiting circles from the pre-loader: people gathering around the church. */
function Orbit({ className = "" }: { className?: string }) {
  return (
    <div className={`lp-orbit ${className}`} aria-hidden>
      <span className="lp-orbit__ring r1" /><span className="lp-orbit__ring r2" /><span className="lp-orbit__ring r3" />
      {[0, 1, 2].map((k) => <span key={k} className="lp-orbit__arm" style={{ animationDelay: `${-k * 1.6}s` }}><i style={{ background: ["#4f46e5", "#f59e0b", "#a29bfa"][k] }} /></span>)}
      <span className="lp-orbit__heart" />
    </div>
  );
}

function Logo({ light }: { light?: boolean }) {
  return (
    <span className={`lp-logo ${light ? "lp-logo--light" : ""}`}>
      <span className="lp-logo__mark" aria-hidden><i /><i /><i /></span>
      <span className="lp-logo__word">Traqi<small>for Churches</small></span>
    </span>
  );
}

const SLIDES = ["Welcome", "Follow-up", "One place"];
const FEATURES = [
  { k: "Sunday", h: "Sunday, counted", p: "Check-in by code or QR, headcount by the ushers, roll call by each department. Every service, every branch.", img: "/landing/hands.jpg", scene: <SceneSunday /> },
  { k: "Follow-up", h: "No visitor forgotten", p: "Each first-timer is matched to a follow-up worker in seconds: same area, room this week. Ready WhatsApp messages, reminders after 48 hours.", img: "/landing/phone.jpg", scene: <SceneFollow /> },
  { k: "Care", h: "Care that stays private", p: "Welfare, prayer and counselling requests go only to the people who should see them. Counselling stays between the member, the handler and the pastor.", img: "/landing/care.jpg", scene: <SceneCare /> },
  { k: "Grow", h: "Classes that lead somewhere", p: "Foundation school, workers' training, marriage courses. Attendance by session, certificates with signatures, couples on one certificate.", img: "/landing/class.jpg", scene: <SceneGrow /> },
  { k: "Gather", h: "Events people come to", p: "Beautiful event pages, registration, tickets, check-in at the door, planning committees and invitations from members.", img: "/landing/friends.jpg", scene: <SceneGather /> },
  { k: "Steward", h: "Money, accounted for", p: "Offering counts with witnesses, fund requests that move from leader to finance to pastor, part payments and spending reports.", img: "/landing/admin.jpg", scene: <SceneSteward /> },
];
const JOURNEY = [
  { k: "First visit", p: "Welcomed at the door and checked in from their own phone." },
  { k: "Followed up", p: "A named person calls within 48 hours. The pastor sees if not." },
  { k: "In a class", p: "Foundation school, with attendance kept for each session." },
  { k: "Member", p: "Confirmed, in a household, with birthdays remembered." },
  { k: "Worker", p: "Serving in a department, on the roll call, growing." },
  { k: "Leader", p: "Leading people, with the tools to look after them." },
];
const MADE_HERE = [
  { h: "Phones first", p: "Every screen is built for the phone in your pocket, then the laptop in the office." },
  { h: "WhatsApp, built in", p: "Ready messages for welcomes, birthdays and follow-up. One tap opens WhatsApp." },
  { h: "Naira and more", p: "Offerings, tithes, projects and other income, counted in your currency." },
  { h: "Branches and regions", p: "One church, many locations. Each branch runs itself; headquarters sees it all." },
  { h: "Slow network? Fine.", p: "A copy stays on the phone, so Home opens at once and syncs when it can." },
  { h: "Any language at the door", p: "Welcome forms people understand, from Lagos to Nairobi to Abidjan." },
];

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const slideRef = useRef(0);
  const goRef = useRef<(n: number) => void>(() => {});

  useEffect(() => {
    const el = root.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.querySelectorAll<HTMLElement>("[data-split]").forEach((h) => splitWords(h, "mask"));
    const engine = createStageEngine(el, reduced);
    let lenis: { raf: (t: number) => void; stop: () => void; start: () => void; scrollTo: (t: HTMLElement | number, o?: object) => void; destroy: () => void } | null = null;
    let alive = true;
    if (!reduced) import("lenis").then(({ default: Lenis }) => { if (alive) lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95, smoothWheel: true }) as unknown as typeof lenis; });
    const progress = el.querySelector<HTMLElement>("[data-progress]");
    const header = el.querySelector<HTMLElement>(".lp-header");
    let raf = 0;
    const frame = (t: number) => {
      lenis?.raf(t);
      engine.update();
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress?.style.setProperty("--sp", String(max > 0 ? window.scrollY / max : 0));
      header?.classList.toggle("solid", window.scrollY > 40);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    engine.measure();
    document.fonts?.ready.then(() => alive && engine.measure());
    const onLoad = () => engine.measure();
    window.addEventListener("load", onLoad);
    setTimeout(() => el.querySelectorAll(".lp-hero .w-mask").forEach((m) => m.classList.add("w-done")), 2200);

    // Hero carousel: moves on by itself, and each scroll at the very top shows the next slide first
    const last = SLIDES.length - 1;
    let lockUntil = Date.now();
    const go = (n: number) => { slideRef.current = Math.max(0, Math.min(last, n)); setSlide(slideRef.current); lockUntil = Date.now() + 750; };
    goRef.current = go;
    const atTop = () => window.scrollY < 6;
    const step = (dir: 1 | -1, e: Event) => {
      if (reduced || !atTop()) return;
      const s = slideRef.current;
      if ((dir === 1 && s < last) || (dir === -1 && s > 0)) {
        e.preventDefault();
        if (Date.now() > lockUntil) go(s + dir);
      }
    };
    const onWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) > 4) step(e.deltaY > 0 ? 1 : -1, e); };
    let ty = 0;
    const onTouchStart = (e: TouchEvent) => { ty = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => { const d = ty - e.touches[0].clientY; if (Math.abs(d) > 30) { step(d > 0 ? 1 : -1, e); ty = e.touches[0].clientY; } };
    const onKey = (e: KeyboardEvent) => { if (["ArrowDown", "PageDown", " "].includes(e.key) && !(e.target as HTMLElement).closest("input,textarea,button,select")) step(1, e); if (["ArrowUp", "PageUp"].includes(e.key)) step(-1, e); };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    window.addEventListener("keydown", onKey);
    const auto = setInterval(() => { if (!reduced && window.scrollY < engine.vh * 0.6 && Date.now() > lockUntil + 6000) go(slideRef.current === last ? 0 : slideRef.current + 1); }, 1000);

    // In-page links glide with smooth scrolling
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='#']");
      if (!a) return;
      const t = el.querySelector<HTMLElement>(a.getAttribute("href")!);
      if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: 0 }); else t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    };
    el.addEventListener("click", onClick);
    return () => {
      alive = false; cancelAnimationFrame(raf); engine.destroy(); lenis?.destroy(); clearInterval(auto);
      window.removeEventListener("load", onLoad); window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("touchstart", onTouchStart); window.removeEventListener("touchmove", onTouchMove, { capture: true });
      window.removeEventListener("keydown", onKey); el.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div className="lp" ref={root}>
      <a href="#main" className="lp-skip">Skip to content</a>
      <header className="lp-header">
        <div className="lp-wrap lp-header__in">
          <Link href="/" aria-label="Traqi for Churches, home"><Logo /></Link>
          <nav className="lp-nav" aria-label="On this page">
            <a href="#features">What it does</a><a href="#journey">The journey</a><a href="#seats">For your team</a><a href="#trust">Privacy</a><a href="#faq">Questions</a>
          </nav>
          <div className="lp-header__cta">
            <Link href="/login" className="lp-btn lp-btn--ghost">Log in</Link>
            <Link href="/signup" className="lp-btn lp-btn--pri">Get started</Link>
          </div>
          <div className="lp-progress" aria-hidden><span data-progress /></div>
        </div>
      </header>

      <main id="main">
        {/* 1 · Hero */}
        <section className="stage lp-hero" data-stage data-noflow data-hold="0" aria-roledescription="carousel" aria-label="Traqi for Churches">
          <div className="stage__pin">
            <div className="lp-hero__frame">
              {/* Slide 1: welcome */}
              <article className={`lp-slide lp-slide--deep ${slide === 0 ? "is-active" : ""}`} aria-hidden={slide !== 0}>
                <div className="lp-slide__mobile" aria-hidden><Image src="/landing/family.jpg" alt="" fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "60% 30%" }} /></div>
                <div className="lp-slide__grid">
                  <div className="lp-slide__copy">
                    <div className="lp-kicker"><WelcomeWord /><HappySunday /></div>
                    <h1 className="lp-display" data-split>Every soul <em>known.</em> Every visitor <em>followed up.</em></h1>
                    <p className="lp-lede">Traqi is the church management app built for how churches in Africa actually run: on phones, on WhatsApp, every Sunday.</p>
                    <div className="lp-actions">
                      <Link href="/signup" className="lp-btn lp-btn--pri lp-btn--lg">Get started free <span aria-hidden>→</span></Link>
                      <Link href="/login" className="lp-btn lp-btn--light lp-btn--lg">Log in</Link>
                    </div>
                  </div>
                  <figure className="lp-hero__art">
                    <Orbit />
                    <div className="lp-frame lp-frame--arch"><Image src="/landing/family.jpg" alt="A family together at church on a Sunday" fill priority sizes="(max-width: 900px) 80vw, 40vw" style={{ objectFit: "cover", objectPosition: "45% 40%" }} /></div>
                    <span className="lp-note lp-note--a"><i className="dot" />First-timer checked in · 9:41 AM</span>
                    <span className="lp-note lp-note--b"><b>Assigned to Tola</b><small>Follow-up · just now</small></span>
                  </figure>
                </div>
              </article>
              {/* Slide 2: follow-up */}
              <article className={`lp-slide lp-slide--photo ${slide === 1 ? "is-active" : ""}`} aria-hidden={slide !== 1}>
                <Image src="/landing/worship.jpg" alt="" fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "50% 30%" }} />
                <div className="lp-slide__shade" />
                <div className="lp-slide__grid">
                  <div className="lp-slide__copy">
                    <span className="lp-label lp-label--light">Follow-up</span>
                    <h2 className="lp-display" data-split>No first-timer <em>slips through.</em></h2>
                    <p className="lp-lede">The moment a visitor checks in, Traqi gives them a name to call them, a message to send, and a nudge if no one has.</p>
                  </div>
                  <div className="lp-slide__scene"><SceneFollow /></div>
                </div>
              </article>
              {/* Slide 3: one place */}
              <article className={`lp-slide lp-slide--soft ${slide === 2 ? "is-active" : ""}`} aria-hidden={slide !== 2}>
                <div className="lp-slide__grid">
                  <div className="lp-slide__copy">
                    <span className="lp-label">One place</span>
                    <h2 className="lp-display lp-display--ink" data-split>Run the whole church from <em>one place.</em></h2>
                    <p className="lp-lede lp-lede--ink">People, Sundays, departments, classes, events, care and finance. Each person sees what their role needs, and nothing more.</p>
                    <div className="lp-actions"><a href="#features" className="lp-btn lp-btn--dark lp-btn--lg">See what it does <span aria-hidden>↓</span></a></div>
                  </div>
                  <div className="lp-slide__scene lp-slide__scene--wide"><ScenePastor /></div>
                </div>
              </article>
              <div className="lp-pager" role="tablist" aria-label="Slides">
                {SLIDES.map((s, k) => <button key={s} type="button" role="tab" aria-selected={slide === k} aria-label={`Show slide ${k + 1}: ${s}`} className={slide === k ? "on" : ""} onClick={() => goRef.current(k)}><i /></button>)}
                <span className="lp-pager__n">{String(slide + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2 · The problem, lit word by word */}
        <section className="stage lp-problem" data-stage data-hold="140" data-curtain aria-label="Why Traqi">
          <div className="stage__pin">
            <div className="lp-wrap lp-problem__in">
              <span className="lp-label">Why we built Traqi</span>
              <p className="lp-statement scrub" data-scrub="0,0.75">
                Visitors come once and <b>no one calls.</b> Workers drift away and <b>no one notices.</b> The church&apos;s records live in ten WhatsApp groups and <b>one tired admin&apos;s notebook.</b> Pastors deserve better than guessing.
              </p>
              <div className="lp-problem__foot rv" data-at="0.8"><Orbit className="lp-orbit--sm" /><span>Traqi keeps every person in view, so your people can do what they&apos;re called to do.</span></div>
            </div>
          </div>
        </section>

        {/* 3 · The journey */}
        <section className="stage lp-journey" id="journey" data-stage data-hold="220" data-curtain aria-labelledby="journey-h">
          <div className="stage__pin">
            <div className="lp-wrap lp-journey__in">
              <div className="lp-journey__lead">
                <span className="lp-label lp-label--light">The journey</span>
                <h2 id="journey-h" className="lp-h2 lp-h2--light">From first visit to the day they <em>lead.</em></h2>
                <ol className="lp-route" data-route="0.02,0.92">
                  <span className="lp-route__line" aria-hidden><i /></span>
                  {JOURNEY.map((j, i) => (
                    <li key={j.k} className="rstop" style={{ "--c": `var(--j${i + 1})` } as React.CSSProperties}><span className="rstop__dot" /><b>{j.k}</b><small>{j.p}</small></li>
                  ))}
                </ol>
              </div>
              <div className="lp-journey__art" aria-hidden>
                <div className="lp-rings">{JOURNEY.map((j, i) => <span key={j.k} className="lp-rings__r" style={{ "--n": i } as React.CSSProperties} />)}<span className="lp-rings__you" /><span className="lp-rings__core">Traqi</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 · Inside Traqi */}
        <section className="stage lp-features" id="features" data-stage data-hold="340" data-curtain aria-labelledby="features-h">
          <div className="stage__pin">
            <div className="lp-wrap lp-features__in">
              <div className="lp-features__lead">
                <span className="lp-label">Inside Traqi</span>
                <h2 id="features-h" className="lp-h2">Six things every church does. <em>Done well.</em></h2>
                <div className="lp-features__count"><b data-deck-n>01</b> / {String(FEATURES.length).padStart(2, "0")}<span className="lp-ticks">{FEATURES.map((f) => <i key={f.k} />)}</span></div>
                <ul className="lp-features__names" data-deck-names>{FEATURES.map((f, i) => <li key={f.k} style={{ "--i": i } as React.CSSProperties}>{f.k}</li>)}</ul>
              </div>
              <ol className="lp-deck deck-stack" data-deck="0.02,0.9" data-deck-mode="stack" data-deck-counter>
                {FEATURES.map((f) => (
                  <li key={f.k} className="lp-card">
                    <div className="lp-card__photo"><Image src={f.img} alt="" fill sizes="(max-width: 900px) 90vw, 30vw" style={{ objectFit: "cover" }} /></div>
                    <div className="lp-card__body">
                      <span className="lp-card__k">{f.k}</span>
                      <h3>{f.h}</h3>
                      <p>{f.p}</p>
                    </div>
                    <div className="lp-card__scene">{f.scene}</div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 5 · A Sunday in 60 seconds */}
        <section className="lp-section lp-section--deep" id="sunday" aria-labelledby="sunday-h">
          <div className="lp-wrap">
            <span className="lp-label lp-label--light">A Sunday in 60 seconds</span>
            <h2 id="sunday-h" className="lp-h2 lp-h2--light">Follow one visitor through <em>Graceville Church.</em></h2>
            <p className="lp-sub lp-sub--light">Graceville is our sample church. Tap through what happens when someone walks in for the first time.</p>
            <SundayStory />
          </div>
        </section>

        {/* 6 · Pick your seat */}
        <section className="lp-section" id="seats" aria-labelledby="seats-h">
          <div className="lp-wrap">
            <span className="lp-label">Pick your seat</span>
            <h2 id="seats-h" className="lp-h2">The same church, <em>seen from every seat.</em></h2>
            <p className="lp-sub">Everyone opens Traqi to a Home made for their role. Choose one to see it.</p>
            <Seats />
          </div>
        </section>

        {/* 7 · Moments */}
        <section className="stage lp-moments" data-stage data-hold="120" aria-label="The people Traqi is for">
          <div className="stage__pin">
            <div className="lp-wrap lp-moments__in">
              <h2 className="lp-h2 lp-moments__h rv" data-at="0">Built for the people in the pews, the workers behind the scenes, <em>and the pastors who carry them all.</em></h2>
              <div className="lp-moments__grid">
                {[["brothers", "Young men laughing together after church", 0.05], ["embrace", "Two friends embracing during worship", 0.18], ["media", "The media team streaming the service", 0.3], ["smiles", "Two friends smiling", 0.42]].map(([src, alt, at], i) => (
                  <figure key={src as string} className={`lp-moment lp-moment--${i} rv`} data-at={String(at)}>
                    <Image src={`/landing/${src}.jpg`} alt={alt as string} fill sizes="(max-width: 900px) 50vw, 25vw" style={{ objectFit: "cover" }} />
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 8 · Made for here */}
        <section className="stage lp-here" data-stage data-hold="180" data-curtain aria-labelledby="here-h">
          <div className="stage__pin">
            <div className="lp-wrap lp-here__in">
              <div className="lp-here__head">
                <span className="lp-label lp-label--light">Made for here</span>
                <h2 id="here-h" className="lp-h2 lp-h2--light">Built for African churches, <em>not adapted for them.</em></h2>
              </div>
              <div className="lp-here__vp">
                <div className="lp-here__track" data-track>
                  {MADE_HERE.map((m, i) => <article key={m.h} className="lp-tile"><span>{String(i + 1).padStart(2, "0")}</span><h3>{m.h}</h3><p>{m.p}</p></article>)}
                </div>
              </div>
              <div className="lp-here__bar" aria-hidden><i /></div>
            </div>
          </div>
        </section>

        {/* 9 · Your church in numbers */}
        <section className="lp-section" id="numbers" aria-labelledby="numbers-h">
          <div className="lp-wrap">
            <span className="lp-label">Your church, in numbers</span>
            <h2 id="numbers-h" className="lp-h2">What would follow-up look like <em>at your church?</em></h2>
            <p className="lp-sub">Move the sliders. Everything below comes from your numbers.</p>
            <ChurchNumbers />
          </div>
        </section>

        {/* 10 · Privacy */}
        <section className="stage lp-trust" id="trust" data-stage data-hold="110" data-curtain aria-labelledby="trust-h">
          <div className="stage__pin">
            <div className="lp-wrap lp-trust__in">
              <div>
                <span className="lp-label lp-label--light">Privacy and trust</span>
                <h2 id="trust-h" className="lp-h2 lp-h2--light">People tell the church things they tell <em>no one else.</em></h2>
              </div>
              <ul className="lp-trust__list">
                {[["Counselling stays private", "Only the member, the person handling it and the pastor can read what was shared."], ["Care never leaves", "Care notes, welfare and prayer requests never appear in downloads or emails."], ["Your church, walled off", "Every church's data is kept apart from every other church's, enforced by the database itself."], ["Phone numbers protect people", "Typing someone's number never reveals what's stored about them."]].map(([h, p], i) => (
                  <li key={h} className="rv" data-at={String(0.05 + i * 0.16)}><b>{h}</b><span>{p}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 11 · Founder note and early access */}
        <section className="lp-section lp-section--cream" aria-labelledby="why-h">
          <div className="lp-wrap lp-founder">
            <blockquote>
              <h2 id="why-h" className="lp-h2">&ldquo;I built Traqi because I&apos;ve watched good people slip out of church <em>simply because nobody noticed.</em> Every person matters. Now every church can show it.&rdquo;</h2>
              <footer>Temi Aderinwale, founder of Traqi</footer>
            </blockquote>
            <div className="lp-early">
              <span className="lp-label">Early access</span>
              <b>Free, with everything switched on.</b>
              <p>Set up your church in about two minutes: your name, your departments, your services. Invite your team when you&apos;re ready.</p>
              <Link href="/signup" className="lp-btn lp-btn--pri lp-btn--lg">Get started free <span aria-hidden>→</span></Link>
              {DEMO_URL && <a href={DEMO_URL} className="lp-btn lp-btn--ghost lp-btn--lg">Try the sample church</a>}
            </div>
          </div>
        </section>

        {/* 12 · Questions */}
        <section className="lp-section" id="faq" aria-labelledby="faq-h">
          <div className="lp-wrap lp-faqwrap">
            <div><span className="lp-label">Questions pastors ask</span><h2 id="faq-h" className="lp-h2">Straight <em>answers.</em></h2></div>
            <Faq />
          </div>
        </section>

        {/* 13 · Doors */}
        <section className="stage lp-doors" id="get-started" data-stage data-hold="40" data-curtain aria-label="Get started">
          <div className="stage__pin">
            <div className="lp-wrap lp-doors__in">
              <Link href="/signup" className="lp-door lp-door--church">
                <span className="lp-door__big" aria-hidden>Churches</span>
                <span className="lp-door__k">For pastors and church admins</span>
                <span className="lp-door__h">Bring your church onto Traqi.</span>
                <span className="lp-door__cta">Get started <span aria-hidden>→</span></span>
              </Link>
              <Link href="/login" className="lp-door lp-door--member">
                <span className="lp-door__big" aria-hidden>Members</span>
                <span className="lp-door__k">Already part of a church on Traqi</span>
                <span className="lp-door__h">Sign in with Google or your email.</span>
                <span className="lp-door__cta">Log in <span aria-hidden>→</span></span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer__in">
          <div><Logo light /><p>Know every person in your church, from first visit to leadership.</p></div>
          <nav aria-label="Footer"><a href="#features">What it does</a><a href="#seats">For your team</a><a href="#trust">Privacy</a><a href="#faq">Questions</a><Link href="/login">Log in</Link><Link href="/signup">Get started</Link></nav>
          <p className="lp-footer__small">© {new Date().getFullYear()} Traqi. Sample church: Graceville Church is made up, to show how Traqi works. Photos from Unsplash by Ayodele Adeniyi, Joseph Agboola, Bennie Bates, proudlyswazi, Vitaly Gariev, Ninthgrid, Patrick Marion, Mark Stuckey, Andra C Taylor Jr, Dwayne Joe, Thought Catalog and Thiago BF.</p>
        </div>
      </footer>
    </div>
  );
}
