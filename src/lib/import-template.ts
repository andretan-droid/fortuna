/** The import-template contract — ONE spec, two consumers:
 *   • scripts/make-template.ts writes public/templates/fortuna-import.xlsx from it
 *   • the import wizard parser (P11.2) reads an uploaded workbook against it
 *  so the headers a user fills always map back to LegacyBundle fields. Money
 *  columns are human decimals (RM 45.90), converted to cents by the parser via
 *  lib/money.toCents — the sheet never stores cents.
 *
 *  Portfolio tabs (holdings/fx/snapshots/bnpl) are intentionally omitted: the
 *  start-fresh/import audience rarely has them, and the real-Sheet seed path
 *  already covers portfolio. // ponytail: add those sheets when a user needs them.
 */

export type ColKind =
  | "text"
  | "money" // decimal RM → integer cents
  | "int"
  | "number" // plain float (e.g. tolerance fraction)
  | "bool" // Yes/No/true/1
  | "date" // YYYY-MM-DD
  | "month"; // YYYY-MM

export type TemplateCol = {
  header: string; // the human column label in the sheet
  field: string; // the LegacyBundle field it feeds
  kind: ColKind;
  sample: string | number; // the one example row's value
};

export type TemplateSheet = {
  sheet: string; // tab name
  collection: string; // LegacyBundle collection key
  cols: TemplateCol[];
};

export const TEMPLATE: TemplateSheet[] = [
  {
    sheet: "Categories",
    collection: "categories",
    cols: [
      { header: "Name", field: "name", kind: "text", sample: "Groceries" },
      { header: "Main Category", field: "mainCategory", kind: "text", sample: "Food" },
      { header: "Type", field: "type", kind: "text", sample: "Expense" },
      { header: "Framework", field: "framework", kind: "text", sample: "Needs" },
      { header: "Monthly Budget", field: "monthlyBudgetCents", kind: "money", sample: 800 },
      { header: "Active", field: "active", kind: "bool", sample: "Yes" },
    ],
  },
  {
    sheet: "Payment Methods",
    collection: "paymentMethods",
    cols: [
      { header: "Name", field: "name", kind: "text", sample: "Cash" },
      { header: "Active", field: "active", kind: "bool", sample: "Yes" },
    ],
  },
  {
    sheet: "Accounts",
    collection: "accounts",
    cols: [
      { header: "Name", field: "name", kind: "text", sample: "Maybank Savings" },
      { header: "Kind", field: "kind", kind: "text", sample: "Asset" },
      { header: "Sort", field: "sort", kind: "int", sample: 1 },
      { header: "Active", field: "active", kind: "bool", sample: "Yes" },
    ],
  },
  {
    sheet: "Transactions",
    collection: "transactions",
    cols: [
      { header: "Date", field: "date", kind: "date", sample: "2026-01-15" },
      { header: "Amount", field: "amountCents", kind: "money", sample: 45.9 },
      { header: "Description", field: "description", kind: "text", sample: "Weekly groceries" },
      { header: "Category", field: "category", kind: "text", sample: "Groceries" },
      { header: "Payment Method", field: "paymentMethod", kind: "text", sample: "Cash" },
    ],
  },
  {
    sheet: "Net Worth",
    collection: "netWorthEntries",
    cols: [
      { header: "Month", field: "month", kind: "month", sample: "2026-01" },
      { header: "Account", field: "account", kind: "text", sample: "Maybank Savings" },
      { header: "Balance", field: "balanceCents", kind: "money", sample: 12500 },
    ],
  },
  {
    sheet: "Sinking Funds",
    collection: "sinkingFunds",
    cols: [
      { header: "Name", field: "name", kind: "text", sample: "Car Insurance" },
      { header: "Annual Target", field: "annualTargetCents", kind: "money", sample: 1800 },
      { header: "Monthly Accrual", field: "monthlyAccrualCents", kind: "money", sample: 150 },
      { header: "Match Category", field: "matchCategory", kind: "text", sample: "" },
      { header: "Opening Balance", field: "openingBalanceCents", kind: "money", sample: 0 },
      { header: "Active", field: "active", kind: "bool", sample: "Yes" },
    ],
  },
  {
    sheet: "Recurring",
    collection: "recurringRules",
    cols: [
      { header: "Description", field: "description", kind: "text", sample: "Weekly groceries" },
      { header: "Category", field: "category", kind: "text", sample: "Groceries" },
      { header: "Expected", field: "expectedCents", kind: "money", sample: 45.9 },
      { header: "Payment Method", field: "paymentMethod", kind: "text", sample: "Cash" },
      { header: "Day", field: "day", kind: "int", sample: 15 },
      { header: "Tolerance", field: "tolerance", kind: "number", sample: 0.05 },
      { header: "Active", field: "active", kind: "bool", sample: "Yes" },
    ],
  },
];
