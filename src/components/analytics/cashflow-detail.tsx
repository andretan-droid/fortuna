import { Panel } from "@/components/dashboard/panel";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CategorySpend, PaymentMethodSpend } from "@/server/queries/analytics";

type Headline = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  savingsRate: number;
};

/** One labelled magnitude bar — same single-hue ranking language as
 *  category-breakdown; value is shown inline so no hover tooltip is needed. */
function Bar({
  label,
  cents,
  max,
  tag,
  hue = "bg-brand",
}: {
  label: string;
  cents: number;
  max: number;
  tag?: string | null;
  hue?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">
          {label}
          {tag && (
            <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {tag}
            </span>
          )}
        </span>
        <span className="tabular shrink-0">{formatCents(cents)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", hue)} style={{ width: `${(cents / max) * 100}%` }} />
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("tabular font-display mt-1 text-2xl leading-none", tone)}>{value}</p>
    </div>
  );
}

/** Comprehensive monthly cash-flow: what came in, what went out, and where by
 *  payment method — complements the spend-by-category panel. Month-scoped. */
export function CashflowDetail({
  monthLabel,
  headline,
  categories,
  paymentMethods,
}: {
  monthLabel: string;
  headline: Headline | null;
  categories: CategorySpend[];
  paymentMethods: PaymentMethodSpend[];
}) {
  const income = categories.filter((c) => c.type === "Income");
  const incomeMax = Math.max(1, ...income.map((c) => c.spentCents));
  const pmMax = Math.max(1, ...paymentMethods.map((p) => p.spentCents));

  return (
    <Panel title={`Cash flow — ${monthLabel}`}>
      {!headline ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No activity recorded this month.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Earned" value={formatCents(headline.incomeCents)} tone="text-income" />
            <StatTile label="Spent" value={formatCents(headline.expenseCents)} />
            <StatTile
              label="Net"
              value={formatCents(headline.netCents)}
              tone={headline.netCents < 0 ? "text-destructive" : undefined}
            />
            <StatTile label="Savings rate" value={`${Math.round(headline.savingsRate * 100)}%`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Income sources
              </p>
              {income.length === 0 ? (
                <p className="text-sm text-muted-foreground">No income recorded.</p>
              ) : (
                <div className="space-y-3">
                  {income.map((c) => (
                    <Bar
                      key={c.categoryId}
                      label={c.category}
                      cents={c.spentCents}
                      max={incomeMax}
                      hue="bg-income"
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Spend by payment method
              </p>
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-muted-foreground">No spending recorded.</p>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map((p) => (
                    <Bar
                      key={p.paymentMethod}
                      label={p.paymentMethod}
                      cents={p.spentCents}
                      max={pmMax}
                      tag={p.kind}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
