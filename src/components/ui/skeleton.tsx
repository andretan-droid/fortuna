import { cn } from "@/lib/utils";

/** Loading placeholder. `motion-reduce:animate-none` honours prefers-reduced-motion
 *  (the pulse is decorative). Composed into the route-level loading.tsx files so
 *  the shell + page grid paint instantly while the server query runs. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
      aria-hidden
    />
  );
}

/** Mirrors the Panel card shell so a loading page has the same footprint as the
 *  loaded one (no layout shift). `bodyClassName` sets the placeholder body height. */
export function PanelSkeleton({
  className,
  bodyClassName = "h-32",
}: {
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-paper)]",
        className,
      )}
    >
      <Skeleton className="mb-4 h-3 w-28" />
      <Skeleton className={cn("w-full", bodyClassName)} />
    </section>
  );
}

/** Mirrors PageHeader (eyebrow · title · description). */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}
