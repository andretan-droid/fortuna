/** Recurring-rule cadence + matching math — pure, DB-free (mirrors bnpl.ts /
 *  queries/debts.ts: math lives here, the query layer only fetches rows and
 *  calls into it). Self-check: scripts/verify-recurring.ts. */

import { addMonths, monthDiff } from "@/lib/dates";

export type RecurringStatus = "paid" | "due" | "missed";
export type AmountKind = "fixed" | "estimated" | "variable";
export type TxnType = "Income" | "Expense" | "Deduction" | "Transfer";

export type RuleInput = {
  id: string;
  description: string;
  categoryId: string;
  category: string;
  txnType: TxnType;
  expectedCents: number | null;
  paymentMethodId: string | null;
  day: number | null;
  tolerance: string | null;
  amountKind: string; // "fixed" | "estimated" | "variable" — plain text column, not narrowed at read time
  intervalMonths: number;
  startMonth: string | null;
  endMonth: string | null;
  notes: string | null;
};

export type MonthTxn = { categoryId: string; paymentMethodId: string | null; amountCents: number };

const DEFAULT_TOLERANCE = 0.05;

/** Does this rule land in `month` ('YYYY-MM')? null start = every month
 *  (existing rows' default — "always monthly"); otherwise the anchor plus
 *  cadence must line up exactly. */
export function ruleApplies(
  r: Pick<RuleInput, "startMonth" | "endMonth" | "intervalMonths">,
  month: string,
): boolean {
  if (r.startMonth && month < r.startMonth) return false;
  if (r.endMonth && month > r.endMonth) return false;
  if (!r.startMonth) return true;
  return monthDiff(r.startMonth, month) % r.intervalMonths === 0;
}

/** First applicable month strictly after `after` (capped at 3 years out so a
 *  malformed rule can't loop forever). */
export function nextApplicableMonth(
  r: Pick<RuleInput, "startMonth" | "endMonth" | "intervalMonths">,
  after: string,
): string | null {
  let m = addMonths(after, 1);
  for (let i = 0; i < 36; i++) {
    if (r.endMonth && m > r.endMonth) return null;
    if (ruleApplies(r, m)) return m;
    m = addMonths(m, 1);
  }
  return null;
}

export function daysIn(month: string): number {
  const [yy, mm] = month.split("-").map(Number);
  return new Date(yy, mm, 0).getDate();
}

/** Match `r` against this month's txns (consuming at most one — `consumed` is
 *  shared across rules so one txn can't satisfy two rules). fixed rules match
 *  on category(+method) AND amount-within-tolerance; estimated/variable match
 *  on category(+method) only — the expected amount is just a hint. */
export function matchStatus(
  r: RuleInput,
  txns: MonthTxn[],
  consumed: Set<number>,
  month: string,
  todayMonth: string,
  todayDay: number,
  daysInMonth: number,
): { status: RecurringStatus; matchedAmountCents: number | null } {
  const tol = r.tolerance != null ? Number(r.tolerance) : DEFAULT_TOLERANCE;
  const matchIdx = txns.findIndex((t, i) => {
    if (consumed.has(i)) return false;
    if (t.categoryId !== r.categoryId) return false;
    if (r.paymentMethodId && t.paymentMethodId !== r.paymentMethodId) return false;
    if (r.amountKind === "fixed" && r.expectedCents != null) {
      const slack = Math.max(1, Math.round(r.expectedCents * tol));
      if (Math.abs(t.amountCents - r.expectedCents) > slack) return false;
    }
    return true;
  });
  if (matchIdx >= 0) {
    consumed.add(matchIdx);
    return { status: "paid", matchedAmountCents: txns[matchIdx].amountCents };
  }
  let status: RecurringStatus;
  if (month < todayMonth) status = "missed";
  else if (month > todayMonth) status = "due";
  else if (r.day != null && Math.min(r.day, daysInMonth) < todayDay) status = "missed";
  else status = "due";
  return { status, matchedAmountCents: null };
}

export type RecurringStatusRow = {
  id: string;
  description: string;
  category: string;
  categoryId: string;
  txnType: TxnType;
  expectedCents: number | null;
  paymentMethodId: string | null;
  day: number | null;
  amountKind: string; // "fixed" | "estimated" | "variable" — plain text column, not narrowed at read time
  notes: string | null;
  status: RecurringStatus;
  matchedAmountCents: number | null;
};

export type UpcomingRow = Omit<RecurringStatusRow, "status"> & {
  month: string; // this month if the rule applies now, else its next occurrence
  status: RecurringStatus | "upcoming"; // upcoming = doesn't land this month
};

export function toRow(r: RuleInput) {
  return {
    id: r.id,
    description: r.description,
    category: r.category,
    categoryId: r.categoryId,
    txnType: r.txnType,
    expectedCents: r.expectedCents,
    paymentMethodId: r.paymentMethodId,
    day: r.day,
    amountKind: r.amountKind,
    notes: r.notes,
  };
}
