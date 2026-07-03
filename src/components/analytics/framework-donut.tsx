import { Panel } from "@/components/dashboard/panel";
import { formatCents } from "@/lib/money";
import type { FrameworkSpend } from "@/server/queries/analytics";

/** Validated categorical hues (dataviz): fixed order, never cycled. Needs/Wants/
 *  Savings → chart-1/3/2 (indigo / amber / green). */
const COLOR: Record<string, string> = {
  Needs: "var(--color-chart-1)",
  Wants: "var(--color-chart-3)",
  Savings: "var(--color-chart-2)",
};

/** Expense split across the three budget frameworks in the selected month —
 *  identity across 3 categories → a donut with legend + direct % labels (never
 *  color alone). pathLength=100 lets each arc be sized directly in percent. */
export function FrameworkDonut({
  items,
  monthLabel,
}: {
  items: FrameworkSpend[];
  monthLabel: string;
}) {
  const total = items.reduce((n, i) => n + i.spentCents, 0);

  if (total === 0) {
    return (
      <Panel title={`Framework split — ${monthLabel}`}>
        <p className="py-8 text-center text-sm text-muted-foreground">
          No expenses recorded this month.
        </p>
      </Panel>
    );
  }

  let offset = 0;
  const segments = items.map((i) => {
    const pct = (i.spentCents / total) * 100;
    const seg = { ...i, pct, offset };
    offset += pct;
    return seg;
  });

  return (
    <Panel title={`Framework split — ${monthLabel}`}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <div className="relative shrink-0">
          <svg viewBox="0 0 160 160" className="size-36 -rotate-90" role="img" aria-label="Framework split">
            {segments.map((s) => {
              // 1-unit surface gap between arcs (dataviz mark spec).
              const len = Math.max(s.pct - 1, 0);
              return (
                <circle
                  key={s.framework}
                  cx={80}
                  cy={80}
                  r={64}
                  fill="none"
                  stroke={COLOR[s.framework]}
                  strokeWidth={16}
                  pathLength={100}
                  strokeDasharray={`${len} ${100 - len}`}
                  strokeDashoffset={-s.offset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Spent</span>
            <span className="tabular font-display text-lg">{formatCents(total)}</span>
          </div>
        </div>

        <ul className="flex-1 space-y-2 text-sm">
          {segments.map((s) => (
            <li key={s.framework} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: COLOR[s.framework] }} />
              <span className="flex-1">{s.framework}</span>
              <span className="tabular text-muted-foreground">{Math.round(s.pct)}%</span>
              <span className="tabular w-24 text-right">{formatCents(s.spentCents)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
