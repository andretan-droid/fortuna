"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSolarTheme } from "@/hooks/use-solar-theme";
import { THEME_MODE_KEY, type ThemeMode } from "@/lib/solar";

/** The user's chosen MODE (light|dark|system|solar), stored separately from the
 *  applied theme. next-themes still owns the resolved light/dark class (its
 *  pre-hydration script is the anti-flash defense) — for solar we just call
 *  setTheme() from the resolver; the last resolved value is what paints first
 *  next load, and this key remembers to re-resolve. */

type Ctx = { mode: ThemeMode; setMode: (m: ThemeMode) => void };
const ThemeModeContext = createContext<Ctx | null>(null);

export function useThemeMode(): Ctx {
  const c = useContext(ThemeModeContext);
  if (!c) throw new Error("useThemeMode must be used within ThemeModeProvider");
  return c;
}

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  // Default "system" for SSR/first paint; hydrate the real choice post-mount so
  // the initial render never mismatches.
  const [mode, setModeState] = useState<ThemeMode>("system");
  const { setTheme } = useTheme();

  useEffect(() => {
    const stored = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
    if (stored) setModeState(stored);
  }, []);

  // Non-solar modes map straight onto next-themes. Solar is driven by the hook.
  useEffect(() => {
    if (mode !== "solar") setTheme(mode);
  }, [mode, setTheme]);

  useSolarTheme(mode === "solar");

  const setMode = (m: ThemeMode) => {
    try {
      localStorage.setItem(THEME_MODE_KEY, m);
    } catch {
      /* ignore */
    }
    setModeState(m);
  };

  return <ThemeModeContext.Provider value={{ mode, setMode }}>{children}</ThemeModeContext.Provider>;
}
