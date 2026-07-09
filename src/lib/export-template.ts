/** Sheet specs for the "export all my data" workbook. Sibling to
 *  import-template.ts, not an extension of it: TEMPLATE's `collection` keys
 *  map to LegacyBundle fields for the import wizard's parser, but these extra
 *  sheets (portfolio + receivables) have no LegacyBundle collection to map to
 *  — `collection` here is only a lookup key into the export bundle built by
 *  server/queries/export.ts. Reusing TEMPLATE's 7 sheets verbatim keeps the
 *  exported file re-importable (same headers, same order). */
import { TEMPLATE, type TemplateSheet } from "./import-template";

export const EXPORT_ONLY_SHEETS: TemplateSheet[] = [
  {
    sheet: "BNPL Plans",
    collection: "bnplPlans",
    cols: [
      { header: "Item", field: "item", kind: "text", sample: "Gadget" },
      { header: "Platform", field: "platform", kind: "text", sample: "Shopee" },
      { header: "Category", field: "category", kind: "text", sample: "Shopping" },
      { header: "Total Amount", field: "totalAmountCents", kind: "money", sample: 300 },
      { header: "Instalments", field: "nInstalments", kind: "int", sample: 3 },
      { header: "Instalment Amount", field: "instalmentCents", kind: "money", sample: 100 },
      { header: "First Due Month", field: "firstDueMonth", kind: "month", sample: "2026-01" },
      { header: "Status", field: "status", kind: "text", sample: "auto" },
      { header: "Notes", field: "notes", kind: "text", sample: "" },
    ],
  },
  {
    sheet: "Holdings",
    collection: "holdings",
    cols: [
      { header: "Ticker", field: "ticker", kind: "text", sample: "NVDA" },
      { header: "Name", field: "name", kind: "text", sample: "NVIDIA Corp" },
      { header: "Exchange", field: "exchange", kind: "text", sample: "NASDAQ" },
      { header: "Shares", field: "shares", kind: "number", sample: 1.5 },
      { header: "Avg Cost (Local)", field: "avgCostLocal", kind: "number", sample: 190.5 },
      { header: "Currency", field: "ccy", kind: "text", sample: "USD" },
      { header: "Live Price", field: "priceLive", kind: "number", sample: 195.2 },
      { header: "Day Chg %", field: "dayChgPct", kind: "number", sample: 1.2 },
      { header: "Manual Price Override", field: "manualPriceOverride", kind: "number", sample: "" },
    ],
  },
  {
    sheet: "FX Rates",
    collection: "fxRates",
    cols: [
      { header: "Pair", field: "pair", kind: "text", sample: "USDMYR" },
      { header: "Live Rate", field: "rateLive", kind: "number", sample: 4.4 },
      { header: "Fallback Rate", field: "fallback", kind: "number", sample: 3.97 },
    ],
  },
  {
    sheet: "Snapshots",
    collection: "snapshots",
    cols: [
      { header: "Month", field: "month", kind: "month", sample: "2026-06" },
      { header: "Portfolio Value", field: "portfolioValueCents", kind: "money", sample: 95048.43 },
      { header: "USD/MYR Rate", field: "usdMyrAtSnap", kind: "number", sample: 4.4 },
      { header: "Notes", field: "notes", kind: "text", sample: "" },
    ],
  },
  {
    sheet: "Receivables",
    collection: "receivables",
    cols: [
      { header: "Person", field: "person", kind: "text", sample: "Nicole" },
      { header: "Amount", field: "amountCents", kind: "money", sample: 150 },
      { header: "Date", field: "date", kind: "date", sample: "2026-01-15" },
      { header: "Note", field: "note", kind: "text", sample: "" },
    ],
  },
  {
    sheet: "Receivable Payments",
    collection: "receivablePayments",
    cols: [
      { header: "Person", field: "person", kind: "text", sample: "Nicole" },
      { header: "Payment Date", field: "date", kind: "date", sample: "2026-02-01" },
      { header: "Amount", field: "amountCents", kind: "money", sample: 50 },
    ],
  },
];

/** Group A (TEMPLATE, round-trip compatible) + Group B/C (portfolio +
 *  receivables, export-only). Sheet order: ledger-first. */
export const EXPORT_SHEETS: TemplateSheet[] = TEMPLATE.concat(EXPORT_ONLY_SHEETS);
