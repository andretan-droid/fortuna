"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import {
  SOLAR_CACHE_KEY,
  dateKey,
  fixedTimes,
  isDarkAt,
  msToNextBoundary,
  type SolarCache,
} from "@/lib/solar";

function readCache(): SolarCache | null {
  try {
    const raw = localStorage.getItem(SOLAR_CACHE_KEY);
    return raw ? (JSON.parse(raw) as SolarCache) : null;
  } catch {
    return null;
  }
}

function writeCache(c: SolarCache) {
  try {
    localStorage.setItem(SOLAR_CACHE_KEY, JSON.stringify(c));
  } catch {
    /* private mode / quota — solar still works, just uncached */
  }
}

/** Geolocation with a 10s timeout; on denial/absence fall back to cached coords. */
function getCoords(cached: SolarCache | null): Promise<{ lat: number; lon: number } | null> {
  const fallback = cached ? { lat: cached.lat, lon: cached.lon } : null;
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve(fallback);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(fallback),
      { timeout: 10_000, maximumAge: 6 * 3600_000 },
    );
  });
}

async function fetchSunTimes(lat: number, lon: number) {
  const r = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`);
  if (!r.ok) throw new Error(`sun api ${r.status}`);
  const j = (await r.json()) as { status: string; results: { sunrise: string; sunset: string } };
  if (j.status !== "OK") throw new Error(`sun api ${j.status}`);
  return { sunriseIso: j.results.sunrise, sunsetIso: j.results.sunset };
}

/** Solar auto-switch. When `active`, resolves sun times (same-day cache →
 *  geolocation → sunrise-sunset.org → fixed 07/19), applies dark/light via
 *  next-themes, and re-checks at the next boundary + on tab focus. Mounted once
 *  (in the mode provider); a no-op when inactive. Cleans up on unmount. */
export function useSolarTheme(active: boolean) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const apply = (sunriseIso: string, sunsetIso: string) => {
      if (cancelled) return;
      setTheme(isDarkAt(new Date(), sunriseIso, sunsetIso) ? "dark" : "light");
      clearTimeout(timer);
      timer = setTimeout(resolve, Math.max(30_000, msToNextBoundary(new Date(), sunriseIso, sunsetIso)) + 1000);
    };

    async function resolve() {
      if (cancelled) return;
      const cached = readCache();
      if (cached && cached.dateKey === dateKey()) return apply(cached.sunriseIso, cached.sunsetIso);

      const coords = await getCoords(cached);
      if (coords) {
        try {
          const t = await fetchSunTimes(coords.lat, coords.lon);
          writeCache({ ...coords, ...t, dateKey: dateKey() });
          return apply(t.sunriseIso, t.sunsetIso);
        } catch {
          /* network/api down → fixed fallback below */
        }
      }
      const f = fixedTimes();
      apply(f.sunriseIso, f.sunsetIso);
    }

    resolve();
    const onVis = () => {
      if (document.visibilityState === "visible") resolve();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
