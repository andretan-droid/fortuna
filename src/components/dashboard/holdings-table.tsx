import { Panel } from "./panel";
import { formatCents } from "@/lib/money";
import type { HoldingValue } from "@/server/queries/wealth";

/** Portfolio positions with live market value in MYR. Sorted by value desc so
 *  the biggest positions lead. Day change coloured fern/terracotta. */
export function HoldingsTable({ holdings }: { holdings: HoldingValue[] }) {
  if (!holdings.length) return null;
  const rows = [...holdings].sort((a, b) => b.marketValueCents - a.marketValueCents);

  return (
    <Panel title="Portfolio">
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-medium">Ticker</th>
              <th className="px-2 py-1.5 text-right font-medium">Value (RM)</th>
              <th className="hidden px-2 py-1.5 text-right font-medium sm:table-cell">Day</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((h) => {
              const chgPct = h.dayChgPct != null ? h.dayChgPct * 100 : null;
              return (
                <tr key={h.id}>
                  <td className="px-2 py-2">
                    <p className="font-medium">{h.ticker}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {h.shares.toLocaleString("en-MY", { maximumFractionDigits: 4 })} {h.ccy}
                    </p>
                  </td>
                  <td className="tabular px-2 py-2 text-right">
                    {formatCents(h.marketValueCents).replace("RM ", "")}
                  </td>
                  <td
                    className={`tabular hidden px-2 py-2 text-right sm:table-cell ${
                      chgPct == null ? "text-muted-foreground" : chgPct >= 0 ? "text-income" : "text-destructive"
                    }`}
                  >
                    {chgPct == null ? "—" : `${chgPct >= 0 ? "+" : ""}${chgPct.toFixed(2)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
