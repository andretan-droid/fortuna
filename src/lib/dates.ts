/** Date conventions (legacy Code.gs): dates are ISO 'YYYY-MM-DD' strings,
 *  months are 'YYYY-MM'. All comparisons are lexicographic — never Date math. */

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** 'YYYY-MM-DD' → 'Tue, 3 Jul' style day header (current-locale, no time). */
export function formatDayHeader(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(y !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Half-open [first, nextFirst) bounds for a 'YYYY-MM' month. Query a month with
 *  `date >= first AND date < nextFirst` — NOT `date <= 'YYYY-MM-31'`: the 31st is
 *  an invalid date in 30-day months and February, which Postgres rejects (22008)
 *  when the operand is a real `date` column. */
export function monthBounds(month: string): { first: string; nextFirst: string } {
  const [y, m] = month.split("-").map(Number);
  const nextFirst =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { first: `${month}-01`, nextFirst };
}

/** 'YYYY-MM' → 'Jul' (short month, no year — compact chart axis ticks). */
export function formatMonthShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "short" });
}

/** 'YYYY-MM' → 'July 2026' (month picker options, headers). */
export function formatMonthLong(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

/** 'YYYY-MM' + n months → 'YYYY-MM' (n may be negative). Pure integer math,
 *  no Date — mirrors legacy calc.js addMonths but avoids timezone drift. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12; // always 0..11 (Math.floor rounds toward -∞)
  return `${ny}-${String(nm + 1).padStart(2, "0")}`;
}

/** Months between two 'YYYY-MM' strings (b − a; may be negative). Pure integer
 *  math, mirrors addMonths — used for recurring-rule cadence checks. */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return by * 12 + (bm - 1) - (ay * 12 + (am - 1));
}

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
