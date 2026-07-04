"use client";

import { Panel } from "@/components/dashboard/panel";
import { ChartTipSurface, TipHead, TipRow, useChartTip } from "@/components/charts/tooltip";
import { formatCents } from "@/lib/money";
import type { CategorySpend } from "@/server/queries/analytics";

const TOP = 10;

type Row = { key: string; label: string; cents: number; framework?: string; muted: boolean };

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
  const rows: Row[] = [
    ...head.map((i) => ({
      key: i.categoryId,
      label: i.category,
      cents: i.spentCents,
      framework: i.framework,
      muted: false,
    })),
    ...(tailCents > 0
      ? [{ key: "__other", label: `Other (${expenses.length - TOP})`, cents: tailCents, muted: true }]
      : []),
  ];
  const max = Math.max(1, ...rows.map((r) => r.cents));
  const total = rows.reduce((n, r) => n + r.cents, 0);

  return (
    <Panel title={`Spending — ${monthLabel}`}>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No spending recorded this month.
        </p>
      ) : (
        <ChartTipSurface className="space-y-3">
          {rows.map((r) => (
            <RowBar key={r.key} r={r} max={max} total={total} />
          ))}
        </ChartTipSurface>
      )}
    </Panel>
  );
}

function RowBar({ r, max, total }: { r: Row; max: number; total: number }) {
  const { show, hide } = useChartTip();
  const share = total > 0 ? Math.round((r.cents / total) * 100) : 0;
  const tip = (
    <>
      <TipHead>{r.label}</TipHead>
      <TipRow label="Spent" value={formatCents(r.cents)} />
      {r.framework && <TipRow label="Framework" value={r.framework} />}
      <TipRow label="Share" value={`${share}%`} />
    </>
  );
  return (
    <div
      className="cursor-default"
      onPointerMove={(e) => show(e.clientX, e.clientY, tip)}
      onPointerLeave={hide}
    >
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
  );
}
