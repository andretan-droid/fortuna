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
  instalmentAtCents,
  planSchedule,
  dueInYearCents,
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

// ── Rounding-exact schedules (WS-upgrade: BNPL flow) ─────────────────────
// P4: RM600/3 — divides evenly, every instalment identical.
const p4: BnplPlanInput = { id: "p4", item: "TV", platform: "Atome", totalAmountCents: 60000, nInstalments: 3, instalmentCents: 0, firstDueMonth: null, status: "active" };
assert.equal(instalmentAtCents(p4, 1), 20000, "600/3 instalment 1");
assert.equal(instalmentAtCents(p4, 2), 20000, "600/3 instalment 2");
assert.equal(instalmentAtCents(p4, 3), 20000, "600/3 final = 20000 (no remainder)");

// P5: RM100/3 — does NOT divide evenly; final instalment absorbs the drift.
const p5: BnplPlanInput = { id: "p5", item: "Case", platform: "Shopee", totalAmountCents: 10000, nInstalments: 3, instalmentCents: 0, firstDueMonth: null, status: "active" };
assert.equal(instalmentAtCents(p5, 1), 3333, "100/3 instalment 1 = 33.33");
assert.equal(instalmentAtCents(p5, 2), 3333, "100/3 instalment 2 = 33.33");
assert.equal(instalmentAtCents(p5, 3), 3334, "100/3 final = 33.34 (absorbs 1¢ drift)");
assert.equal(
  instalmentAtCents(p5, 1) + instalmentAtCents(p5, 2) + instalmentAtCents(p5, 3),
  10000,
  "100/3 instalments sum exactly to total — no cent lost",
);

// Outstanding after each payment, 0/1/2/3 instalments in — the exact case the
// old `Math.max(0, total - paid*instal)` formula drifted by 1¢ on (paid===n).
for (const [paidCount, expected] of [
  [0, 10000],
  [1, 6667],
  [2, 3334],
  [3, 0],
] as const) {
  const txns5: BnplTxnMonth[] = Array.from({ length: paidCount }, (_, i) => ({
    planId: "p5",
    month: `2026-${String(i + 1).padStart(2, "0")}`,
  }));
  const s5 = bnplState([p5], txns5, "2026-06");
  assert.equal(
    s5.plans[0].outstanding,
    expected,
    `100/3 outstanding after ${paidCount} paid`,
  );
}

// ── Full schedule + calendar-year totals ──────────────────────────────────
const txnsSchedule: BnplTxnMonth[] = [
  { planId: "p5", month: "2026-01" },
  { planId: "p5", month: "2026-02" },
];
const s5mid = bnplState([p5], txnsSchedule, "2026-02");
const schedule = planSchedule(s5mid.plans[0]);
assert.deepEqual(
  schedule.map((r) => [r.month, r.amountCents, r.paid]),
  [
    ["2026-01", 3333, true],
    ["2026-02", 3333, true],
    ["2026-03", 3334, false],
  ],
  "planSchedule: 2 paid (actual months) + 1 projected from nextDue",
);
assert.equal(
  schedule.reduce((sum, r) => sum + r.amountCents, 0),
  10000,
  "schedule always sums to totalAmountCents",
);
assert.equal(dueInYearCents(s5mid.plans[0], "2026"), 10000, "all 3 land in 2026");

// P6: schedule spans a year boundary — dueInYearCents must split by year, not
// just sum everything (the bug a naive "sum all" implementation would hide).
const p6: BnplPlanInput = { id: "p6", item: "Sofa", platform: null, totalAmountCents: 30000, nInstalments: 3, instalmentCents: 10000, firstDueMonth: "2025-11", status: "active" };
const s6 = bnplState([p6], [{ planId: "p6", month: "2025-11" }], "2025-11");
const schedule6 = planSchedule(s6.plans[0]);
assert.deepEqual(
  schedule6.map((r) => r.month),
  ["2025-11", "2025-12", "2026-01"],
  "P6 schedule crosses the year boundary",
);
assert.equal(dueInYearCents(s6.plans[0], "2025"), 20000, "P6: Nov + Dec 2025");
assert.equal(dueInYearCents(s6.plans[0], "2026"), 10000, "P6: Jan 2026 only");

console.log("verify-debts: all BNPL fixtures OK ✓");
