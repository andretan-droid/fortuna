import { Panel } from "@/components/dashboard/panel";
import { formatCents } from "@/lib/money";
import type { CategorySpend } from "@/server/queries/analytics";

const TOP = 10;

/** Where the money went in the selected month — expense categories by spend,
 *  magnitude → horizontal bars in one hue (never categorical color for a ranking).
 *  The long tail folds into "Other" so the 11th category is never a new hue. */
export function CategoryBreakdown({
  items,
  monthLabel,
}: {
  items: CategorySpend[];
  monthLabel: string;
}) {
  // query already sorts desc by spend; keep only outflow categories.
  const expenses = items.filter((i) => i.type === "Expense");
  const head = expenses.slice(0, TOP);
  const tailCents = expenses.slice(TOP).reduce((n, i) => n + i.spentCents, 0);
  const rows = [
    ...head.map((i) => ({ key: i.categoryId, label: i.category, cents: i.spentCents, muted: false })),
    ...(tailCents > 0
      ? [{ key: "__other", label: `Other (${expenses.length - TOP})`, cents: tailCents, muted: true }]
      : []),
  ];
  const max = Math.max(1, ...rows.map((r) => r.cents));

  return (
    <Panel title={`Spending — ${monthLabel}`}>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No spending recorded this month.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className={r.muted ? "text-muted-foreground" : ""}>{r.label}</span>
                <span className="tabular">{formatCents(r.cents)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${r.muted ? "bg-muted-foreground/40" : "bg-brand"}`}
                  style={{ width: `${(r.cents / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
