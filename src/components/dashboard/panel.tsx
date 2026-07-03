import { cn } from "@/lib/utils";

/** The one paper-card shell every dashboard widget sits in — keeps the locked
 *  card style (border + card bg + paper shadow) in a single place. */
export function Panel({
  title,
  headerRight,
  children,
  className,
}: {
  title?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-paper)]",
        className,
      )}
    >
      {(title || headerRight) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title ? (
            <h2 className="font-display text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {headerRight}
        </div>
      )}
      {children}
    </section>
  );
}
