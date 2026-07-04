/** Batch-add parser — the paste-box ↔ grid boundary for logging many
 *  transactions at once. Pure (no DOM, no DB): splits pasted rows and validates
 *  a single draft row against the user's categories/methods. Reuses toCents and
 *  ISO_DATE_RE so the money/date rules match the rest of the app exactly.
 *
 *  Paste format (one txn per line, TAB-separated — straight from Excel/Notes):
 *      date ⇥ amount ⇥ description ⇥ category ⇥ method
 *  Category/method match by name, case-insensitive. Bad cells are FLAGGED, not
 *  dropped — the grid shows the reason and the good rows still commit.
 *
 *  Self-check: npx tsx -r tsconfig-paths/register src/lib/batch-parse.ts */

import { toCents } from "@/lib/money";
import { ISO_DATE_RE, todayISO } from "@/lib/dates";

export type ParseCategory = {
  id: string;
  name: string;
  type: "Income" | "Expense" | "Deduction" | "Transfer";
};
export type ParseMethod = { id: string; name: string };

/** A grid row exactly as typed/pasted — every field is raw text so the user can
 *  edit any cell before committing. Empty draft = a fresh manual-entry row. */
export type DraftRow = {
  date: string;
  amount: string;
  description: string;
  category: string;
  method: string;
};

/** A draft resolved against the option lists. `errors` empty ⇒ ready to commit. */
export type ValidatedRow = {
  draft: DraftRow;
  date: string;
  amountCents: number | null;
  categoryId: string | null;
  type: ParseCategory["type"] | null;
  paymentMethodId: string | null;
  errors: string[];
};

export function emptyDraft(): DraftRow {
  return { date: todayISO(), amount: "", description: "", category: "", method: "" };
}

/** Split pasted text into draft rows. Tab-separated first (Excel/Sheets/Notes);
 *  falls back to comma when a line has no tabs so a quick CSV paste still works.
 *  Blank lines are skipped; missing trailing columns default to "". */
export function parsePaste(text: string): DraftRow[] {
  const rows: DraftRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const cells = (raw.includes("\t") ? raw.split("\t") : raw.split(",")).map((c) =>
      c.trim(),
    );
    rows.push({
      date: normalizeDate(cells[0] ?? ""),
      amount: cells[1] ?? "",
      description: cells[2] ?? "",
      category: cells[3] ?? "",
      method: cells[4] ?? "",
    });
  }
  return rows;
}

/** Accept 'YYYY-MM-DD' and the common 'YYYY/MM/DD'; leave anything else as-is so
 *  validateRow flags it rather than silently guessing a wrong day/month order. */
function normalizeDate(s: string): string {
  const t = s.trim();
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(t)) return t.replace(/\//g, "-");
  return t;
}

/** Validate one draft against the user's live options. Errors are human-readable
 *  and per-field, so the grid can point at the exact bad cell. */
export function validateRow(
  draft: DraftRow,
  catByName: Map<string, ParseCategory>,
  methodByName: Map<string, ParseMethod>,
): ValidatedRow {
  const errors: string[] = [];

  const date = draft.date.trim();
  if (!ISO_DATE_RE.test(date)) errors.push("Date must be YYYY-MM-DD");

  let amountCents: number | null = null;
  if (!draft.amount.trim()) {
    errors.push("Enter an amount");
  } else {
    const c = toCents(draft.amount);
    if (c == null) errors.push("Amount is not a number");
    else if (c < 0)
      errors.push("Negative amount — record refunds as an Income-type row");
    else amountCents = c;
  }

  let categoryId: string | null = null;
  let type: ParseCategory["type"] | null = null;
  if (!draft.category.trim()) {
    errors.push("Pick a category");
  } else {
    const cat = catByName.get(draft.category.trim().toLowerCase());
    if (!cat) errors.push(`Unknown category "${draft.category.trim()}"`);
    else {
      categoryId = cat.id;
      type = cat.type; // Income vs Expense inferred from the category (Salary → Income)
    }
  }

  let paymentMethodId: string | null = null;
  if (draft.method.trim()) {
    const m = methodByName.get(draft.method.trim().toLowerCase());
    if (!m) errors.push(`Unknown payment method "${draft.method.trim()}"`);
    else paymentMethodId = m.id;
  }

  return { draft, date, amountCents, categoryId, type, paymentMethodId, errors };
}

