"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useStore } from "@/lib/store";
import { applyTheme, storedMode, type ThemeMode } from "@/lib/theme";
import { wordsFor, type Words } from "@/lib/words";
import { setJourney } from "@/lib/journey";
import { cx } from "./ui";

type ThemeCtx = { mode: ThemeMode; setMode: (m: ThemeMode) => void; resolved: "light" | "dark" };
const Ctx = createContext<ThemeCtx>({ mode: "auto", setMode: () => {}, resolved: "light" });

/**
 * Puts the church's colour, accent and heading style on the whole app,
 * in the light or dark theme each person prefers. Public pages can override the colour.
 */
export function ChurchTheme({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  useEffect(() => { setModeState(storedMode()); }, []);

  const p = state.church.profile;
  // The church's own journey stages, in place before any page draws a stage
  useMemo(() => setJourney(p?.journey), [p?.journey]);
  useEffect(() => {
    const run = () => {
      applyTheme({ color: p?.color, accent: p?.accent, heading: p?.heading, mode });
      setResolved((document.documentElement.dataset.theme as "light" | "dark") ?? "light");
      // Remember the look, so the next visit paints in the church's colours straight away
      try { localStorage.setItem("traqi-look", JSON.stringify({ color: p?.color, accent: p?.accent, heading: p?.heading })); } catch { /* storage unavailable */ }
    };
    run();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", run);
    return () => mq?.removeEventListener?.("change", run);
  }, [p?.color, p?.accent, p?.heading, mode]);

  const value = useMemo(() => ({
    mode, resolved,
    setMode: (m: ThemeMode) => { setModeState(m); try { localStorage.setItem("traqi-theme", m); } catch { /* storage unavailable */ } },
  }), [mode, resolved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

/** The church's own words for Traqi's terms. */
export function useWords(): Words {
  const { state } = useStore();
  return useMemo(() => wordsFor(state.church.profile), [state.church.profile]);
}

/** Light · Dark · Automatic, for each person. */
export function ThemeSwitch({ dark = false, className }: { dark?: boolean; className?: string }) {
  const { mode, setMode } = useTheme();
  const opts: { k: ThemeMode; label: string; I: typeof Sun }[] = [{ k: "light", label: "Light", I: Sun }, { k: "auto", label: "Automatic", I: Monitor }, { k: "dark", label: "Dark", I: Moon }];
  return (
    <div role="radiogroup" aria-label="Theme" className={cx("flex rounded-xl p-0.5", dark ? "bg-white/[.07]" : "bg-page ring-1 ring-line", className)}>
      {opts.map(({ k, label, I }) => (
        <button key={k} role="radio" aria-checked={mode === k} aria-label={label} title={label} onClick={() => setMode(k)}
          className={cx("flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-1.5 text-[12px] font-medium transition",
            mode === k ? (dark ? "bg-white/15 text-white" : "bg-surface text-ink shadow-sm") : dark ? "text-white/55 hover:text-white" : "text-muted hover:text-ink")}>
          <I size={13} />{label === "Automatic" ? "Auto" : label}
        </button>
      ))}
    </div>
  );
}

/** Before the app loads, paint with the last look this device saw, so there's no flash of the wrong colour. */
export const EARLY_THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("traqi-theme")||"auto";var d=m==="dark"||(m==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

/** Public pages (check-in, events, church page) wear the church's look even when nobody is signed in. */
export function usePublicTheme(profile?: { color?: string; accent?: string; heading?: "modern" | "classic" | "bold" }) {
  const { mode } = useTheme();
  useEffect(() => {
    if (profile?.color) applyTheme({ color: profile.color, accent: profile.accent, heading: profile.heading, mode });
  }, [profile?.color, profile?.accent, profile?.heading, mode]);
}
