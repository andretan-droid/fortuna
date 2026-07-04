"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary for the app pages. Any RSC query failure (DB blip,
 *  price-feed hiccup) lands here as a branded, retry-able card instead of Next's
 *  raw error screen. `reset()` re-renders the segment. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-paper)]">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="font-display mt-2 text-2xl">We couldn&apos;t load this page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is usually temporary — a hiccup talking to the database or price feed.
          Try again in a moment.
        </p>
        <Button size="lg" onClick={reset} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
