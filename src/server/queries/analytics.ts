import "server-only";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accounts, categories, netWorthEntries, paymentMethods, transactions } from "@/db/schema";
import { monthBounds, monthKey, todayISO } from "@/lib/dates";
import { bnplOutstandingAtCents, type BnplPlanInput, type BnplTxnMonth } from "@/lib/bnpl";
import { fetchBnplInputs } from "@/server/queries/debts";

/* Analytics read layer — month-scoped aggregates + multi-month series for the
 * charts (10.2). Exact integer cents from the ledger, same framework grouping
 * as the dashboard. Net-worth trend carries sparse account balances forward
 * (mirrors wealth.ts latest-wins), NOT a per-month sum. */

export type FrameworkKey =
  | "Income"
  | "Needs"
  | "Wants"
  | "Savings"
  | "Deduction"
  | "Transfer";

export type MonthlyCashflow = {
  month: string; // 'YYYY-MM'
  incomeCents: number;
  expenseCents: number; // Needs + Wants + Savings
  deductionCents: number;
  netCents: number; // income − expense − deduction
  savingsRate: number; // (income − expense) / income, fraction 0..1 (0 if no income)
};

export type CategorySpend = {
  categoryId: string;
  category: string;
  framework: string;
  type: "Income" | "Expense" | "Deduction" | "Transfer";
  spentCents: number;
};

export type FrameworkSpend = { framework: FrameworkKey; spentCents: number };

export type PaymentMethodSpend = {
  paymentMethod: string; // 'Unassigned' when a txn has no method
  kind: string | null;
  spentCents: number;
};

export type NetWorthPoint = {
  month: string; // 'YYYY-MM'
  assetsCents: number;
  liabilitiesCents: number; // account liabilities + BNPL outstanding at month end
  bnplCents: number; // BNPL portion of liabilitiesCents (tooltip detail)
  netCents: number; // assets − liabilities (portfolio is live-only, excluded here)
};

export type AnalyticsBundle = {
  months: string[]; // distinct ledger months, newest first (month-picker)
  selectedMonth: string; // the month category/framework breakdowns are scoped to
  cashflowByMonth: MonthlyCashflow[]; // oldest→newest (cashflow-chart + savings-trend)
  categoryBreakdown: CategorySpend[]; // selectedMonth, desc by spend
  frameworkBreakdown: FrameworkSpend[]; // selectedMonth (framework-donut)
  paymentMethodBreakdown: PaymentMethodSpend[]; // selectedMonth spend by method, desc
  netWorthTrend: NetWorthPoint[]; // oldest→newest (networth-area)
};

const SPEND: FrameworkKey[] = ["Needs", "Wants", "Savings"];

