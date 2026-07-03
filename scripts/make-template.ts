/**
 * scripts/make-template.ts — Phase 11.1.
 *
 *   npm run make:template
 *
 * Writes public/templates/fortuna-import.xlsx from the shared TEMPLATE spec: one
 * tab per LegacyBundle collection, human column headers, and a single coherent
 * example row (its cross-references resolve, so the template round-trips as-is).
 */
import { mkdirSync } from "node:fs";
import * as XLSX from "xlsx";
import { TEMPLATE } from "@/lib/import-template";

const OUT = "public/templates/fortuna-import.xlsx";

function main() {
  const wb = XLSX.utils.book_new();

  for (const s of TEMPLATE) {
    const header = s.cols.map((c) => c.header);
    const example = s.cols.map((c) => c.sample);
    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    ws["!cols"] = s.cols.map((c) => ({ wch: Math.max(c.header.length + 2, 14) }));
    // XLSX truncates sheet names at 31 chars; ours are all short.
    XLSX.utils.book_append_sheet(wb, ws, s.sheet);
  }

  mkdirSync("public/templates", { recursive: true });
  XLSX.writeFile(wb, OUT);
  console.log(`wrote ${OUT} — ${TEMPLATE.length} sheets: ${TEMPLATE.map((s) => s.sheet).join(", ")}`);
}

main();
