import { Panel } from "./panel";
import { formatCents } from "@/lib/money";
import type { DashboardSummary } from "@/server/queries/dashboard";

/** Income vs expense for the month, as two bars scaled to the larger side, with
 *  the net (money-left) figure underneath. */
export function MonthPulse({ cashflow }: { cashflow: DashboardSummary["cashflow"] }) {
  const { incomeCents, expenseCents, deductionCents, netCents } = cashflow;
  const max = Math.max(incomeCents, expenseCents, 1);

  return (
    <Panel title="This month">
      <div className="space-y-4">
        <Bar label="Income" cents={incomeCents} pct={(incomeCents / max) * 100} tone="income" />
        <Bar label="Expense" cents={expenseCents} pct={(expenseCents / max) * 100} tone="expense" />
        {deductionCents > 0 && (
          <Bar
            label="Deductions"
            cents={deductionCents}
            pct={(deductionCents / max) * 100}
            tone="muted"
          />
        )}
      </div>
      <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Net
        </span>
        <span
          className={`tabular font-display text-2xl ${netCents >= 0 ? "text-income" : "text-destructive"}`}
        >
          {netCents >= 0 ? "+" : "−"}
          {formatCents(Math.abs(netCents))}
        </span>
      </div>
    </Panel>
  );
}

function Bar({
  label,
  cents,
  pct,
  tone,
}: {
  label: string;
  cents: number;
  pct: number;
  tone: "income" | "expense" | "muted";
}) {
  const fill =
    tone === "income" ? "bg-income" : tone === "expense" ? "bg-brand" : "bg-muted-foreground/50";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular">{formatCents(cents)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}
