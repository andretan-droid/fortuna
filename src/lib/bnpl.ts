/** BNPL (Buy Now Pay Later) math — an integer-cents port of legacy
 *  v5/app/js/calc.js bnplState + bnplOutstandingAt. Buying on a 3-month plan
 *  means you owe the shop money you haven't paid yet — that unpaid balance is a
 *  liability, and this file computes it.
 *
 *  Legacy worked in RM decimals with round2(); Fortuna stores integer cents, so
 *  the only rounding left is the instalment fallback round(total / n). Pure and
 *  Date-free — a plan's progress is derived from its linked Expense transactions,
 *  not from wall-clock time. Self-check: scripts/verify-debts.ts. */

import { addMonths } from "@/lib/dates";

export type BnplPlanInput = {
  id: string;
  item: string;
  platform: string | null;
  totalAmountCents: number;
  nInstalments: number;
  instalmentCents: number;
  firstDueMonth: string | null;
  status: string;
  // Carried through to BnplPlanState for the editor UI; unused by the math.
  categoryId?: string;
  notes?: string | null;
};

/** One linked live Expense transaction, reduced to its month ('YYYY-MM'). */
export type BnplTxnMonth = { planId: string; month: string };

export type BnplPlanState = BnplPlanInput & {
  n: number; // effective instalment count (≥ 1)
  instal: number; // effective per-instalment cents (fallback = round(total/n))
  paid: number; // instalments paid so far (linked txn count, capped at n)
  left: number; // instalments remaining
  outstanding: number; // cents still owed
  done: boolean;
  firstDue: string; // 'YYYY-MM' or ''
  nextDue: string; // 'YYYY-MM' or '' when done
  payoff: string; // 'YYYY-MM' the final instalment lands
  paidThisMonth: boolean;
  pct: number; // 0..1 progress
};

export type BnplSummary = {
  plans: BnplPlanState[];
  active: BnplPlanState[];
  totalOutstandingCents: number;
  monthlyCommitCents: number;
  activeCount: number;
  dueThisMonthCount: number; // active plans with no instalment logged this month
  earliestPayoff: string;
  latestPayoff: string;
};

function effN(p: BnplPlanInput): number {
  return p.nInstalments > 0 ? p.nInstalments : 1;
}
function effInstal(p: BnplPlanInput, n: number): number {
  return p.instalmentCents > 0 ? p.instalmentCents : Math.round(p.totalAmountCents / n);
}

/** Full per-plan state + aggregates, as at month `ym` ('YYYY-MM'). */
export function bnplState(
  plans: BnplPlanInput[],
  txns: BnplTxnMonth[],
  ym: string,
): BnplSummary {
  // Group linked txn-months by plan, ascending (they should arrive sorted; sort
  // defensively so lastPaid/firstDue are correct regardless of query order).
  const byPlan = new Map<string, string[]>();
  for (const t of txns) {
    const arr = byPlan.get(t.planId) ?? [];
    arr.push(t.month);
    byPlan.set(t.planId, arr);
  }
  for (const arr of byPlan.values()) arr.sort();

  const out: BnplPlanState[] = plans.map((p) => {
    const n = effN(p);
    const total = p.totalAmountCents;
    const instal = effInstal(p, n);
    const months = byPlan.get(p.id) ?? [];
    const paid = Math.min(months.length, n);
    const left = Math.max(0, n - paid);
    const outstanding = Math.max(0, total - paid * instal);
    const lastPaid = months.length ? months[months.length - 1] : "";
    const firstDue = (p.firstDueMonth ?? "").slice(0, 7) || (months.length ? months[0] : "");
    const nextDue = left === 0 ? "" : lastPaid ? addMonths(lastPaid, 1) : firstDue || ym;
    const payoff = left === 0 ? lastPaid || firstDue : addMonths(nextDue, left - 1);
    const paidThisMonth = months.some((m) => m === ym);
    return {
      ...p,
      n,
      instal,
      paid,
      left,
      outstanding,
      done: left === 0,
      firstDue,
      nextDue,
      payoff,
      paidThisMonth,
      pct: n ? paid / n : 0,
    };
  });

  const active = out.filter((p) => !p.done);
  const payoffs = active.map((p) => p.payoff).filter(Boolean).sort();
  return {
    plans: out,
    active,
    totalOutstandingCents: active.reduce((a, p) => a + p.outstanding, 0),
    monthlyCommitCents: active.reduce((a, p) => a + p.instal, 0),
    activeCount: active.length,
    dueThisMonthCount: active.filter((p) => !p.paidThisMonth).length,
    earliestPayoff: payoffs[0] ?? "",
    latestPayoff: payoffs.length ? payoffs[payoffs.length - 1] : "",
  };
}

/** BNPL outstanding as at the END of month `ym` — for net-worth history. A plan
 *  counts only once it has started (its first_due_month has arrived, or it has a
 *  linked txn on/before ym); instalments paid after ym don't reduce it. */
export function bnplOutstandingAtCents(
  plans: BnplPlanInput[],
  txns: BnplTxnMonth[],
  ym: string,
): number {
  const paidUpTo = new Map<string, number>();
  for (const t of txns) {
    if (t.month > ym) continue;
    paidUpTo.set(t.planId, (paidUpTo.get(t.planId) ?? 0) + 1);
  }
  let sum = 0;
  for (const p of plans) {
    const first = (p.firstDueMonth ?? "").slice(0, 7);
    if (first && first > ym) continue; // not due yet
    if (!first && !paidUpTo.has(p.id)) continue; // not yet started by then
    const n = effN(p);
    const instal = effInstal(p, n);
    const paid = Math.min(paidUpTo.get(p.id) ?? 0, n);
    sum += Math.max(0, p.totalAmountCents - paid * instal);
  }
  return sum;
}
