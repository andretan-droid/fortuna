import { Panel } from "@/components/dashboard/panel";
import { formatCents } from "@/lib/money";
import { formatMonthShort } from "@/lib/dates";
import type { MonthlyCashflow } from "@/server/queries/analytics";

/** Income vs expense per month — grouped columns (magnitude over time, one axis).
 *  ponytail: pure CSS columns (no SVG math); native `title` gives the hover value.
 *  Shows the most recent 12 months. */
export function CashflowChart({ data }: { data: MonthlyCashflow[] }) {
  const months = data.slice(-12);
  const max = Math.max(1, ...months.map((m) => Math.max(m.incomeCents, m.expenseCents)));

  return (
    <Panel title="Cash flow" headerRight={<Legend />}>
      {months.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="flex h-44 items-end gap-1.5">
            {months.map((m) => (
              <div
                key={m.month}
                className="flex h-full flex-1 items-end justify-center gap-[2px]"
              >
                <Column cents={m.incomeCents} pct={m.incomeCents / max} tone="income" month={m.month} label="Income" />
                <Column cents={m.expenseCents} pct={m.expenseCents / max} tone="expense" month={m.month} label="Expense" />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {months.map((m) => (
              <span key={m.month} className="flex-1 text-center text-[10px] text-muted-foreground">
                {formatMonthShort(m.month)}
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

function Column({
  cents,
  pct,
  tone,
  month,
  label,
}: {
  cents: number;
  pct: number;
  tone: "income" | "expense";
  month: string;
  label: string;
}) {
  return (
    <div
      className={`w-1/2 max-w-[12px] rounded-t-[4px] ${tone === "income" ? "bg-income" : "bg-brand"}`}
      style={{ height: `${cents > 0 ? Math.max(pct * 100, 1.5) : 0}%` }}
      title={`${formatMonthShort(month)} · ${label}: ${formatCents(cents)}`}
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
