"use client";

import { ThemeProvider } from "next-themes";

/** Client providers wrapping the whole app. next-themes' pre-hydration inline
 *  script is our entire anti-flash defense (see <html suppressHydrationWarning>).
 *  QueryProvider is added in Phase 3/6 when the transactions feed needs it. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="fortuna-theme"
    >
      {children}
    </ThemeProvider>
  );
}
