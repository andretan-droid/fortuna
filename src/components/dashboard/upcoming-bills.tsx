import { Panel } from "./panel";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { RecurringStatusRow } from "@/server/queries/recurring";

const CHIP: Record<RecurringStatusRow["status"], { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-income/15 text-income" },
  due: { label: "Due", className: "bg-muted text-muted-foreground" },
  missed: { label: "Missed", className: "bg-destructive/15 text-destructive" },
};

/** Recurring rules checked against this month's ledger — what's paid, still due,
 *  or missed. Renders nothing when there are no active rules. */
export function UpcomingBills({ rows }: { rows: RecurringStatusRow[] }) {
  if (!rows.length) return null;
  // Missed first, then due, then paid — most actionable on top.
  const order = { missed: 0, due: 1, paid: 2 } as const;
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status]);
  const outstanding = rows.filter((r) => r.status !== "paid").length;

  return (
    <Panel
      title="Upcoming bills"
      headerRight={
        outstanding > 0 ? (
          <span className="text-xs text-muted-foreground">{outstanding} outstanding</span>
        ) : (
          <span className="text-xs text-income">All paid</span>
        )
      }
    >
      <ul className="divide-y divide-border">
        {sorted.map((r) => {
          const chip = CHIP[r.status];
          return (
            <li
              key={r.id}
              className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.description}</p>
                <p className="text-xs text-muted-foreground">
                  {r.category}
                  {r.day != null && ` · day ${r.day}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.expectedCents != null && (
                  <span className="tabular text-sm text-muted-foreground">
                    {formatCents(r.expectedCents)}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    chip.className,
                  )}
                >
                  {chip.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
