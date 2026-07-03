"use client";

import { Sun, Moon, Monitor, Sunrise } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { useThemeMode } from "@/components/shell/theme-mode";
import type { ThemeMode } from "@/lib/solar";

/** Cycles the four modes: Ivory → Obsidian → System → Solar. Mount-gated so SSR
 *  and first client paint render an identical placeholder (no hydration
 *  mismatch); the real mode is known only after localStorage hydration. */
const ORDER: ThemeMode[] = ["light", "dark", "system", "solar"];
const META: Record<ThemeMode, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: "Ivory (light)" },
  dark: { icon: Moon, label: "Obsidian (dark)" },
  system: { icon: Monitor, label: "System" },
  solar: { icon: Sunrise, label: "Solar (auto by sun)" },
};

export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();
  const mounted = useMounted();

  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  const Icon = META[mode].icon;

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      aria-label={mounted ? `Theme: ${META[mode].label}. Switch to ${META[next].label}` : "Toggle theme"}
      title={mounted ? META[mode].label : undefined}
      className="interactive grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
    >
      {mounted ? <Icon className="size-4" strokeWidth={1.75} /> : <span className="size-4" />}
    </button>
  );
}
