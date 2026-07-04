"use client";

import { Panel } from "./panel";
import { ChartTipSurface, TipHead, TipRow, useChartTip } from "@/components/charts/tooltip";
import { formatCents } from "@/lib/money";
import type { DashboardSummary } from "@/server/queries/dashboard";

/** Income vs expense for the month, as two bars scaled to the larger side, with
 *  the net (money-left) figure underneath. */
export function MonthPulse({ cashflow }: { cashflow: DashboardSummary["cashflow"] }) {
  const { incomeCents, expenseCents, deductionCents, netCents } = cashflow;
  const max = Math.max(incomeCents, expenseCents, 1);

  return (
    <Panel title="This month">
      <ChartTipSurface className="space-y-4">
        <Bar label="Income" cents={incomeCents} pct={(incomeCents / max) * 100} tone="income" income={incomeCents} />
        <Bar label="Expense" cents={expenseCents} pct={(expenseCents / max) * 100} tone="expense" income={incomeCents} />
        {deductionCents > 0 && (
          <Bar
            label="Deductions"
            cents={deductionCents}
            pct={(deductionCents / max) * 100}
            tone="muted"
            income={incomeCents}
          />
        )}
      </ChartTipSurface>
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
  income,
}: {
  label: string;
  cents: number;
  pct: number;
  tone: "income" | "expense" | "muted";
  income: number;
}) {
  const { show, hide } = useChartTip();
  const fill =
    tone === "income" ? "bg-income" : tone === "expense" ? "bg-brand" : "bg-muted-foreground/50";
  const tip = (
    <>
      <TipHead>{label}</TipHead>
      <TipRow label="Amount" value={formatCents(cents)} />
      {tone !== "income" && income > 0 && (
        <TipRow label="of income" value={`${Math.round((cents / income) * 100)}%`} />
      )}
    </>
  );
  return (
    <div
      className="cursor-default"
      onPointerMove={(e) => show(e.clientX, e.clientY, tip)}
      onPointerLeave={hide}
    >
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
