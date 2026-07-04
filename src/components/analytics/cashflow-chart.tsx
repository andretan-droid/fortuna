"use client";

import { Panel } from "@/components/dashboard/panel";
import { ChartTipSurface, TipHead, TipRow, useChartTip } from "@/components/charts/tooltip";
import { formatCents } from "@/lib/money";
import { formatMonthShort } from "@/lib/dates";
import type { MonthlyCashflow } from "@/server/queries/analytics";

/** Income vs expense per month — grouped columns (magnitude over time, one axis).
 *  ponytail: pure CSS columns (no SVG math); hovering a month's slot shows its
 *  income / expense / net. Window is chosen by the analytics range picker. */
export function CashflowChart({ data }: { data: MonthlyCashflow[] }) {
  const months = data;
  const max = Math.max(1, ...months.map((m) => Math.max(m.incomeCents, m.expenseCents)));

  return (
    <Panel title="Cash flow" headerRight={<Legend />}>
      {months.length === 0 ? (
        <Empty />
      ) : (
        <ChartTipSurface>
          <div className="flex h-44 items-end gap-1.5">
            {months.map((m) => (
              <MonthSlot key={m.month} m={m} max={max} />
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {months.map((m) => (
              <span key={m.month} className="flex-1 text-center text-[10px] text-muted-foreground">
                {formatMonthShort(m.month)}
              </span>
            ))}
          </div>
        </ChartTipSurface>
      )}
    </Panel>
  );
}

function MonthSlot({ m, max }: { m: MonthlyCashflow; max: number }) {
  const { show, hide } = useChartTip();
  const tip = (
    <>
      <TipHead>{formatMonthShort(m.month)}</TipHead>
      <TipRow label="Income" value={formatCents(m.incomeCents)} dot="var(--color-income)" />
      <TipRow label="Expense" value={formatCents(m.expenseCents)} dot="var(--color-brand)" />
      <TipRow label="Net" value={formatCents(m.netCents)} />
    </>
  );
  return (
    <div
      className="flex h-full flex-1 cursor-default items-end justify-center gap-[2px]"
      onPointerMove={(e) => show(e.clientX, e.clientY, tip)}
      onPointerLeave={hide}
    >
      <Column cents={m.incomeCents} pct={m.incomeCents / max} tone="income" />
      <Column cents={m.expenseCents} pct={m.expenseCents / max} tone="expense" />
    </div>
  );
}

function Column({ cents, pct, tone }: { cents: number; pct: number; tone: "income" | "expense" }) {
  return (
    <div
      className={`w-1/2 max-w-[12px] rounded-t-[4px] ${tone === "income" ? "bg-income" : "bg-brand"}`}
      style={{ height: `${cents > 0 ? Math.max(pct * 100, 1.5) : 0}%` }}
    />
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-income" /> Income
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-brand" /> Expense
      </span>
    </div>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-muted-foreground">No cash-flow history yet.</p>;
}
