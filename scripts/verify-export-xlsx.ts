/**
 * scripts/verify-export-xlsx.ts — pure fixture check (no DB, no auth) of
 * buildExportWorkbook against a synthetic ExportBundle covering every column
 * kind (money/bool/int/number/text/date/month), including the numeric-as-string
 * columns (holdings/fxRates/snapshots) that drizzle returns as strings — the
 * sharpest edge flagged in the export design. Exits non-zero on mismatch.
 *
 *   npx tsx scripts/verify-export-xlsx.ts
 */
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildExportWorkbook } from "@/lib/export-xlsx";
import type { ExportBundle } from "@/server/queries/export";

const bundle: ExportBundle = {
  categories: [
    { name: "Groceries", mainCategory: "Food", type: "Expense", framework: "Needs", monthlyBudgetCents: 80000, active: true },
  ],
  paymentMethods: [{ name: "Cash", active: true }],
  accounts: [{ name: "Maybank Savings", kind: "Asset", sort: 1, active: true }],
  transactions: [
    { date: "2026-01-15", amountCents: 4590, description: "Weekly groceries", category: "Groceries", paymentMethod: "Cash" },
  ],
  netWorthEntries: [{ month: "2026-01", account: "Maybank Savings", balanceCents: 1250000 }],
  sinkingFunds: [
    { name: "Car Insurance", annualTargetCents: 180000, monthlyAccrualCents: 15000, matchCategory: "", openingBalanceCents: 0, active: true },
  ],
  recurringRules: [
    { description: "Gym", category: "Groceries", expectedCents: 4590, paymentMethod: "Cash", day: 15, tolerance: "0.05", active: true },
  ],
  bnplPlans: [
    { item: "Gadget", platform: "Shopee", category: "Groceries", totalAmountCents: 30000, nInstalments: 3, instalmentCents: 10000, firstDueMonth: "2026-01", status: "auto", notes: null },
  ],
  // Numeric columns as STRINGS — matches what drizzle actually returns for
  // Postgres numeric() columns (the sharpest edge in this feature).
  holdings: [
    { ticker: "NVDA", name: "NVIDIA Corp", exchange: "NASDAQ", shares: "1.5", avgCostLocal: "190.500000", ccy: "USD", priceLive: "195.200000", dayChgPct: "1.2000", manualPriceOverride: null },
  ],
  fxRates: [{ pair: "USDMYR", rateLive: "4.40000000", fallback: "3.97000000" }],
  snapshots: [{ month: "2026-06", portfolioValueCents: 9504843, usdMyrAtSnap: "4.40000000", notes: null }],
  receivables: [{ person: "Nicole", amountCents: 15000, date: "2026-01-15", note: null }],
  receivablePayments: [{ person: "Nicole", date: "2026-02-01", amountCents: 5000 }],
};

const buf = buildExportWorkbook(bundle);
assert.ok(buf.length > 0, "workbook buffer is non-empty");

const wb = XLSX.read(buf, { type: "buffer" });
const expectedSheets = [
  "Categories", "Payment Methods", "Accounts", "Transactions", "Net Worth",
  "Sinking Funds", "Recurring", "BNPL Plans", "Holdings", "FX Rates",
  "Snapshots", "Receivables", "Receivable Payments",
];
assert.deepEqual(wb.SheetNames, expectedSheets, "sheet names + order");

const asRows = (name: string) => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]);

// money: cents -> real decimal number, not a string
const txn = asRows("Transactions")[0];
assert.equal(txn["Amount"], 45.9, "money kind converts cents to decimal number");
assert.equal(typeof txn["Amount"], "number", "money cell is a number, not text");

// bool: -> "Yes"/"No" strings
assert.equal(asRows("Categories")[0]["Active"], "Yes", "bool kind renders Yes/No");

// numeric-as-string columns must come out as real numbers, not text
const holding = asRows("Holdings")[0];
assert.equal(holding["Shares"], 1.5, "numeric-string 'shares' coerced to number");
assert.equal(typeof holding["Shares"], "number", "shares cell is a number, not text");
assert.equal(holding["Manual Price Override"], "", "null numeric becomes blank, not 0 or NaN");

const fx = asRows("FX Rates")[0];
assert.equal(fx["Live Rate"], 4.4, "fxRates.rateLive string coerced to number");

// nullable text -> blank, not "null"
const bnpl = asRows("BNPL Plans")[0];
assert.equal(bnpl["Notes"], "", "null text kind renders blank, not the string 'null'");

// receivable payments: FK resolved to person name
assert.equal(asRows("Receivable Payments")[0]["Person"], "Nicole", "receivableId resolved to person name");

console.log("verify-export-xlsx: OK —", expectedSheets.length, "sheets,", buf.length, "bytes");
