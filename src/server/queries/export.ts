import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  categories,
  paymentMethods,
  accounts,
  transactions,
  netWorthEntries,
  sinkingFunds,
  recurringRules,
  bnplPlans,
  holdings,
  fxRates,
  snapshots,
} from "@/db/schema";
import { fetchReceivableInputs } from "./receivables";

/** A category/account/payment-method id unexpectedly missing its name — the
 *  FK is non-nullable + RESTRICT, so this indicates a bug, not user data.
 *  Kept visually distinct from the plain "" fallback used for FKs that are
 *  legitimately nullable (matches TEMPLATE's own blank-sample convention). */
const MISSING = "—";

export type ExportBundle = {
  categories: {
    name: string;
    mainCategory: string | null;
    type: string;
    framework: string;
    monthlyBudgetCents: number;
    active: boolean;
  }[];
  paymentMethods: { name: string; active: boolean }[];
  accounts: { name: string; kind: string; sort: number; active: boolean }[];
  transactions: {
    date: string;
    amountCents: number;
    description: string | null;
    category: string;
    paymentMethod: string | null;
  }[];
  netWorthEntries: { month: string; account: string; balanceCents: number }[];
  sinkingFunds: {
    name: string;
    annualTargetCents: number | null;
    monthlyAccrualCents: number | null;
    matchCategory: string;
    openingBalanceCents: number;
    active: boolean;
  }[];
  recurringRules: {
    description: string;
    category: string;
    expectedCents: number | null;
    paymentMethod: string;
    day: number | null;
    tolerance: string | null;
    active: boolean;
  }[];
  bnplPlans: {
    item: string;
    platform: string | null;
    category: string;
    totalAmountCents: number;
    nInstalments: number;
    instalmentCents: number;
    firstDueMonth: string | null;
    status: string;
    notes: string | null;
  }[];
  holdings: {
    ticker: string;
    name: string | null;
    exchange: string | null;
    shares: string | null;
    avgCostLocal: string | null;
    ccy: string | null;
    priceLive: string | null;
    dayChgPct: string | null;
    manualPriceOverride: string | null;
  }[];
  fxRates: { pair: string; rateLive: string | null; fallback: string | null }[];
  snapshots: {
    month: string;
    portfolioValueCents: number | null;
    usdMyrAtSnap: string | null;
    notes: string | null;
  }[];
  receivables: { person: string; amountCents: number; date: string; note: string | null }[];
  receivablePayments: { person: string; date: string; amountCents: number }[];
};

/** Full unpaginated ledger dump, joined the same way getTransactionsPage is
 *  (category/paymentMethod resolved via join, not a lookup map) — excludes
 *  soft-deleted rows, matching the feed's default (showDeleted false): a
 *  "my data" export should reflect what the user actually sees. */
