/** Money = integer cents everywhere (schema convention). These two functions
 *  are the ONLY string↔cents boundary; nothing else touches floats. */

/** 'RM1,234.56' | '1234.56' | '1,234' → cents. NaN-safe: returns null on junk
 *  so callers surface a validation error instead of silently writing 0. */
export function toCents(input: string): number | null {
  const clean = input.replace(/[^\d.-]/g, "");
  if (!clean || clean === "-" || clean === ".") return null;
  const n = Number.parseFloat(clean);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100); // legacy Code.gs convention: round(parse × 100)
}

/** cents → 'RM 1,234.56'. Currency defaults to legacy 'RM'; sign preserved. */
export function formatCents(cents: number, currency = "RM"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-MY");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${currency} ${whole}.${frac}`;
}

/** cents → '1,234.56' (no currency; for inputs and tight table cells). */
export function formatAmount(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100).toLocaleString("en-MY")}.${String(abs % 100).padStart(2, "0")}`;
}
