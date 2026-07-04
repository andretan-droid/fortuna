/** Receivables ("Owed to me") math — the asset-side mirror of lib/bnpl.ts.
 *  When you lend someone money they owe you that balance; as they repay, the
 *  outstanding shrinks. Outstanding is DERIVED from logged repayments, never
 *  stored, so history is the single source of truth (same philosophy as BNPL).
 *
 *  Pure and Date-free — integer cents throughout.
 *  Self-check: npx tsx -r tsconfig-paths/register src/lib/receivables.ts */

import { monthKey } from "@/lib/dates";

export type ReceivableInput = {
  id: string;
  person: string;
  amountCents: number;
  date: string; // 'YYYY-MM-DD' — when it was lent
  note: string | null;
};

/** One logged repayment, reduced to what the math needs. */
export type ReceivablePaymentInput = {
  receivableId: string;
  date: string;
  amountCents: number;
};

export type ReceivablePayment = { date: string; amountCents: number };

export type ReceivableState = ReceivableInput & {
  paidCents: number; // Σ repayments (capped at the amount for display)
  outstandingCents: number; // max(0, amount − paid)
  settled: boolean; // fully repaid
  payments: ReceivablePayment[]; // date-ascending, for the drill-down
};

export type ReceivablesSummary = {
  items: ReceivableState[]; // all, outstanding-first then by date
  outstanding: ReceivableState[]; // still owed something
  settled: ReceivableState[]; // fully repaid (collapsed section)
  totalOutstandingCents: number; // net-worth asset line
  totalLentCents: number;
  settledCount: number;
};

/** Full per-IOU state + aggregates. Payments are grouped by receivable. */
export function receivablesState(
  receivables: ReceivableInput[],
  payments: ReceivablePaymentInput[],
): ReceivablesSummary {
  const byId = new Map<string, ReceivablePayment[]>();
  for (const p of payments) {
    const arr = byId.get(p.receivableId) ?? [];
    arr.push({ date: p.date, amountCents: p.amountCents });
    byId.set(p.receivableId, arr);
  }
  for (const arr of byId.values()) arr.sort((a, b) => a.date.localeCompare(b.date));

  const items: ReceivableState[] = receivables.map((r) => {
    const pays = byId.get(r.id) ?? [];
    const rawPaid = pays.reduce((n, p) => n + p.amountCents, 0);
    const outstandingCents = Math.max(0, r.amountCents - rawPaid);
    return {
      ...r,
      paidCents: Math.min(rawPaid, r.amountCents),
      outstandingCents,
      settled: outstandingCents === 0,
      payments: pays,
    };
  });

  // Outstanding first (soonest-lent first), then settled (most-recent first).
  items.sort((a, b) => {
    if (a.settled !== b.settled) return a.settled ? 1 : -1;
    return a.settled ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });

  const outstanding = items.filter((r) => !r.settled);
  const settled = items.filter((r) => r.settled);
  return {
    items,
    outstanding,
    settled,
    totalOutstandingCents: outstanding.reduce((n, r) => n + r.outstandingCents, 0),
    totalLentCents: receivables.reduce((n, r) => n + r.amountCents, 0),
    settledCount: settled.length,
  };
}

/** Outstanding receivables as at the END of month `ym` — for net-worth history.
 *  An IOU counts only once it has been lent (its date's month has arrived);
 *  repayments logged after `ym` don't reduce it. Mirror of bnplOutstandingAtCents. */
export function receivableOutstandingAtCents(
  receivables: ReceivableInput[],
  payments: ReceivablePaymentInput[],
  ym: string,
): number {
  const paidUpTo = new Map<string, number>();
  for (const p of payments) {
    if (monthKey(p.date) > ym) continue;
    paidUpTo.set(p.receivableId, (paidUpTo.get(p.receivableId) ?? 0) + p.amountCents);
  }
  let sum = 0;
  for (const r of receivables) {
    if (monthKey(r.date) > ym) continue; // not lent yet
    sum += Math.max(0, r.amountCents - (paidUpTo.get(r.id) ?? 0));
  }
  return sum;
}

/* ── Self-check (pure; no DB) ──────────────────────────────────────────────── */
export function selfCheck() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`receivables selfCheck: ${msg}`);
  };

  const recs: ReceivableInput[] = [
    { id: "r1", person: "Aiman", amountCents: 30000, date: "2026-05-10", note: null },
    { id: "r2", person: "Bella", amountCents: 10000, date: "2026-06-01", note: "lunch" },
  ];
  const pays: ReceivablePaymentInput[] = [
    { receivableId: "r1", date: "2026-06-15", amountCents: 10000 },
    { receivableId: "r1", date: "2026-07-01", amountCents: 5000 },
    { receivableId: "r2", date: "2026-06-20", amountCents: 10000 }, // fully repaid
  ];

  const s = receivablesState(recs, pays);
  const r1 = s.items.find((r) => r.id === "r1")!;
  const r2 = s.items.find((r) => r.id === "r2")!;
  assert(r1.paidCents === 15000 && r1.outstandingCents === 15000, "r1 partial");
  assert(!r1.settled && r2.settled, "r2 settled, r1 not");
  assert(s.totalOutstandingCents === 15000, "total outstanding = r1 only");
  assert(s.totalLentCents === 40000, "total lent");
  assert(s.outstanding.length === 1 && s.settled.length === 1, "split by settled");
  assert(r1.payments.length === 2 && r1.payments[0].date === "2026-06-15", "payments sorted");

  // Overpayment never goes negative or above the amount.
  const over = receivablesState(
    [{ id: "x", person: "C", amountCents: 5000, date: "2026-01-01", note: null }],
    [{ receivableId: "x", date: "2026-02-01", amountCents: 6000 }],
  );
  assert(over.items[0].outstandingCents === 0 && over.items[0].paidCents === 5000, "overpay clamped");

  // Historical: nothing before lent; partial after one payment; full net after all.
  assert(receivableOutstandingAtCents(recs, pays, "2026-04") === 0, "Apr: nothing lent");
  assert(receivableOutstandingAtCents(recs, pays, "2026-05") === 30000, "May: r1 lent, unpaid");
  assert(receivableOutstandingAtCents(recs, pays, "2026-06") === 20000, "Jun: r1 −10k, r2 lent+repaid");
  assert(receivableOutstandingAtCents(recs, pays, "2026-07") === 15000, "Jul: r1 −15k total");

  // eslint-disable-next-line no-console
  console.log("receivables selfCheck: OK");
}

if (
  typeof process !== "undefined" &&
  process.argv?.[1]?.replace(/\\/g, "/").endsWith("receivables.ts")
) {
  selfCheck();
}
