/** ExportBundle → .xlsx Buffer. Same book_new/aoa_to_sheet/book_append_sheet
 *  loop as scripts/make-template.ts, filling real rows instead of one sample
 *  row. Field-name coupling: each sheet's TemplateCol.field must match a
 *  property on the matching ExportBundle collection's row objects — the same
 *  string-keyed coupling the import side already relies on (import-parse.ts).
 *  Server-only in practice (imported solely by app/api/export/route.ts): keeps
 *  SheetJS out of the client bundle. // ponytail: SheetJS 0.18.5 npm
 *  parse-path CVEs are a parse-time risk — this module only writes, never
 *  parses untrusted input, so they don't apply here. */
import * as XLSX from "xlsx";
import type { TemplateCol } from "./import-template";
import { EXPORT_SHEETS } from "./export-template";
import { fromCents } from "./money";
import type { ExportBundle } from "@/server/queries/export";

/** One cell's raw row value → its sheet-ready form, keyed by the column's
 *  declared kind. Null/undefined → blank cell (not "null"/"undefined" text). */
function cell(row: Record<string, unknown>, col: TemplateCol): string | number {
  const v = row[col.field];
  if (v === null || v === undefined) return "";
  switch (col.kind) {
    case "money":
      return fromCents(Number(v));
    case "bool":
      return v ? "Yes" : "No";
    case "int":
    case "number":
      return Number(v);
    case "date":
    case "month":
    case "text":
    default:
      return String(v);
  }
}

export function buildExportWorkbook(bundle: ExportBundle): Buffer {
  const wb = XLSX.utils.book_new();
  const data = bundle as unknown as Record<string, Record<string, unknown>[]>;

  for (const sheet of EXPORT_SHEETS) {
    const rows = data[sheet.collection] ?? [];
    const header = sheet.cols.map((c) => c.header);
    const aoa = [header, ...rows.map((r) => sheet.cols.map((c) => cell(r, c)))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = sheet.cols.map((c) => ({ wch: Math.max(c.header.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheet);
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
