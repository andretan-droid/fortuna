import { PageHeader } from "@/components/shell/page-header";
import { Reveal } from "@/components/motion/reveal";
import { requireUserId } from "@/server/auth-helpers";
import { getAnalyticsBundle } from "@/server/queries/analytics";
import { formatMonthLong } from "@/lib/dates";
import { MonthPicker } from "@/components/analytics/month-picker";
import { RangePicker } from "@/components/analytics/range-picker";
import { RANGES, DEFAULT_RANGE, type Range } from "@/components/analytics/range";
import { CashflowChart } from "@/components/analytics/cashflow-chart";
import { SavingsTrend } from "@/components/analytics/savings-trend";
import { NetWorthArea } from "@/components/analytics/networth-area";
import { FrameworkDonut } from "@/components/analytics/framework-donut";
import { CategoryBreakdown } from "@/components/analytics/category-breakdown";
import { CashflowDetail } from "@/components/analytics/cashflow-detail";

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

  // Timeline range for the trend charts — one control, sliced server-side.
  const range: Range =
    typeof sp.range === "string" && (RANGES as readonly string[]).includes(sp.range)
      ? (sp.range as Range)
      : DEFAULT_RANGE;
  const latestMonth = a.months[0] ?? a.selectedMonth;
  const sliceByRange = <T extends { month: string }>(rows: T[]): T[] => {
    switch (range) {
      case "3m":
        return rows.slice(-3);
      case "6m":
        return rows.slice(-6);
      case "all":
        return rows;
      case "ytd":
        return rows.filter((r) => r.month >= `${latestMonth.slice(0, 4)}-01`);
      case "12m":
      default:
        return rows.slice(-12);
    }
  };
  const cashflowRanged = sliceByRange(a.cashflowByMonth);
  const netWorthRanged = sliceByRange(a.netWorthTrend);

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
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Trends
            </h2>
            <RangePicker selected={range} />
          </div>

          <Reveal>
            <CashflowChart data={cashflowRanged} />
          </Reveal>

          <Reveal className="grid gap-4 lg:grid-cols-2" index={1}>
            <SavingsTrend data={cashflowRanged} />
            <NetWorthArea data={netWorthRanged} />
          </Reveal>

          <div className="glass sticky top-16 z-10 -mx-2 flex items-center justify-between gap-2 rounded-lg px-4 py-2.5">
            <h2 className="font-display text-xs uppercase tracking-[0.16em] text-muted-foreground">
              This month
            </h2>
            <MonthPicker months={a.months} selected={a.selectedMonth} />
          </div>

          <Reveal className="grid gap-4 lg:grid-cols-2" index={2}>
            <FrameworkDonut items={a.frameworkBreakdown} monthLabel={monthLabel} />
            <CategoryBreakdown items={a.categoryBreakdown} monthLabel={monthLabel} />
          </Reveal>

          <Reveal index={3}>
            <CashflowDetail
              monthLabel={monthLabel}
              headline={a.cashflowByMonth.find((c) => c.month === a.selectedMonth) ?? null}
              categories={a.categoryBreakdown}
              paymentMethods={a.paymentMethodBreakdown}
            />
          </Reveal>
        </>
      )}
    </div>
  );
}
