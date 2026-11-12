/**
 * The church's colour, everywhere.
 * From one colour Traqi makes a full set of matching shades, keeps buttons readable,
 * and produces the values for the light and dark themes.
 */

export type ThemeMode = "light" | "dark" | "auto";
export type HeadingStyle = "modern" | "classic" | "bold";

type RGB = [number, number, number];

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export function hexToRgb(hex: string): RGB {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6) || "4f46e5", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("")}`;

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** WCAG relative luminance and contrast. */
export function luminance(hex: string) {
  const c = hexToRgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export type Palette = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>;
const STOPS: [keyof Palette, number][] = [[50, .97], [100, .93], [200, .86], [300, .76], [400, .64], [500, .53], [600, .45], [700, .37], [800, .29], [900, .21], [950, .13]];

/** Ten matching shades from one colour, keeping its hue. */
export function palette(hex: string): Palette {
  const [h, s] = rgbToHsl(hexToRgb(hex));
  const sat = Math.max(s, 0.18); // greys still get a gentle tint
  const out = {} as Palette;
  STOPS.forEach(([k, l]) => {
    // Very light and very dark shades carry a little less saturation, as good palettes do
    const ss = clamp(sat * (l > 0.9 ? 0.75 : l < 0.2 ? 0.7 : 1));
    out[k] = rgbToHex(hslToRgb(h, ss, l));
  });
  return out;
}

/** The church colour itself, deepened only as far as needed for white text to read on it. */
export function readableBrand(hex: string) {
  const [h, s, l0] = rgbToHsl(hexToRgb(hex));
  let l = l0, c = rgbToHex(hslToRgb(h, s, l));
  while (contrast(c, "#ffffff") < 4.5 && l > 0.05) { l -= 0.02; c = rgbToHex(hslToRgb(h, s, l)); }
  return c;
}
/** The colour lightened until it reads on a dark background. */
function readableOnDark(hex: string, bg: string) {
  const [h, s, l0] = rgbToHsl(hexToRgb(hex));
  let l = Math.max(l0, 0.55), c = rgbToHex(hslToRgb(h, s, l));
  while (contrast(c, bg) < 4.5 && l < 0.92) { l += 0.02; c = rgbToHex(hslToRgb(h, s, l)); }
  return c;
}

/** A matching accent when the church didn't choose one: a warm gold for cool colours, a deep teal for warm ones. */
export function autoAccent(hex: string) {
  const [h] = rgbToHsl(hexToRgb(hex));
  return h >= 20 && h <= 70 ? "#0f766e" : "#f59e0b";
}

/** Find the main colours in an uploaded logo, for one-tap choices. */
export async function logoColours(src: string, max = 5): Promise<string[]> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const c = document.createElement("canvas"); c.width = c.height = 48;
  const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, 48, 48);
  const d = ctx.getImageData(0, 0, 48, 48).data;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    const [, s, l] = rgbToHsl([r, g, b]);
    if (s < 0.22 || l > 0.92 || l < 0.08) continue; // skip white, black and greys
    const k = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const v = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    v.n++; v.r += r; v.g += g; v.b += b; buckets.set(k, v);
  }
  return [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, max).map((v) => rgbToHex([v.r / v.n, v.g / v.n, v.b / v.n]));
}

/** Every colour value the interface uses, for one theme. */
export function themeVars(main: string, accent: string | undefined, mode: "light" | "dark"): Record<string, string> {
  const p = palette(main);
  const brand = readableBrand(main);
  const acc = accent || autoAccent(main);
  // Deep: the dark, church-tinted tone used for heroes and the side menu in both themes
  const deep = palette(main)[950];
  const deep2 = palette(main)[900];
  const common = {
    "--church": main, "--color-accent": acc, "--color-deep": deep, "--color-deep-2": deep2,
    "--color-j1": p[100], "--color-j2": p[200], "--color-j3": p[300], "--color-j4": p[400], "--color-j5": brand, "--color-j6": p[800],
    "--hero-a": p[500], "--hero-b": p[300],
  };
  if (mode === "light") return {
    ...common,
    "--color-brand": brand, "--color-brand-hover": palette(brand)[700], "--color-brand-soft": p[50], "--color-brand-ink": palette(brand)[700],
    // Text and borders carry only a hint of the church colour, so any colour stays easy to read
    "--color-ink": mix(p[950], "#15141c", 0.75), "--color-ink-soft": mix(p[800], "#3d3d4b", 0.78), "--color-muted": ensure(mix(p[700], "#71717f", 0.82), "#ffffff", 4.6),
    "--color-page": mix(p[50], "#f6f6f8", 0.65), "--color-surface": "#ffffff", "--color-line": mix(p[100], "#e7e7ed", 0.65),
    "--color-glow": "#f59e0b", "--color-glow-soft": "#fff6e5", "--color-glow-ink": "#8a5300",
    "--color-good": "#0e9f6e", "--color-good-soft": "#e6f7f0", "--color-alert": "#e11d48", "--color-alert-soft": "#fdecf0",
    "--page-wash": hexA(main, 0.07),
  };
  const surface = mix(p[950], "#0b0b10", 0.45);
  const page = mix(p[950], "#060609", 0.7);
  const brandDark = readableOnDark(main, surface);
  return {
    ...common,
    // Buttons keep the deepened colour so white text reads on them; text in the colour is lightened instead
    "--color-brand": brand, "--color-brand-hover": palette(brand)[600], "--color-brand-soft": hexA(main, 0.18), "--color-brand-ink": brandDark,
    "--color-ink": "#eeedf4", "--color-ink-soft": mix(p[200], "#c9c8d4", 0.7), "--color-muted": ensure(mix(p[400], "#8f8e9e", 0.75), surface, 4.6, true),
    "--color-page": page, "--color-surface": surface, "--color-line": mix(p[800], "#2a2a33", 0.6),
    "--color-glow": "#fbbf24", "--color-glow-soft": "rgb(245 158 11 / .16)", "--color-glow-ink": "#fcd34d",
    "--color-good": "#34d399", "--color-good-soft": "rgb(16 185 129 / .16)", "--color-alert": "#fb7185", "--color-alert-soft": "rgb(244 63 94 / .16)",
    "--page-wash": hexA(main, 0.16),
  };
}

/** Nudge a colour darker (or lighter) until it reads on the background. */
function ensure(c: string, bg: string, min: number, lighten = false) {
  let x = c;
  for (let i = 0; i < 40 && contrast(x, bg) < min; i++) x = mix(x, lighten ? "#ffffff" : "#000000", 0.06);
  return x;
}

function mix(a: string, b: string, t: number) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([x[0] * (1 - t) + y[0] * t, x[1] * (1 - t) + y[1] * t, x[2] * (1 - t) + y[2] * t]);
}
function hexA(hex: string, a: number) { const [r, g, b] = hexToRgb(hex); return `rgb(${r} ${g} ${b} / ${a})`; }

export const HEADING_FONTS: Record<HeadingStyle, { label: string; family: string; weight: number; tracking: string; sample: string }> = {
  modern: { label: "Modern", family: '"Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif', weight: 600, tracking: "-0.02em", sample: "Friendly and fresh" },
  classic: { label: "Classic", family: '"Fraunces Variable", Georgia, serif', weight: 560, tracking: "-0.01em", sample: "Traditional and warm" },
  bold: { label: "Bold", family: '"Archivo Variable", ui-sans-serif, system-ui, sans-serif', weight: 800, tracking: "-0.03em", sample: "Strong and confident" },
};

/** The theme a person has chosen on this device. */
export function storedMode(): ThemeMode {
  try { const v = localStorage.getItem("traqi-theme"); return v === "light" || v === "dark" ? v : "auto"; } catch { return "auto"; }
}
export function resolveMode(m: ThemeMode): "light" | "dark" {
  if (m !== "auto") return m;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Put a church's look on the page. */
export function applyTheme(opts: { color?: string; accent?: string; heading?: HeadingStyle; mode: ThemeMode }) {
  const el = document.documentElement;
  const resolved = resolveMode(opts.mode);
  const vars = themeVars(opts.color || "#4f46e5", opts.accent, resolved);
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
  const f = HEADING_FONTS[opts.heading ?? "modern"];
  el.style.setProperty("--font-display", f.family);
  el.style.setProperty("--display-weight", String(f.weight));
  el.style.setProperty("--display-tracking", f.tracking);
  el.dataset.theme = resolved;
  el.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", vars["--color-deep"]);
}
