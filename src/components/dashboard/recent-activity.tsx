import Link from "next/link";
import { Panel } from "./panel";
import { formatCents } from "@/lib/money";
import { formatDayHeader } from "@/lib/dates";
import type { RecentActivityRow } from "@/server/queries/dashboard";

/** Compact newest-first transaction preview. Amount sign follows type:
 *  Income adds (+, fern), Expense/Deduction subtract (−), Transfer is neutral. */
export function RecentActivity({ rows }: { rows: RecentActivityRow[] }) {
  return (
    <Panel
      title="Recent activity"
      headerRight={
        <Link
          href="/transactions"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          View all
        </Link>
      }
    >
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const income = r.type === "Income";
          const neutral = r.type === "Transfer";
          return (
            <li key={r.id} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.description || r.category}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDayHeader(r.date)} · {r.category}
                </p>
              </div>
              <span
                className={`tabular shrink-0 text-sm ${income ? "text-income" : neutral ? "text-muted-foreground" : ""}`}
              >
                {income ? "+" : neutral ? "" : "−"}
                {formatCents(r.amountCents)}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
