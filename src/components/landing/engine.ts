/**
 * The landing page's scroll engine, after the Ascendia Innovations site.
 *
 * Every <section data-stage data-hold="N"> pins its frame for N% of a screen of scrolling.
 * While pinned, the page holds still and details arrive. A following section marked
 * data-curtain slides over it, and the pinned one recedes (shrinks, shades, rounds its corners).
 *
 * Inside a stage:
 *   data-at="0.4"        gets .in once the stage is 40% through
 *   data-scrub="a,b"     words light up between a and b
 *   data-deck="a,b"      children arrive one by one (.in/.active/.past, --k depth); data-deck-mode="stack"
 *   data-deck-counter    updates [data-deck-n] and .lp-ticks i
 *   data-track           a row that moves sideways with the scroll
 *   data-route="a,b"     a line that fills, lighting its stops
 * Every stage also gets --p (progress through the hold) and --q (how far the next sheet has covered it).
 *
 * Reduced motion, short screens, or a frame that doesn't fit: normal scrolling, everything shown.
 */
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (s: string | undefined, f: [number, number] = [0, 1]): [number, number] => (s ? (s.split(",").map(Number) as [number, number]) : f);

/** Split text into word spans, keeping <em> and <b>. 'mask' rises out of a clip; 'scrub' lights up with scroll. */
export function splitWords(el: HTMLElement, mode: "mask" | "scrub" = "mask"): HTMLElement[] {
  if (el.dataset.splitDone) return [...el.querySelectorAll<HTMLElement>(mode === "mask" ? ".w-in" : ".w")];
  const words: HTMLElement[] = [];
  const walk = (node: Node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        (child.textContent ?? "").split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
          if (mode === "mask") {
            const m = document.createElement("span"); m.className = "w-mask";
            const i = document.createElement("span"); i.className = "w-in"; i.textContent = part;
            m.appendChild(i); frag.appendChild(m); words.push(i);
          } else {
            const w = document.createElement("span"); w.className = "w"; w.textContent = part;
            frag.appendChild(w); words.push(w);
          }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
    });
  };
  walk(el);
  if (mode === "mask") words.forEach((w, i) => w.style.setProperty("--i", String(i)));
  el.dataset.splitDone = "1";
  return words;
}

type Deck = { n: HTMLElement; items: HTMLElement[]; r: [number, number]; mode: string; counter: HTMLElement | null; ticks: HTMLElement[]; names: HTMLElement[]; shown: number };
type Stage = {
  el: HTMLElement; pin: HTMLElement; index: number; holdVh: number; curtain: boolean; nextIsCurtain: boolean;
  flow: boolean; top: number; hold: number; height: number; p: number; q: number;
  reveals: { n: HTMLElement; at: number }[];
  scrubs: { words: HTMLElement[]; r: [number, number]; lit: number }[];
  decks: Deck[];
  track: HTMLElement | null; trackMax: number;
  route: HTMLElement | null;
};

