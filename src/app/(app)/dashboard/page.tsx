import { PageHeader } from "@/components/shell/page-header";
import { Reveal } from "@/components/motion/reveal";
import { requireUserId } from "@/server/auth-helpers";
import { getDashboardSummary } from "@/server/queries/dashboard";
import { getWealthSummary } from "@/server/queries/wealth";
import { getUpcomingRecurring } from "@/server/queries/recurring";
import {
  getBnplPlanOptions,
  getCategoryOptions,
  getPaymentMethodOptions,
} from "@/server/queries/transactions";
import { HeroNumbers } from "@/components/dashboard/hero-numbers";
import { MonthPulse } from "@/components/dashboard/month-pulse";
import { BudgetFrameworks } from "@/components/dashboard/budget-frameworks";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { WealthCard } from "@/components/dashboard/wealth-card";
import { AccountCards } from "@/components/dashboard/account-cards";
import { HoldingsTable } from "@/components/dashboard/holdings-table";
import { SinkingFunds } from "@/components/dashboard/sinking-funds";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { EmptyState } from "@/components/dashboard/empty-state";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const [summary, wealth, recurring, categories, paymentMethods, bnplPlans] = await Promise.all([
    getDashboardSummary(userId),
    getWealthSummary(userId),
    getUpcomingRecurring(userId),
    getCategoryOptions(userId),
    getPaymentMethodOptions(userId),
    getBnplPlanOptions(userId),
  ]);

  const [y, m] = summary.month.split("-").map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
  const budgetTotal = summary.frameworks.reduce((n, f) => n + f.budgetCents, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${monthLabel} · Overview`}
        title="Dashboard"
        description="Your month at a glance — cash flow, budgets, and net worth."
      />

      {!summary.hasAnyData ? (
        <EmptyState />
      ) : (
        <>
          <Reveal>
            <HeroNumbers
              netWorthCents={wealth.netWorthCents}
              expenseCents={summary.cashflow.expenseCents}
              budgetCents={budgetTotal}
              savingsRate={summary.cashflow.savingsRate}
              targetSavingsRate={summary.cashflow.targetSavingsRate}
            />
          </Reveal>

          <Reveal className="grid gap-4 lg:grid-cols-2" index={1}>
            <MonthPulse cashflow={summary.cashflow} />
            <BudgetFrameworks frameworks={summary.frameworks} />
          </Reveal>

          {recurring.length > 0 && (
            <Reveal index={2}>
              <UpcomingBills
                rows={recurring}
                categories={categories}
                paymentMethods={paymentMethods}
                bnplPlans={bnplPlans}
              />
            </Reveal>
          )}

          <Reveal index={3}>
            <WealthCard wealth={wealth} />
          </Reveal>

          <Reveal className="grid gap-4 lg:grid-cols-2" index={4}>
            <RecentActivity rows={summary.recentActivity} />
            <HoldingsTable holdings={wealth.holdings} />
          </Reveal>

          <Reveal className="grid gap-4 lg:grid-cols-2" index={5}>
            <SinkingFunds funds={summary.sinkingFunds} />
            <AccountCards accounts={wealth.accounts} />
          </Reveal>
        </>
      )}
    </div>
  );
}
