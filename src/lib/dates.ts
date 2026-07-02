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

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