async function getAllTransactionsForExport(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<ExportBundle["transactions"]> {
  return db
    .select({
      date: transactions.date,
      amountCents: transactions.amountCents,
      description: transactions.description,
      category: categories.name,
      paymentMethod: paymentMethods.name,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
    .where(and(eq(transactions.userId, userId), eq(transactions.deleted, false)))
    .orderBy(desc(transactions.date));
}

/** Everything the /api/export route streams, in one Promise.all round-trip.
 *  Category/payment-method/account ids are resolved to names once (shared
 *  Maps), not re-joined per table. */
export async function getExportBundle(userId: string): Promise<ExportBundle> {
  const db = getDb();

  const [
    categoryRows,
    paymentMethodRows,
    accountRows,
    transactionRows,
    netWorthRows,
    sinkingRows,
    recurringRows,
    bnplRows,
    holdingRows,
    fxRateRows,
    snapshotRows,
    { receivables: receivableRows, payments: paymentRows },
  ] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.name)),
    db.select().from(paymentMethods).where(eq(paymentMethods.userId, userId)).orderBy(asc(paymentMethods.name)),
    db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(asc(accounts.sort), asc(accounts.name)),
    getAllTransactionsForExport(db, userId),
    db.select().from(netWorthEntries).where(eq(netWorthEntries.userId, userId)).orderBy(asc(netWorthEntries.month)),
    db.select().from(sinkingFunds).where(eq(sinkingFunds.userId, userId)).orderBy(asc(sinkingFunds.name)),
    db.select().from(recurringRules).where(eq(recurringRules.userId, userId)).orderBy(asc(recurringRules.description)),
    db.select().from(bnplPlans).where(eq(bnplPlans.userId, userId)).orderBy(asc(bnplPlans.item)),
    db.select().from(holdings).where(eq(holdings.userId, userId)).orderBy(asc(holdings.ticker)),
    db.select().from(fxRates).where(eq(fxRates.userId, userId)).orderBy(asc(fxRates.pair)),
    db.select().from(snapshots).where(eq(snapshots.userId, userId)).orderBy(asc(snapshots.month)),
    fetchReceivableInputs(db, userId),
  ]);

  const categoryName = new Map(categoryRows.map((c) => [c.id, c.name]));
  const paymentMethodName = new Map(paymentMethodRows.map((p) => [p.id, p.name]));
  const accountName = new Map(accountRows.map((a) => [a.id, a.name]));
  const personByReceivableId = new Map(receivableRows.map((r) => [r.id, r.person]));

  const catRequired = (id: string) => categoryName.get(id) ?? MISSING;
  const catOptional = (id: string | null) => (id ? (categoryName.get(id) ?? MISSING) : "");
  const pmOptional = (id: string | null) => (id ? (paymentMethodName.get(id) ?? MISSING) : "");
  const acctRequired = (id: string) => accountName.get(id) ?? MISSING;
  const personRequired = (id: string) => personByReceivableId.get(id) ?? MISSING;

  return {
    categories: categoryRows.map((c) => ({
      name: c.name,
      mainCategory: c.mainCategory,
      type: c.type,
      framework: c.framework,
      monthlyBudgetCents: c.monthlyBudgetCents,
      active: c.active,
    })),
    paymentMethods: paymentMethodRows.map((p) => ({ name: p.name, active: p.active })),
    accounts: accountRows.map((a) => ({ name: a.name, kind: a.kind, sort: a.sort, active: a.active })),
    transactions: transactionRows,
    netWorthEntries: netWorthRows.map((n) => ({
      month: n.month,
      account: acctRequired(n.accountId),
      balanceCents: n.balanceCents,
    })),
    sinkingFunds: sinkingRows.map((s) => ({
      name: s.name,
      annualTargetCents: s.annualTargetCents,
      monthlyAccrualCents: s.monthlyAccrualCents,
      matchCategory: catOptional(s.matchCategoryId),
      openingBalanceCents: s.openingBalanceCents,
      active: s.active,
    })),
    recurringRules: recurringRows.map((r) => ({
      description: r.description,
      category: catRequired(r.categoryId),
      expectedCents: r.expectedCents,
      paymentMethod: pmOptional(r.paymentMethodId),
      day: r.day,
      tolerance: r.tolerance,
      active: r.active,
    })),
    bnplPlans: bnplRows.map((p) => ({
      item: p.item,
      platform: p.platform,
      category: catRequired(p.categoryId),
      totalAmountCents: p.totalAmountCents,
      nInstalments: p.nInstalments,
      instalmentCents: p.instalmentCents,
      firstDueMonth: p.firstDueMonth,
      status: p.status,
      notes: p.notes,
    })),
    holdings: holdingRows,
    fxRates: fxRateRows,
    snapshots: snapshotRows,
    receivables: receivableRows,
    receivablePayments: paymentRows.map((p) => ({
      person: personRequired(p.receivableId),
      date: p.date,
      amountCents: p.amountCents,
    })),
  };
}
