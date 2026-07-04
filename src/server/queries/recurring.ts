import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories, recurringRules, transactions } from "@/db/schema";
import { monthBounds, monthKey, todayISO } from "@/lib/dates";

/* Recurring-rule status. A rule is a known monthly bill; this checks it against
 * the current month's ledger and reports whether it has landed yet. Previously
 * NOTHING consumed recurring_rules — the settings copy claiming "the dashboard
 * flags missed" was aspirational. This query makes it true. */

export type RecurringStatus = "paid" | "due" | "missed";

export type RecurringStatusRow = {
  id: string;
  description: string;
  category: string;
  expectedCents: number | null;
  day: number | null;
  status: RecurringStatus;
  matchedAmountCents: number | null;
};

const DEFAULT_TOLERANCE = 0.05;

/** Each active rule's status for `month` ('YYYY-MM', defaults to current). A
 *  rule is "paid" once a live txn this month matches its category (+ payment
 *  method if set) and, when an expected amount is set, lands within tolerance.
 *  Unmatched rules are "missed" if their due day has passed, else "due". */
export async function getRecurringStatus(
  userId: string,
  month: string = monthKey(todayISO()),
): Promise<RecurringStatusRow[]> {
  const db = getDb();
  const { first, nextFirst } = monthBounds(month);

  const [rules, txns] = await Promise.all([
    db
      .select({
        id: recurringRules.id,
        description: recurringRules.description,
        categoryId: recurringRules.categoryId,
        category: categories.name,
        expectedCents: recurringRules.expectedCents,
        paymentMethodId: recurringRules.paymentMethodId,
        day: recurringRules.day,
        tolerance: recurringRules.tolerance,
      })
      .from(recurringRules)
      .innerJoin(categories, eq(recurringRules.categoryId, categories.id))
      .where(and(eq(recurringRules.userId, userId), eq(recurringRules.active, true))),
    db
      .select({
        categoryId: transactions.categoryId,
        paymentMethodId: transactions.paymentMethodId,
        amountCents: transactions.amountCents,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.deleted, false),
          gte(transactions.date, first),
          lt(transactions.date, nextFirst),
        ),
      ),
  ]);

  // Today's day-of-month, but only meaningful when `month` IS the current month;
  // for a past month everything unmatched is "missed", for a future one "due".
  const todayMonth = monthKey(todayISO());
  const todayDay = Number(todayISO().slice(8, 10));

  return rules.map((r) => {
    const tol = r.tolerance != null ? Number(r.tolerance) : DEFAULT_TOLERANCE;
    const match = txns.find((t) => {
      if (t.categoryId !== r.categoryId) return false;
      if (r.paymentMethodId && t.paymentMethodId !== r.paymentMethodId) return false;
      if (r.expectedCents != null) {
        const slack = Math.max(1, Math.round(r.expectedCents * tol));
        if (Math.abs(t.amountCents - r.expectedCents) > slack) return false;
      }
      return true;
    });

    let status: RecurringStatus;
    if (match) status = "paid";
    else if (month < todayMonth) status = "missed";
    else if (month > todayMonth) status = "due";
    else if (r.day != null && r.day < todayDay) status = "missed";
    else status = "due";

    return {
      id: r.id,
      description: r.description,
      category: r.category,
      expectedCents: r.expectedCents,
      day: r.day,
      status,
      matchedAmountCents: match?.amountCents ?? null,
    };
  });
}
