"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/use-mounted";

/** Ivory ↔ Obsidian toggle. Mount-gated so SSR and first client paint render an
 *  identical placeholder (no hydration mismatch). Solar/system modes land in P12. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={
        !mounted
          ? "Toggle theme"
          : isDark
            ? "Switch to Ivory (light)"
            : "Switch to Obsidian (dark)"
      }
      className="interactive grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-4" strokeWidth={1.75} />
        ) : (
          <Moon className="size-4" strokeWidth={1.75} />
        )
      ) : (
        <span className="size-4" />
      )}
    </button>
  );
}
