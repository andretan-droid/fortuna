import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories, sinkingFunds, transactions, userSettings } from "@/db/schema";
import { monthBounds, monthKey, todayISO } from "@/lib/dates";

/* Dashboard read layer — the cash-flow / budget side of the overview (net worth
 * and portfolio live in queries/wealth.ts). Everything is current-month, exact
 * integer cents from the ledger. One getDashboardSummary() fans its independent
 * sub-queries out with Promise.all (mirrors getSettingsBundle). */

export type FrameworkKey = "Needs" | "Wants" | "Savings";
const SPEND_FRAMEWORKS: FrameworkKey[] = ["Needs", "Wants", "Savings"];

export type FrameworkRollup = {
  framework: FrameworkKey;
  spentCents: number;
  budgetCents: number;
};

export type SinkingFundSummary = {
  id: string;
  name: string;
  annualTargetCents: number | null;
  monthlyAccrualCents: number | null;
  openingBalanceCents: number;
  /** Live spend in the fund's matched category this month (0 if unmatched). */
  matchedSpentThisMonthCents: number;
};

export type RecentActivityRow = {
  id: string;
  date: string;
  amountCents: number;
  type: "Income" | "Expense" | "Deduction" | "Transfer";
  category: string;
  description: string | null;
};

export type DashboardSummary = {
  month: string; // 'YYYY-MM'
  cashflow: {
    incomeCents: number;
    expenseCents: number; // Needs + Wants + Savings
    deductionCents: number;
    /** income − expense − deduction (money left this month). */
    netCents: number;
    /** Fraction 0..1. ponytail: personal-savings-rate = (income − expense)/income;
     *  deductions (statutory) are pre-income, kept out of the ratio. Components are
     *  all exposed → 9.4 can re-derive against the Sheet without reshaping this. */
    savingsRate: number;
    /** User's target savings rate (fraction 0..1) from settings, or null. */
    targetSavingsRate: number | null;
  };
  frameworks: FrameworkRollup[]; // Needs/Wants/Savings spent vs budget
  sinkingFunds: SinkingFundSummary[];
  recentActivity: RecentActivityRow[];
  /** Drives the empty-state widget: false until the ledger has a transaction. */
  hasAnyData: boolean;
};

/** Current-month overview in one round-trip of independent queries. */
export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const db = getDb();
  const month = monthKey(todayISO()); // 'YYYY-MM'
  const { first, nextFirst } = monthBounds(month);

  const inMonth = and(
    eq(transactions.userId, userId),
    eq(transactions.deleted, false),
    gte(transactions.date, first),
    lt(transactions.date, nextFirst),
  );

  const [spendByFramework, budgetByFramework, funds, recent, settingsRows] = await Promise.all([
    // Live spend this month grouped by the category's framework (Income/Needs/
    // Wants/Savings/Deduction/Transfer all fall out of this one group-by).
    db
      .select({
        framework: categories.framework,
        cents: sql<number>`coalesce(sum(${transactions.amountCents})::bigint, 0)`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(inMonth)
      .groupBy(categories.framework),
    // Monthly budget per framework from active categories (the bar denominators).
    db
      .select({
        framework: categories.framework,
        cents: sql<number>`coalesce(sum(${categories.monthlyBudgetCents})::bigint, 0)`,
      })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.active, true)))
      .groupBy(categories.framework),
    db
      .select()
      .from(sinkingFunds)
      .where(and(eq(sinkingFunds.userId, userId), eq(sinkingFunds.active, true)))
      .orderBy(asc(sinkingFunds.name)),
    getRecentActivity(userId),
    db
      .select({ target: userSettings.targetSavingsRate })
      .from(userSettings)
      .where(eq(userSettings.userId, userId)),
  ]);

  const spend = new Map(spendByFramework.map((r) => [r.framework, Number(r.cents)]));
  const budget = new Map(budgetByFramework.map((r) => [r.framework, Number(r.cents)]));

  const frameworks: FrameworkRollup[] = SPEND_FRAMEWORKS.map((f) => ({
    framework: f,
    spentCents: spend.get(f) ?? 0,
    budgetCents: budget.get(f) ?? 0,
  }));

  const incomeCents = spend.get("Income") ?? 0;
  const deductionCents = spend.get("Deduction") ?? 0;
  const expenseCents = frameworks.reduce((n, f) => n + f.spentCents, 0);
  const netCents = incomeCents - expenseCents - deductionCents;
  const savingsRate = incomeCents > 0 ? (incomeCents - expenseCents) / incomeCents : 0;
  const targetRaw = settingsRows[0]?.target;
  const targetSavingsRate = targetRaw != null ? Number(targetRaw) : null;

  // Sinking funds: attach this-month spend in each fund's matched category.
  const matchIds = [
    ...new Set(funds.map((f) => f.matchCategoryId).filter((x): x is string => !!x)),
  ];
  const matchedSpend = new Map<string, number>();
  if (matchIds.length) {
    const rows = await db
      .select({
        categoryId: transactions.categoryId,
        cents: sql<number>`coalesce(sum(${transactions.amountCents})::bigint, 0)`,
      })
      .from(transactions)
      .where(and(inMonth, inArray(transactions.categoryId, matchIds)))
      .groupBy(transactions.categoryId);
    for (const r of rows) matchedSpend.set(r.categoryId, Number(r.cents));
  }

  const sinkingFundsOut: SinkingFundSummary[] = funds.map((f) => ({
    id: f.id,
    name: f.name,
    annualTargetCents: f.annualTargetCents,
    monthlyAccrualCents: f.monthlyAccrualCents,
    openingBalanceCents: f.openingBalanceCents,
    matchedSpentThisMonthCents: f.matchCategoryId
      ? matchedSpend.get(f.matchCategoryId) ?? 0
      : 0,
  }));

  return {
    month,
    cashflow: { incomeCents, expenseCents, deductionCents, netCents, savingsRate, targetSavingsRate },
    frameworks,
    sinkingFunds: sinkingFundsOut,
    recentActivity: recent,
    hasAnyData: recent.length > 0,
  };
}

/** Newest N live transactions for the recent-activity widget (compact — no BNPL
 *  badge machinery; that stays in the full feed). Feed order = idx_txn_feed. */
export async function getRecentActivity(
  userId: string,
  limit = 6,
): Promise<RecentActivityRow[]> {
  const db = getDb();
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      amountCents: transactions.amountCents,
      type: transactions.type,
      category: categories.name,
      description: transactions.description,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(eq(transactions.userId, userId), eq(transactions.deleted, false)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
    .limit(limit);
}
