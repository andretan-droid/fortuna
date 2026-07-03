import { Panel } from "./panel";
import { formatCents } from "@/lib/money";
import type { SinkingFundSummary } from "@/server/queries/dashboard";

/** Sinking funds: monthly accrual, annual target, and this-month matched spend.
 *  ponytail: shows config + matched spend, not an accrued running balance — the
 *  since-inception accrual math is a Phase-10 analytics concern. */
export function SinkingFunds({ funds }: { funds: SinkingFundSummary[] }) {
  if (!funds.length) return null;
  return (
    <Panel title="Sinking funds">
      <ul className="divide-y divide-border">
        {funds.map((f) => (
          <li key={f.id} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {f.monthlyAccrualCents != null
                  ? `${formatCents(f.monthlyAccrualCents)}/mo`
                  : "No accrual"}
                {f.annualTargetCents != null && ` · target ${formatCents(f.annualTargetCents)}`}
              </p>
            </div>
            <span className="tabular shrink-0 text-right text-sm">
              {f.matchedSpentThisMonthCents > 0 ? (
                <>
                  <span className="text-muted-foreground">spent </span>
                  {formatCents(f.matchedSpentThisMonthCents)}
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
