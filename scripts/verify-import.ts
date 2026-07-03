/**
 * scripts/verify-import.ts — Phase 11.2 check (no DB, no browser).
 *
 *   npx tsx scripts/verify-import.ts
 *
 * Round-trips the generated template through the REAL wizard path — parseWorkbook
 * → buildGraph — and asserts zero parse + validation errors. Proves the shared
 * TEMPLATE spec, the parser, and the import core agree end to end.
 */
import { readFileSync } from "node:fs";
import { parseWorkbook, bundleCounts } from "@/lib/import-parse";
import { buildGraph } from "@/lib/legacy-import";

const buf = readFileSync("public/templates/fortuna-import.xlsx");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const { bundle, errors } = parseWorkbook(ab);
const graph = buildGraph("00000000-0000-0000-0000-000000000000", bundle);

console.log("counts:", JSON.stringify(bundleCounts(bundle)));
console.log("parse errors:", errors.length ? errors : "none");
console.log("graph errors:", graph.errors.length ? graph.errors : "none");
// The sample transaction's type must derive from its category (Groceries=Expense).
const txnType = graph.rows.transactionRows[0]?.type;
console.log("sample txn type (derived):", txnType);

const ok = errors.length === 0 && graph.errors.length === 0 && txnType === "Expense";
console.log(ok ? "✓ template round-trips clean through parse+buildGraph" : "✗ FAIL");
process.exit(ok ? 0 : 1);
