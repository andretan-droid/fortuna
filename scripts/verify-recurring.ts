/**
 * scripts/verify-recurring.ts — recurring-rule cadence math gate.
 *
 *   npx tsx scripts/verify-recurring.ts
 *
 * Pure fixture check (no DB, no env) of src/lib/recurring.ts's ruleApplies /
 * nextApplicableMonth against hand-computed monthly/quarterly/yearly cadences,
 * plus start/end-month boundaries. Exits non-zero on any mismatch.
 */
import assert from "node:assert/strict";
import { ruleApplies, nextApplicableMonth, type RuleInput } from "@/lib/recurring";

type Cadence = Pick<RuleInput, "startMonth" | "endMonth" | "intervalMonths">;

// Monthly, no anchor — existing rows' default: "always monthly".
const monthly: Cadence = { startMonth: null, endMonth: null, intervalMonths: 1 };
for (const m of ["2026-01", "2026-02", "2026-07", "2030-12"]) {
  assert.equal(ruleApplies(monthly, m), true, `monthly applies to ${m}`);
}

// Quarterly anchored on 2026-01 (Jan/Apr/Jul/Oct).
const quarterly: Cadence = { startMonth: "2026-01", endMonth: null, intervalMonths: 3 };
assert.equal(ruleApplies(quarterly, "2026-01"), true, "quarterly: anchor month");
assert.equal(ruleApplies(quarterly, "2026-04"), true, "quarterly: +3 months");
assert.equal(ruleApplies(quarterly, "2026-07"), true, "quarterly: +6 months");
assert.equal(ruleApplies(quarterly, "2027-01"), true, "quarterly: +12 months wraps a year");
assert.equal(ruleApplies(quarterly, "2026-02"), false, "quarterly: +1 month does not apply");
assert.equal(ruleApplies(quarterly, "2026-03"), false, "quarterly: +2 months does not apply");
assert.equal(nextApplicableMonth(quarterly, "2026-01"), "2026-04", "quarterly: next after anchor");
assert.equal(nextApplicableMonth(quarterly, "2026-02"), "2026-04", "quarterly: next after off-cycle month");

// Yearly, bounded start/end (2025-06 .. 2027-06).
const yearly: Cadence = { startMonth: "2025-06", endMonth: "2027-06", intervalMonths: 12 };
assert.equal(ruleApplies(yearly, "2025-06"), true, "yearly: start month");
assert.equal(ruleApplies(yearly, "2026-06"), true, "yearly: +12 months");
assert.equal(ruleApplies(yearly, "2027-06"), true, "yearly: end month itself still applies");
assert.equal(ruleApplies(yearly, "2028-06"), false, "yearly: past end month");
assert.equal(ruleApplies(yearly, "2025-05"), false, "yearly: before start month");
assert.equal(nextApplicableMonth(yearly, "2026-06"), "2027-06", "yearly: next occurrence");
assert.equal(nextApplicableMonth(yearly, "2027-06"), null, "yearly: no occurrence left after end");

console.log("verify-recurring: all cadence fixtures OK ✓");
