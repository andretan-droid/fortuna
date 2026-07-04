/** Trend-chart time ranges. Plain module (no "use client") so the analytics RSC
 *  can read RANGES at runtime — importing these from the client range-picker
 *  turns them into client-reference proxies (RANGES.includes would be undefined). */
export const RANGES = ["3m", "6m", "12m", "ytd", "all"] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = "12m";
