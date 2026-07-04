"use client";

import { Panel } from "./panel";
import { ChartTipSurface, TipHead, TipRow, useChartTip } from "@/components/charts/tooltip";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { FrameworkRollup } from "@/server/queries/dashboard";

/** Needs / Wants / Savings spent vs budget — mirrors the categories page bars. */
export function BudgetFrameworks({ frameworks }: { frameworks: FrameworkRollup[] }) {
  return (
    <Panel title="Budget frameworks">
      <ChartTipSurface className="space-y-4">
        {frameworks.map((f) => (
          <FrameworkBar key={f.framework} f={f} />
        ))}
      </ChartTipSurface>
    </Panel>
  );
}

function FrameworkBar({ f }: { f: FrameworkRollup }) {
  const { show, hide } = useChartTip();
  const has = f.budgetCents > 0;
  const pct = has ? Math.min((f.spentCents / f.budgetCents) * 100, 100) : 0;
  const over = f.spentCents > f.budgetCents && has;
  const remaining = f.budgetCents - f.spentCents;
  const tip = (
    <>
      <TipHead>{f.framework}</TipHead>
      <TipRow label="Spent" value={formatCents(f.spentCents)} />
      <TipRow label="Budget" value={has ? formatCents(f.budgetCents) : "—"} />
      {has && (
        <TipRow
          label={remaining >= 0 ? "Remaining" : "Over by"}
          value={formatCents(Math.abs(remaining))}
        />
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
        <span className="text-muted-foreground">{f.framework}</span>
        <span className="tabular">
          {formatCents(f.spentCents)}
          {has && <span className="text-muted-foreground"> / {formatCents(f.budgetCents)}</span>}
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
}
