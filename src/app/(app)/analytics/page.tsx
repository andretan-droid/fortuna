import { PageHeader } from "@/components/shell/page-header";
import { Reveal } from "@/components/motion/reveal";
import { requireUserId } from "@/server/auth-helpers";
import { getAnalyticsBundle } from "@/server/queries/analytics";
import { formatMonthLong } from "@/lib/dates";
import { MonthPicker } from "@/components/analytics/month-picker";
import { CashflowChart } from "@/components/analytics/cashflow-chart";
import { SavingsTrend } from "@/components/analytics/savings-trend";
import { NetWorthArea } from "@/components/analytics/networth-area";
import { FrameworkDonut } from "@/components/analytics/framework-donut";
import { CategoryBreakdown } from "@/components/analytics/category-breakdown";

/** RSC: reads `?month=` for the month-scoped breakdowns; time-series charts span
 *  all months. Analytics query already defaults the month to newest-with-data. */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const monthParam = typeof sp.month === "string" ? sp.month : undefined;
  const a = await getAnalyticsBundle(userId, monthParam);
  const monthLabel = formatMonthLong(a.selectedMonth);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Charts"
        title="Analytics"
        description="Cash flow, category breakdowns, and net-worth trend over time."
      />

      {a.months.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-paper)]">
          No transactions yet — log or import some to see your analytics.
        </p>
      ) : (
        <>
          <Reveal>
            <CashflowChart data={a.cashflowByMonth} />
          </Reveal>

          <Reveal className="grid gap-4 lg:grid-cols-2" delay={0.05}>
            <SavingsTrend data={a.cashflowByMonth} />
            <NetWorthArea data={a.netWorthTrend} />
          </Reveal>

          <div className="flex items-center justify-between gap-2 pt-2">
            <h2 className="font-display text-sm uppercase tracking-[0.16em] text-muted-foreground">
              This month
            </h2>
            <MonthPicker months={a.months} selected={a.selectedMonth} />
          </div>

          <Reveal className="grid gap-4 lg:grid-cols-2" delay={0.05}>
            <FrameworkDonut items={a.frameworkBreakdown} monthLabel={monthLabel} />
            <CategoryBreakdown items={a.categoryBreakdown} monthLabel={monthLabel} />
          </Reveal>
        </>
      )}
    </div>
  );
}
