/**
 * scripts/verify-debts.ts — BNPL math gate (WS2/3).
 *
 *   npx tsx scripts/verify-debts.ts
 *
 * Pure fixture check (no DB, no env) of src/lib/bnpl.ts against hand-computed
 * legacy expectations — the integer-cents port of v5/app/js/calc.js. Asserts
 * per-plan state, aggregates, and the point-in-time net-worth series, including
 * the deliberate split: bnplState() counts every active plan, while
 * bnplOutstandingAtCents() (net-worth history) counts only STARTED plans.
 * Exits non-zero on any mismatch so it can gate CI like the other verify-*.ts.
 */
import assert from "node:assert/strict";
import {
  bnplState,
  bnplOutstandingAtCents,
  type BnplPlanInput,
  type BnplTxnMonth,
} from "@/lib/bnpl";

// P1: 3×RM100, started 2026-01, two instalments logged (Jan, Feb).
// P2: 3×RM100 via instalment FALLBACK (instalmentCents 0 → round(30000/3)), no
//     first-due month and no logged txns → active-but-not-started.
// P3: 2×RM100, fully paid (Nov+Dec 2025) → done, excluded from aggregates.
const plans: BnplPlanInput[] = [
  { id: "p1", item: "Phone", platform: "Atome", totalAmountCents: 30000, nInstalments: 3, instalmentCents: 10000, firstDueMonth: "2026-01", status: "active" },
  { id: "p2", item: "Sofa", platform: null, totalAmountCents: 30000, nInstalments: 3, instalmentCents: 0, firstDueMonth: null, status: "active" },
  { id: "p3", item: "Shoes", platform: "SPayLater", totalAmountCents: 20000, nInstalments: 2, instalmentCents: 10000, firstDueMonth: "2025-11", status: "active" },
];
const txns: BnplTxnMonth[] = [
  { planId: "p1", month: "2026-01" },
  { planId: "p1", month: "2026-02" },
  { planId: "p3", month: "2025-11" },
  { planId: "p3", month: "2025-12" },
];

const YM = "2026-02";
const s = bnplState(plans, txns, YM);
const byId = new Map(s.plans.map((p) => [p.id, p]));

// ── P1: two of three paid ──────────────────────────────────────────────
const p1 = byId.get("p1")!;
assert.equal(p1.paid, 2, "P1 paid");
assert.equal(p1.left, 1, "P1 left");
assert.equal(p1.outstanding, 10000, "P1 outstanding = 30000 − 2×10000");
assert.equal(p1.nextDue, "2026-03", "P1 next due = month after last paid");
assert.equal(p1.payoff, "2026-03", "P1 payoff = final instalment month");
assert.equal(p1.paidThisMonth, true, "P1 paid this (Feb) month");
assert.equal(p1.done, false, "P1 not done");

// ── P2: instalment fallback + not-started semantics ─────────────────────
const p2 = byId.get("p2")!;
assert.equal(p2.instal, 10000, "P2 instalment falls back to round(total/n)");
assert.equal(p2.paid, 0, "P2 nothing paid");
assert.equal(p2.outstanding, 30000, "P2 full balance outstanding (current view)");
assert.equal(p2.nextDue, YM, "P2 next due defaults to current month (no first-due, no txns)");
assert.equal(p2.payoff, "2026-04", "P2 payoff = ym + (n−1)");

// ── P3: fully paid → done, zero outstanding ─────────────────────────────
const p3 = byId.get("p3")!;
assert.equal(p3.done, true, "P3 done");
assert.equal(p3.outstanding, 0, "P3 cleared");

// ── aggregates: done plan excluded ──────────────────────────────────────
assert.equal(s.activeCount, 2, "two active plans (P1, P2)");
assert.equal(s.totalOutstandingCents, 40000, "Σ active outstanding = 10000 + 30000");
assert.equal(s.monthlyCommitCents, 20000, "Σ active instalments = 10000 + 10000");
assert.equal(s.dueThisMonthCount, 1, "only P2 has no Feb instalment logged");
assert.equal(s.earliestPayoff, "2026-03", "earliest active payoff");
assert.equal(s.latestPayoff, "2026-04", "latest active payoff");

// ── net-worth history: only STARTED plans, instalments after ym ignored ─
assert.equal(bnplOutstandingAtCents(plans, txns, "2025-12"), 0, "Dec 2025: only P3, fully paid");
assert.equal(bnplOutstandingAtCents(plans, txns, "2026-01"), 20000, "Jan 2026: P1 after 1 instalment");
// Feb: P1 → 10000; P2 excluded (never started); P3 → 0.
assert.equal(bnplOutstandingAtCents(plans, txns, "2026-02"), 10000, "Feb 2026: P1 only — P2 unstarted");

console.log("verify-debts: all BNPL fixtures OK ✓");
