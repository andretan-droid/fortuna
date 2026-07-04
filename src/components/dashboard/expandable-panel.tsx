import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Paper-card panel that collapses to a compact summary line and expands in
 *  place on click. Native <details> — no JS, no state; the chevron rotates via
 *  the `group-open` CSS variant. Interactive children (e.g. BalanceEditor) keep
 *  working because content is hidden, not unmounted. */
export function ExpandablePanel({
  title,
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  title?: string;
  summary: React.ReactNode; // compact line shown when collapsed
  children: React.ReactNode; // full content revealed on open
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-xl border border-border bg-card shadow-[var(--shadow-paper)]",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6">
        <div className="min-w-0">
          {title && (
            <h2 className="font-display text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {title}
            </h2>
          )}
          <div className="mt-1">{summary}</div>
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-6 pb-6">{children}</div>
    </details>
  );
}
