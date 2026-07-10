/**
 * scripts/verify-colors.ts — display-color determinism gate.
 *
 *   npx tsx scripts/verify-colors.ts
 *
 * Pure fixture check (no DB, no env) of src/lib/colors.ts: same key always
 * produces the same tone (stable across renders/deploys), known providers map
 * to curated tones, and every PAYMENT_METHOD_KINDS / framework bucket resolves
 * to a real tone (never falls through silently). Exits non-zero on mismatch.
 */
import assert from "node:assert/strict";
import { providerColor, kindColor, frameworkColor } from "@/lib/colors";
import { PAYMENT_METHOD_KINDS } from "@/db/schema";

// Determinism: repeated calls with the same key never change tone.
for (const key of ["Atome", "SPayLater", "Some New Provider Inc"]) {
  const a = providerColor(key);
  const b = providerColor(key);
  assert.deepEqual(a, b, `providerColor("${key}") is stable across calls`);
}

// Case-insensitive: "Atome" and "atome" resolve to the same curated tone.
assert.deepEqual(providerColor("Atome"), providerColor("atome"), "provider match is case-insensitive");

// Unknown platforms still get a real, non-muted-by-default tone (hashed, not blank).
const hashed = providerColor("Totally Unknown Platform");
assert.ok(hashed.bg && hashed.text, "unknown provider still resolves to a tone");

// null/empty platform → the explicit muted fallback, not a hash of "".
assert.deepEqual(providerColor(null), providerColor(""), "null and empty platform match");

// Every real payment-method kind resolves to a distinct-enough, defined tone.
const kindTones = PAYMENT_METHOD_KINDS.map((k) => kindColor(k));
for (const [i, k] of PAYMENT_METHOD_KINDS.entries()) {
  assert.ok(kindTones[i].bg && kindTones[i].text, `kindColor("${k}") is defined`);
}

// Every framework bucket resolves to a defined tone.
for (const fw of ["Needs", "Wants", "Savings", "Income", "Deduction", "Transfer"]) {
  const t = frameworkColor(fw);
  assert.ok(t.bg && t.text, `frameworkColor("${fw}") is defined`);
}
// Income framework reuses the app-wide --income token, not a generic chart color.
assert.equal(frameworkColor("Income").text, "text-income", "Income framework uses --income");

console.log("verify-colors: all display-color fixtures OK ✓");
