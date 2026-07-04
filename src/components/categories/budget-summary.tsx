import { Panel } from "@/components/dashboard/panel";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/server/queries/categories";

const SPEND = ["Needs", "Wants", "Savings"];

/** Categories-page metrics header: how much of net income is budgeted (the WS4
 *  hard-cap made visible) and how much of that budget is spent this month.
 *  Derived from the same rows the manager renders — no extra query. */
export function BudgetSummary({
  rows,
  netSalaryCents,
}: {
  rows: CategoryRow[];
  netSalaryCents: number | null;
}) {
  const spend = rows.filter((r) => r.active && SPEND.includes(r.framework));
  const totalBudget = spend.reduce((n, r) => n + r.monthlyBudgetCents, 0);
  const totalSpent = spend.reduce((n, r) => n + r.spentThisMonthCents, 0);

  const hasSalary = netSalaryCents != null && netSalaryCents > 0;
  const overAllocated = hasSalary && totalBudget > netSalaryCents;
  const allocPct = hasSalary ? Math.min((totalBudget / netSalaryCents) * 100, 100) : 0;

  const overSpent = totalBudget > 0 && totalSpent > totalBudget;
  const spentPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  return (
    <Panel title="Budget overview">
      <div className="grid gap-6 sm:grid-cols-2">
        <Metric
          label="Budgeted vs net income"
          primary={formatCents(totalBudget)}
          secondary={hasSalary ? `of ${formatCents(netSalaryCents)}` : "Set net salary in Settings"}
          pct={allocPct}
          over={overAllocated}
          note={
            overAllocated
              ? `Over by ${formatCents(totalBudget - netSalaryCents)}`
              : hasSalary
                ? `${formatCents(netSalaryCents - totalBudget)} unallocated`
                : undefined
          }
        />
        <Metric
          label="Spent vs budgeted"
          primary={formatCents(totalSpent)}
          secondary={totalBudget > 0 ? `of ${formatCents(totalBudget)}` : "No budgets set"}
          pct={spentPct}
          over={overSpent}
          note={
            overSpent
              ? `Over by ${formatCents(totalSpent - totalBudget)}`
              : totalBudget > 0
                ? `${formatCents(totalBudget - totalSpent)} left`
                : undefined
          }
        />
      </div>
    </Panel>
  );
}

function Metric({
  label,
  primary,
  secondary,
  pct,
  over,
  note,
}: {
  label: string;
  primary: string;
  secondary: string;
  pct: number;
  over: boolean;
  note?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="tabular font-display mt-2 text-2xl">
        {primary}
        <span className="text-sm text-muted-foreground"> {secondary}</span>
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {note && (
        <p className={cn("mt-2 text-xs", over ? "text-destructive" : "text-muted-foreground")}>
          {note}
        </p>
      )}
    </div>
  );
}