export function createStageEngine(root: HTMLElement, reducedMotion: boolean) {
  const html = document.documentElement;
  const all = [...root.querySelectorAll<HTMLElement>("[data-stage]")];
  const stages: Stage[] = all.map((el, i) => ({
    el, pin: el.querySelector<HTMLElement>(":scope > .stage__pin")!, index: i,
    holdVh: parseFloat(el.dataset.hold || "0"),
    // A sheet only slides over the stage directly before it, not over ordinary sections in between
    curtain: el.hasAttribute("data-curtain") && !!all[i - 1] && el.previousElementSibling === all[i - 1],
    nextIsCurtain: !!all[i + 1]?.hasAttribute("data-curtain") && el.nextElementSibling === all[i + 1],
    flow: false, top: 0, hold: 0, height: 0, p: -1, q: -1,
    reveals: [...el.querySelectorAll<HTMLElement>("[data-at]")].map((n) => ({ n, at: parseFloat(n.dataset.at!) })),
    scrubs: [...el.querySelectorAll<HTMLElement>("[data-scrub]")].map((n) => ({ words: splitWords(n, "scrub"), r: range(n.dataset.scrub), lit: -1 })),
    decks: [...el.querySelectorAll<HTMLElement>("[data-deck]")].map((n) => ({
      n, items: [...n.children] as HTMLElement[], r: range(n.dataset.deck), mode: n.dataset.deckMode || "seq",
      counter: n.hasAttribute("data-deck-counter") ? el.querySelector<HTMLElement>("[data-deck-n]") : null,
      ticks: n.hasAttribute("data-deck-counter") ? [...el.querySelectorAll<HTMLElement>(".lp-ticks i")] : [],
      names: [...el.querySelectorAll<HTMLElement>("[data-deck-names] > *")], shown: -1,
    })),
    track: el.querySelector<HTMLElement>("[data-track]"), trackMax: 0,
    route: el.querySelector<HTMLElement>("[data-route]"),
  }));

  let vh = window.innerHeight; let vw = window.innerWidth; let enabled = false;

  function measure() {
    vh = window.innerHeight; vw = window.innerWidth;
    html.style.setProperty("--vh", `${vh}px`);
    enabled = !reducedMotion && vh >= 540 && vw >= 320;
    root.classList.toggle("stages-on", enabled);
    root.classList.toggle("stages-off", !enabled);
    stages.forEach((s) => { s.el.style.height = ""; s.el.style.marginTop = ""; s.el.classList.remove("stage--flow"); s.flow = !enabled || s.el.hasAttribute("data-flow"); if (s.flow && enabled) s.el.classList.add("stage--flow"); });
    if (enabled) {
      root.classList.add("is-measuring");
      stages.forEach((s) => {
        const inner = s.pin.firstElementChild as HTMLElement | null;
        if (!inner || s.flow || s.el.hasAttribute("data-noflow")) return;
        if (Math.max(s.pin.scrollHeight, inner.scrollHeight) > vh + 4) { s.flow = true; s.el.classList.add("stage--flow"); }
      });
      root.classList.remove("is-measuring");
    }
    stages.forEach((s) => {
      if (s.flow) return;
      s.hold = (s.holdVh / 100) * vh;
      s.height = vh + s.hold + (s.nextIsCurtain ? vh : 0);
      s.el.style.height = `${s.height}px`;
    });
    stages.forEach((s, i) => {
      const prev = stages[i - 1];
      s.el.classList.toggle("is-curtain", s.curtain);
      if (s.curtain && prev && !prev.flow && !s.flow) s.el.style.marginTop = `${-vh}px`;
      if (!s.flow && s.nextIsCurtain && stages[i + 1]?.flow) { s.height = vh + s.hold; s.el.style.height = `${s.height}px`; }
    });
    const y = window.scrollY;
    stages.forEach((s) => {
      s.top = s.el.getBoundingClientRect().top + y;
      if (s.track) s.trackMax = Math.max(0, s.track.scrollWidth - (s.track.parentElement?.clientWidth ?? 0));
      s.p = -1; s.q = -1;
    });
    update(true);
  }

  function setDeck(d: Deck, local: number) {
    const n = d.items.length;
    let shown = local <= 0 ? 0 : Math.min(n, Math.floor(local * n) + 1);
    if (d.mode === "stack") shown = Math.max(1, shown);
    if (shown === d.shown) return;
    d.shown = shown;
    d.items.forEach((item, i) => {
      const isIn = i < shown;
      item.classList.toggle("in", isIn);
      item.classList.toggle("active", isIn && i === shown - 1);
      item.classList.toggle("past", isIn && i < shown - 1);
      item.style.setProperty("--k", String(isIn ? shown - 1 - i : 0));
    });
    if (d.counter) d.counter.textContent = String(Math.max(1, shown)).padStart(2, "0");
    d.ticks.forEach((t, i) => t.classList.toggle("on", i < shown));
    d.names.forEach((t, i) => t.classList.toggle("on", i === Math.max(1, shown) - 1));
  }

  function apply(s: Stage, p: number, q: number) {
    const pr = Math.round(p * 1000) / 1000; const qr = Math.round(q * 1000) / 1000;
    if (qr !== s.q) { s.el.style.setProperty("--q", String(qr)); s.q = qr; }
    if (pr === s.p) return;
    s.p = pr;
    s.el.style.setProperty("--p", String(pr));
    s.reveals.forEach((r) => r.n.classList.toggle("in", p >= r.at));
    s.scrubs.forEach((sc) => {
      const lit = Math.round(clamp((p - sc.r[0]) / (sc.r[1] - sc.r[0] || 1)) * sc.words.length);
      if (lit === sc.lit) return;
      sc.lit = lit; sc.words.forEach((w, i) => w.classList.toggle("lit", i < lit));
    });
    s.decks.forEach((d) => setDeck(d, clamp((p - d.r[0]) / (d.r[1] - d.r[0] || 1))));
    if (s.track) {
      const local = s.flow ? 0 : clamp((p - 0.04) / 0.92);
      s.track.style.transform = `translate3d(${-local * s.trackMax}px,0,0)`;
      s.el.style.setProperty("--tp", String(s.flow ? 1 : local));
    }
    if (s.route) {
      const [a, b] = range(s.route.dataset.route);
      const local = s.flow ? 1 : clamp((p - a) / (b - a));
      s.route.style.setProperty("--rf", String(local));
      const stops = [...s.route.querySelectorAll<HTMLElement>(".rstop")];
      const cur = Math.min(stops.length - 1, Math.floor(local * stops.length - 0.001));
      stops.forEach((st, i) => { st.classList.toggle("in", i <= cur || s.flow); st.classList.toggle("is-current", i === Math.max(0, cur)); });
      s.el.style.setProperty("--stop", String(Math.max(0, cur)));
    }
  }

  function update(force = false) {
    const y = window.scrollY;
    stages.forEach((s) => {
      if (force) { s.p = -1; s.q = -1; }
      if (s.flow) { if (s.p !== 1) apply(s, 1, 0); return; }
      const p = s.hold > 0 ? clamp((y - s.top) / s.hold) : y >= s.top ? 1 : 0;
      const q = s.nextIsCurtain && !stages[s.index + 1]?.flow ? clamp((y - s.top - s.hold) / vh) : 0;
      apply(s, p, q);
    });
  }

  let lastW = vw; let lastH = vh; let t: ReturnType<typeof setTimeout>;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      // Mobile address bars change the height a little as you scroll; only re-measure on real changes
      if (window.innerWidth !== lastW || Math.abs(window.innerHeight - lastH) > 140) { lastW = window.innerWidth; lastH = window.innerHeight; measure(); }
    }, 120);
  };
  window.addEventListener("resize", onResize);
  return { measure, update, get vh() { return vh; }, destroy() { window.removeEventListener("resize", onResize); clearTimeout(t); } };
}
