import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories, recurringRules, transactions } from "@/db/schema";
import { monthBounds, monthKey, todayISO } from "@/lib/dates";
import {
  ruleApplies,
  nextApplicableMonth,
  matchStatus,
  daysIn,
  toRow,
  type RuleInput,
  type MonthTxn,
  type RecurringStatusRow,
  type UpcomingRow,
} from "@/lib/recurring";

export type { RecurringStatus, AmountKind, RecurringStatusRow, UpcomingRow } from "@/lib/recurring";

/* Recurring-rule status. A rule is a known monthly/quarterly/yearly bill; this
 * checks it against the ledger and reports whether it has landed yet.
 * Cadence + matching math lives in lib/recurring.ts (DB-free, self-checked by
 * scripts/verify-recurring.ts) — this file only fetches rows and calls it. */

async function loadActiveRules(userId: string): Promise<RuleInput[]> {
  return getDb()
    .select({
      id: recurringRules.id,
      description: recurringRules.description,
      categoryId: recurringRules.categoryId,
      category: categories.name,
      txnType: categories.type,
      expectedCents: recurringRules.expectedCents,
      paymentMethodId: recurringRules.paymentMethodId,
      day: recurringRules.day,
      tolerance: recurringRules.tolerance,
      amountKind: recurringRules.amountKind,
      intervalMonths: recurringRules.intervalMonths,
      startMonth: recurringRules.startMonth,
      endMonth: recurringRules.endMonth,
      notes: recurringRules.notes,
    })
    .from(recurringRules)
    .innerJoin(categories, eq(recurringRules.categoryId, categories.id))
    .where(and(eq(recurringRules.userId, userId), eq(recurringRules.active, true)));
}

async function loadMonthTxns(userId: string, month: string): Promise<MonthTxn[]> {
  const { first, nextFirst } = monthBounds(month);
  return getDb()
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
    );
}

/** Each rule APPLICABLE TO `month` ('YYYY-MM', defaults to current) and its
 *  status. A rule whose cadence doesn't land in `month` (e.g. a quarterly bill
 *  outside its quarter) is simply absent — no stale chip for a bill that isn't
 *  due yet. */
export async function getRecurringStatus(
  userId: string,
  month: string = monthKey(todayISO()),
): Promise<RecurringStatusRow[]> {
  const [rules, txns] = await Promise.all([loadActiveRules(userId), loadMonthTxns(userId, month)]);
  const todayMonth = monthKey(todayISO());
  const todayDay = Number(todayISO().slice(8, 10));
  const daysInMonth = daysIn(month);
  const consumed = new Set<number>();

  return rules
    .filter((r) => ruleApplies(r, month))
    .map((r) => {
      const { status, matchedAmountCents } = matchStatus(
        r,
        txns,
        consumed,
        month,
        todayMonth,
        todayDay,
        daysInMonth,
      );
      return { ...toRow(r), status, matchedAmountCents };
    });
}

/** Every active rule, once: this month's paid/due/missed status if its
 *  cadence applies now, otherwise its next future occurrence tagged
 *  "upcoming" — so a quarterly StashAway top-up shows up as a preview before
 *  it's actually due, not just silently absent for two months out of three. */
export async function getUpcomingRecurring(userId: string): Promise<UpcomingRow[]> {
  const month = monthKey(todayISO());
  const [rules, txns] = await Promise.all([loadActiveRules(userId), loadMonthTxns(userId, month)]);
  const todayDay = Number(todayISO().slice(8, 10));
  const daysInMonth = daysIn(month);
  const consumed = new Set<number>();

  return rules.map((r) => {
    if (!ruleApplies(r, month)) {
      const next = nextApplicableMonth(r, month);
      return { ...toRow(r), month: next ?? month, status: "upcoming" as const, matchedAmountCents: null };
    }
    const { status, matchedAmountCents } = matchStatus(
      r,
      txns,
      consumed,
      month,
      month,
      todayDay,
      daysInMonth,
    );
    return { ...toRow(r), month, status, matchedAmountCents };
  });
}