/** Full analytics payload for a month (defaults to the latest month with data). */
export async function getAnalyticsBundle(
  userId: string,
  requestedMonth?: string,
): Promise<AnalyticsBundle> {
  const db = getDb();

  // Distinct ledger months, newest first. to_char on a real date is fine here —
  // we're grouping, not range-filtering (no invalid-31st bound to hit).
  const ym = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;
  const liveTxn = and(eq(transactions.userId, userId), eq(transactions.deleted, false));

  const monthRows = await db
    .select({ month: ym })
    .from(transactions)
    .where(liveTxn)
    .groupBy(ym)
    .orderBy(desc(ym));
  const months = monthRows.map((r) => r.month);

  // Scope breakdowns to the requested month if it has data, else newest, else current.
  const selectedMonth =
    requestedMonth && months.includes(requestedMonth)
      ? requestedMonth
      : months[0] ?? monthKey(todayISO());
  const { first, nextFirst } = monthBounds(selectedMonth);
  const inSelected = and(
    liveTxn,
    gte(transactions.date, first),
    lt(transactions.date, nextFirst),
  );

  const [cashflowRows, breakdownRows, pmRows, nweRows, acctRows, bnplInputs] = await Promise.all([
    // (month, framework) → summed cents across ALL months, pivoted below.
    db
      .select({
        month: ym,
        framework: categories.framework,
        cents: sql<number>`coalesce(sum(${transactions.amountCents})::bigint, 0)`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(liveTxn)
      .groupBy(ym, categories.framework),
    // Per-category spend in the selected month.
    db
      .select({
        categoryId: categories.id,
        category: categories.name,
        framework: categories.framework,
        type: categories.type,
        cents: sql<number>`coalesce(sum(${transactions.amountCents})::bigint, 0)`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(inSelected)
      .groupBy(categories.id, categories.name, categories.framework, categories.type)
      .orderBy(desc(sql`sum(${transactions.amountCents})`)),
    // Spend (Expense only) by payment method in the selected month. Left join so
    // txns with no method fall into an 'Unassigned' bucket.
    db
      .select({
        paymentMethod: sql<string>`coalesce(${paymentMethods.name}, 'Unassigned')`,
        kind: paymentMethods.kind,
        cents: sql<number>`coalesce(sum(${transactions.amountCents})::bigint, 0)`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
      .where(and(inSelected, eq(transactions.type, "Expense")))
      .groupBy(paymentMethods.name, paymentMethods.kind)
      .orderBy(desc(sql`sum(${transactions.amountCents})`)),
    // Sparse net-worth history; carry-forward in JS (mirrors wealth.ts).
    db
      .select({
        accountId: netWorthEntries.accountId,
        month: netWorthEntries.month,
        balanceCents: netWorthEntries.balanceCents,
      })
      .from(netWorthEntries)
      .where(eq(netWorthEntries.userId, userId))
      .orderBy(asc(netWorthEntries.month)),
    db
      .select({ id: accounts.id, kind: accounts.kind })
      .from(accounts)
      .where(eq(accounts.userId, userId)),
    fetchBnplInputs(db, userId),
  ]);

  return {
    months,
    selectedMonth,
    cashflowByMonth: pivotCashflow(cashflowRows),
    categoryBreakdown: breakdownRows
      .map((r) => ({
        categoryId: r.categoryId,
        category: r.category,
        framework: r.framework,
        type: r.type,
        spentCents: Number(r.cents),
      }))
      .filter((r) => r.spentCents !== 0),
    frameworkBreakdown: SPEND.map((f) => ({
      framework: f,
      spentCents: breakdownRows
        .filter((r) => r.framework === f)
        .reduce((n, r) => n + Number(r.cents), 0),
    })).filter((r) => r.spentCents !== 0),
    paymentMethodBreakdown: pmRows
      .map((r) => ({
        paymentMethod: r.paymentMethod,
        kind: r.kind,
        spentCents: Number(r.cents),
      }))
      .filter((r) => r.spentCents !== 0),
    netWorthTrend: netWorthTrend(nweRows, acctRows, bnplInputs.plans, bnplInputs.txns),
  };
}

/** (month, framework, cents) rows → one MonthlyCashflow per month, oldest→newest. */
function pivotCashflow(
  rows: { month: string; framework: string; cents: number }[],
): MonthlyCashflow[] {
  const byMonth = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!byMonth.has(r.month)) byMonth.set(r.month, new Map());
    byMonth.get(r.month)!.set(r.framework, Number(r.cents));
  }
  return [...byMonth.keys()]
    .sort()
    .map((month) => {
      const m = byMonth.get(month)!;
      const income = m.get("Income") ?? 0;
      const deduction = m.get("Deduction") ?? 0;
      const expense = SPEND.reduce((n, f) => n + (m.get(f) ?? 0), 0);
      return {
        month,
        incomeCents: income,
        expenseCents: expense,
        deductionCents: deduction,
        netCents: income - expense - deduction,
        savingsRate: income > 0 ? (income - expense) / income : 0,
      };
    });
}

/** Sparse balances → net worth per month, carrying each account's latest known
 *  balance forward. A month appears once any account has been recorded by then. */
function netWorthTrend(
  nweRows: { accountId: string; month: string; balanceCents: number }[],
  acctRows: { id: string; kind: "Asset" | "Liability" }[],
  plans: BnplPlanInput[],
  bnplTxns: BnplTxnMonth[],
): NetWorthPoint[] {
  if (!nweRows.length) return [];
  const kind = new Map(acctRows.map((a) => [a.id, a.kind]));
  const months = [...new Set(nweRows.map((r) => r.month))].sort();

  // asc(month) already; last write ≤ target month wins per account.
  const out: NetWorthPoint[] = [];
  for (const month of months) {
    const latest = new Map<string, number>();
    for (const r of nweRows) {
      if (r.month <= month) latest.set(r.accountId, r.balanceCents);
    }
    let assets = 0;
    let liab = 0;
    for (const [accountId, bal] of latest) {
      // Unknown account kind (deleted account still in history) → treat as asset.
      if (kind.get(accountId) === "Liability") liab += bal;
      else assets += bal;
    }
    // BNPL outstanding at month end is a liability (legacy calc.js:259-260).
    // Deviation kept: we iterate net-worth-entry months only, not BNPL-only months.
    const bnpl = bnplOutstandingAtCents(plans, bnplTxns, month);
    liab += bnpl;
    out.push({
      month,
      assetsCents: assets,
      liabilitiesCents: liab,
      bnplCents: bnpl,
      netCents: assets - liab,
    });
  }
  return out;
}
