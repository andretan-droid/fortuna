/** Solar-theme pure helpers — no DOM, no React, so the day/night decision and
 *  the boundary-timer math are unit-testable (V6). The hook (use-solar-theme)
 *  supplies real geolocation/fetch; this file only decides light-vs-dark and when
 *  to re-check. Times are ISO strings (UTC from sunrise-sunset.org, or local from
 *  the fixed fallback) — Date.parse handles both. */

export const THEME_MODE_KEY = "fortuna-theme-mode";
export const SOLAR_CACHE_KEY = "fortuna-solar-cache";

export type ThemeMode = "light" | "dark" | "system" | "solar";
export type SolarCache = {
  lat: number;
  lon: number;
  sunriseIso: string;
  sunsetIso: string;
  dateKey: string; // local YYYY-MM-DD the times were resolved for
};

/** Local calendar day — the same-day validity key for the cache. */
export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dark iff before sunrise OR at/after sunset (the plan's rule). */
export function isDarkAt(now: Date, sunriseIso: string, sunsetIso: string): boolean {
  const t = now.getTime();
  return t < Date.parse(sunriseIso) || t >= Date.parse(sunsetIso);
}

/** ms until the next sunrise/sunset boundary. If both are past, aim ~24h out
 *  from today's sunrise (the fire re-resolves for the new day anyway). */
export function msToNextBoundary(now: Date, sunriseIso: string, sunsetIso: string): number {
  const t = now.getTime();
  const sr = Date.parse(sunriseIso);
  const ss = Date.parse(sunsetIso);
  const future = [sr, ss].filter((x) => x > t).sort((a, b) => a - b);
  if (future.length) return future[0] - t;
  return sr + 24 * 3600_000 - t;
}

/** Fixed 07:00 / 19:00 local for today — the final fallback when geolocation is
 *  denied and there's no cached coordinate to reuse. */
export function fixedTimes(now = new Date()): { sunriseIso: string; sunsetIso: string } {
  const sr = new Date(now);
  sr.setHours(7, 0, 0, 0);
  const ss = new Date(now);
  ss.setHours(19, 0, 0, 0);
  return { sunriseIso: sr.toISOString(), sunsetIso: ss.toISOString() };
}

// ponytail: one runnable check — `npx tsx src/lib/solar.ts`
if (typeof process !== "undefined" && process.argv?.[1]?.replace(/\\/g, "/").endsWith("solar.ts")) {
  const sr = "2026-07-03T07:00:00.000Z";
  const ss = "2026-07-03T19:00:00.000Z";
  const at = (h: number) => new Date(`2026-07-03T${String(h).padStart(2, "0")}:00:00.000Z`);
  console.assert(isDarkAt(at(6), sr, ss) === true, "before sunrise = dark");
  console.assert(isDarkAt(at(12), sr, ss) === false, "midday = light");
  console.assert(isDarkAt(at(20), sr, ss) === true, "after sunset = dark");
  // at 06:00, next boundary is sunrise (07:00) → 1h
  console.assert(msToNextBoundary(at(6), sr, ss) === 3600_000, "next boundary = sunrise");
  // at 12:00, next boundary is sunset (19:00) → 7h
  console.assert(msToNextBoundary(at(12), sr, ss) === 7 * 3600_000, "next boundary = sunset");
  console.log("solar.ts self-check OK");
}
