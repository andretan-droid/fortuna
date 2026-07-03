import { Panel } from "./panel";
import { RefreshPricesButton } from "./refresh-prices-button";
import { formatCents } from "@/lib/money";
import type { WealthSummary } from "@/server/queries/wealth";

/** Net-worth composition: assets − liabilities + live portfolio. The refresh
 *  button re-pulls holding prices; "as of" shows the last successful refresh. */
export function WealthCard({ wealth }: { wealth: WealthSummary }) {
  const asOf = wealth.pricesUpdatedAt
    ? new Date(wealth.pricesUpdatedAt).toLocaleString("en-MY", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Panel title="Net worth" headerRight={<RefreshPricesButton />}>
      <p className="tabular font-display text-4xl leading-none">
        <span className="text-muted-foreground">RM </span>
        {formatCents(wealth.netWorthCents).replace("RM ", "")}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {asOf ? `Portfolio priced as of ${asOf}` : "Prices not refreshed yet"}
      </p>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
        <Line label="Assets" cents={wealth.assetsCents} />
        <Line label="Liabilities" cents={-wealth.liabilitiesCents} />
        <Line label="Portfolio" cents={wealth.portfolioValueCents} />
      </dl>
    </Panel>
  );
}

function Line({ label, cents }: { label: string; cents: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className={`tabular font-display mt-1 text-lg ${cents < 0 ? "text-destructive" : ""}`}>
        {cents < 0 ? "−" : ""}
        {formatCents(Math.abs(cents))}
      </dd>
    </div>
  );
}