/** Build the case-insensitive lookup maps once per render (name → option). */
export function buildLookups(categories: ParseCategory[], methods: ParseMethod[]) {
  return {
    catByName: new Map(categories.map((c) => [c.name.toLowerCase(), c])),
    methodByName: new Map(methods.map((m) => [m.name.toLowerCase(), m])),
  };
}

/* ── Self-check (pure; no DB/DOM) ──────────────────────────────────────────── */
export function selfCheck() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`batch-parse selfCheck: ${msg}`);
  };

  // Paste splitting: tab-separated, ragged columns, blank-line skip.
  const rows = parsePaste(
    "2026-07-01\t12.50\tNasi lemak\tFood\tCash\n\n2026/07/02\t5\tKopi\tFood",
  );
  assert(rows.length === 2, "two non-blank rows");
  assert(rows[0].category === "Food" && rows[0].method === "Cash", "tab cells mapped");
  assert(rows[1].date === "2026-07-02", "slash date normalized");
  assert(rows[1].method === "", "missing trailing column → empty");

  // Comma fallback when there are no tabs.
  const csv = parsePaste("2026-07-03,9.90,Lunch,Food,Card");
  assert(csv[0].amount === "9.90" && csv[0].method === "Card", "comma fallback");

  const cats: ParseCategory[] = [
    { id: "c1", name: "Food", type: "Expense" },
    { id: "c2", name: "Salary", type: "Income" },
  ];
  const methods: ParseMethod[] = [{ id: "m1", name: "Cash" }];
  const { catByName, methodByName } = buildLookups(cats, methods);

  // Good row: case-insensitive category + method match, type derived.
  const good = validateRow(
    { date: "2026-07-01", amount: "12.50", description: "x", category: "food", method: "CASH" },
    catByName,
    methodByName,
  );
  assert(good.errors.length === 0, "good row has no errors");
  assert(good.amountCents === 1250 && good.type === "Expense", "amount + type resolved");
  assert(good.categoryId === "c1" && good.paymentMethodId === "m1", "ids resolved");

  // Income category derives Income type.
  const inc = validateRow(
    { date: "2026-07-01", amount: "5000", description: "", category: "Salary", method: "" },
    catByName,
    methodByName,
  );
  assert(inc.type === "Income" && inc.errors.length === 0, "Salary → Income, no method ok");

  // Bad rows: each failure surfaces its own reason.
  const badDate = validateRow(
    { date: "1/7/26", amount: "10", description: "", category: "Food", method: "" },
    catByName,
    methodByName,
  );
  assert(badDate.errors.some((e) => e.includes("YYYY-MM-DD")), "bad date flagged");

  const neg = validateRow(
    { date: "2026-07-01", amount: "(315.00)", description: "", category: "Food", method: "" },
    catByName,
    methodByName,
  );
  assert(neg.errors.some((e) => e.includes("Negative")), "parens → negative rejected");

  const unknown = validateRow(
    { date: "2026-07-01", amount: "10", description: "", category: "Groceries", method: "GrabPay" },
    catByName,
    methodByName,
  );
  assert(unknown.errors.some((e) => e.includes("Unknown category")), "unknown category flagged");
  assert(unknown.errors.some((e) => e.includes("Unknown payment method")), "unknown method flagged");

  // eslint-disable-next-line no-console
  console.log("batch-parse selfCheck: OK");
}

// Node-only guard; undefined in the Next bundle → never runs on import.
if (
  typeof process !== "undefined" &&
  process.argv?.[1]?.replace(/\\/g, "/").endsWith("batch-parse.ts")
) {
  selfCheck();
}
