import "server-only";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bnplPlans, transactions } from "@/db/schema";
import { bnplState, type BnplPlanInput, type BnplTxnMonth, type BnplSummary } from "@/lib/bnpl";
import { monthKey, todayISO } from "@/lib/dates";

/* Debt read layer. BNPL plans + the live Expense transactions linked to them are
 * the two inputs every BNPL calculation needs; fetchBnplInputs is shared so the
 * /debts page and net-worth history read the same rows the same way. */

export type BnplInputs = { plans: BnplPlanInput[]; txns: BnplTxnMonth[] };

/** Plans + linked live-Expense txn months for one user (date-ordered). */
export async function fetchBnplInputs(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<BnplInputs> {
  const [planRows, txnRows] = await Promise.all([
    db
      .select({
        id: bnplPlans.id,
        item: bnplPlans.item,
        platform: bnplPlans.platform,
        totalAmountCents: bnplPlans.totalAmountCents,
        nInstalments: bnplPlans.nInstalments,
        instalmentCents: bnplPlans.instalmentCents,
        firstDueMonth: bnplPlans.firstDueMonth,
        status: bnplPlans.status,
        categoryId: bnplPlans.categoryId,
        notes: bnplPlans.notes,
      })
      .from(bnplPlans)
      .where(eq(bnplPlans.userId, userId)),
    db
      .select({ planId: transactions.bnplPlanId, date: transactions.date })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "Expense"),
          eq(transactions.deleted, false),
          isNotNull(transactions.bnplPlanId),
        ),
      )
      .orderBy(asc(transactions.date)),
  ]);

  const txns: BnplTxnMonth[] = txnRows
    .filter((t): t is { planId: string; date: string } => t.planId != null)
    .map((t) => ({ planId: t.planId, month: monthKey(t.date) }));

  return { plans: planRows, txns };
}

export type DebtsSummary = BnplSummary & { currentMonth: string };

/** Everything the /debts BNPL section renders. */
export async function getDebtsSummary(userId: string): Promise<DebtsSummary> {
  const db = getDb();
  const { plans, txns } = await fetchBnplInputs(db, userId);
  const currentMonth = monthKey(todayISO());
  return { ...bnplState(plans, txns, currentMonth), currentMonth };
}
