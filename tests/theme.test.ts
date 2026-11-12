import { describe, expect, it } from "vitest";
import { contrast, palette, themeVars } from "@/lib/theme";
import { wordsFor } from "@/lib/words";

const COLOURS = ["#4f46e5", "#eab308", "#b91c1c", "#0f766e", "#fde047", "#f472b6", "#111827", "#22d3ee", "#ffffff", "#84cc16"];

describe("church colours stay readable", () => {
  for (const c of COLOURS) for (const mode of ["light", "dark"] as const) {
    it(`${c} in ${mode}`, () => {
      const v = themeVars(c, undefined, mode);
      const bg = mode === "light" ? "#ffffff" : v["--color-surface"];
      expect(contrast(v["--color-brand"], "#ffffff")).toBeGreaterThanOrEqual(4.5); // white text on buttons
      expect(contrast(mode === "dark" ? v["--color-brand-ink"] : v["--color-brand"], bg)).toBeGreaterThanOrEqual(4.5); // links
      expect(contrast(v["--color-muted"], bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v["--color-ink"], bg)).toBeGreaterThanOrEqual(7);
    });
  }
  it("makes ten shades from light to dark", () => {
    const p = palette("#4f46e5");
    expect(Object.keys(p)).toHaveLength(11);
    expect(contrast(p[50], "#000000")).toBeGreaterThan(contrast(p[950], "#000000"));
  });
});

describe("church words", () => {
  it("uses the church's word, or Traqi's when blank", () => {
    const w = wordsFor({ terms: { firstTimer: "Guest", firstTimers: "Guests", department: "  " } });
    expect(w.firstTimers).toBe("Guests");
    expect(w.department).toBe("Department");
    expect(w.lower("firstTimer")).toBe("guest");
  });
});
