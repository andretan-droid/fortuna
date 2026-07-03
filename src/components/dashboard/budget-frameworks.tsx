import { Panel } from "./panel";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { FrameworkRollup } from "@/server/queries/dashboard";

/** Needs / Wants / Savings spent vs budget — mirrors the categories page bars. */
export function BudgetFrameworks({ frameworks }: { frameworks: FrameworkRollup[] }) {
  return (
    <Panel title="Budget frameworks">
      <div className="space-y-4">
        {frameworks.map((f) => {
          const has = f.budgetCents > 0;
          const pct = has ? Math.min((f.spentCents / f.budgetCents) * 100, 100) : 0;
          const over = f.spentCents > f.budgetCents && has;
          return (
            <div key={f.framework}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">{f.framework}</span>
                <span className="tabular">
                  {formatCents(f.spentCents)}
                  {has && (
                    <span className="text-muted-foreground"> / {formatCents(f.budgetCents)}</span>
                  )}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
