/** Uploaded workbook → LegacyBundle, driven by the shared TEMPLATE spec so the
 *  columns a user filled map straight back to bundle fields. Parsing only —
 *  ref/enum validation stays in legacy-import.buildGraph (the one validator).
 *
 *  Server-only in practice (imported solely by actions/import.ts): keeps SheetJS
 *  out of the client bundle and contains its untrusted-parse advisory to the
 *  server, on the user's own file. // ponytail: SheetJS 0.18.5 npm parse-path
 *  CVEs — acceptable for a single-user import of one's own workbook.
 */
import * as XLSX from "xlsx";
import { toCents } from "./money";
import { TEMPLATE, type TemplateCol } from "./import-template";
import type { LegacyBundle } from "./legacy-import";

export type ParseResult = { bundle: LegacyBundle; errors: string[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const TRUE = new Set(["true", "yes", "y", "1"]);

/** One cell → its typed value, or undefined for blank. Junk pushes an error. */
function convert(
  raw: unknown,
  col: TemplateCol,
  where: string,
  errors: string[],
): string | number | boolean | undefined {
  const blank = raw == null || (typeof raw === "string" && raw.trim() === "");
  switch (col.kind) {
    case "text":
      return blank ? undefined : String(raw).trim();
    case "money": {
      if (blank) return undefined;
      const c = typeof raw === "number" ? Math.round(raw * 100) : toCents(String(raw));
      if (c == null || !Number.isFinite(c)) {
        errors.push(`${where}: "${String(raw)}" is not a valid amount`);
        return undefined;
      }
      // Txn amounts are non-negative by schema (sign lives in the type column);
      // parens/minus notation must be re-entered as an Income-type row. Account
      // balances (balanceCents) may legitimately be negative.
      if (c < 0 && col.field === "amountCents") {
        errors.push(`${where}: "${String(raw)}" is negative — record refunds as an Income-type row`);
        return undefined;
      }
      return c;
    }
    case "int":
    case "number": {
      if (blank) return undefined;
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(n)) {
        errors.push(`${where}: "${String(raw)}" is not a number`);
        return undefined;
      }
      return col.kind === "int" ? Math.trunc(n) : n;
    }
    case "bool":
      return blank ? undefined : TRUE.has(String(raw).trim().toLowerCase());
    case "date": {
      if (blank) return undefined;
      if (raw instanceof Date) {
        return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, "0")}-${String(raw.getDate()).padStart(2, "0")}`;
      }
      const s = String(raw).trim();
      if (!ISO_DATE.test(s)) {
        errors.push(`${where}: "${s}" is not a date (YYYY-MM-DD)`);
        return undefined;
      }
      return s;
    }
    case "month": {
      if (blank) return undefined;
      if (raw instanceof Date) {
        return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, "0")}`;
      }
      const s = String(raw).trim();
      if (!MONTH.test(s)) {
        errors.push(`${where}: "${s}" is not a month (YYYY-MM)`);
        return undefined;
      }
      return s;
    }
  }
}

export function parseWorkbook(data: ArrayBuffer): ParseResult {
  const errors: string[] = [];
  const wb = XLSX.read(data, { cellDates: true });
  const bundle: Record<string, unknown[]> = {};

  for (const spec of TEMPLATE) {
    const ws = wb.Sheets[spec.sheet];
    if (!ws) continue; // missing sheet → empty collection; buildGraph flags any broken refs
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    const out: Record<string, unknown>[] = [];

    rows.forEach((row, i) => {
      // Skip blank rows (trailing empties are common in hand-edited sheets).
      if (Object.values(row).every((v) => v == null || v === "")) return;
      const rec: Record<string, unknown> = {};
      for (const col of spec.cols) {
        const v = convert(row[col.header], col, `${spec.sheet} row ${i + 2} · ${col.header}`, errors);
        if (v !== undefined) rec[col.field] = v;
      }
      out.push(rec);
    });

    bundle[spec.collection] = out;
  }

  return { bundle: bundle as LegacyBundle, errors };
}

/** Row counts per collection — for the preview screen. */
export function bundleCounts(bundle: LegacyBundle): Record<string, number> {
  const out: Record<string, number> = {};
  for (const spec of TEMPLATE) {
    const arr = (bundle as Record<string, unknown[]>)[spec.collection];
    if (arr?.length) out[spec.sheet] = arr.length;
  }
  return out;
}
