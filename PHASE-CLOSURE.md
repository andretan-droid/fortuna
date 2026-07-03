# Fortuna — Phase 10–13 Closure Report

_Prepared 2026-07-03. Covers the loop takeover from Phase 10 onward. All code
through Phase 12 is committed and passes `tsc --noEmit` + `next build`._

## What shipped

| Phase | Task | Commit | State |
|---|---|---|---|
| 10.2 | Analytics chart components (6) | `eee86d5` | ✅ done |
| 10.3 | Analytics cross-check vs legacy (June 2026 clean) | `06bf577` | ✅ done |
| 11.1 | `make:template` → `public/templates/fortuna-import.xlsx` | `6468e3b` | ✅ done |
| 11.2 | Import wizard (upload → preview → commit) | `6729e2a` | ✅ done |
| 11.3 | V9 verify (real Neon commit path, fresh user) | `30e1ab4` | ✅ done |
| 12.1 | Solar theme (ladder + 4-mode toggle) | `7150d8a` | ✅ done |
| 12.2 | Per-navigation motion entrance | `c58406f` | ✅ done |

The import wizard adds **zero** new import logic — it wraps the existing
`lib/legacy-import` core (`parseWorkbook → buildGraph` for preview,
`importLegacyBundle` for commit), so the migration path and the wizard share one
validator and one reconciler.

## Verification matrix (V1–V10)

Per the plan's verification loop. Headless items were run this session; browser
items were **deferred to a manual pass** (owner decision, 2026-07-03 — the
session was already costly and the checks need a live dev server + the Playwright
signed-in session).

| # | Check | Status | Evidence |
|---|---|---|---|
| V1 | `tsc` + `next build` green, no env | ✅ headless | green at every commit; Phase-4 no-env safety intact |
| V2 | Migration reconciliation exact-match | ✅ headless | 8.4 (real data) + `scripts/verify-import-e2e.ts` (fresh user, 7 collections tie out) |
| V3 | Viewport × theme × route sweep | ⏳ **deferred** | needs Playwright; Tailwind responsive classes in place |
| V4 | Hydration console sweep | ⏳ **deferred** | mitigated by construction: mount-gates, `suppressHydrationWarning`, relative-time em-dash SSR |
| V5 | Reduced-motion — nothing stuck hidden | ✅ by construction | `reveal.tsx` + `app/(app)/template.tsx` render children statically at full opacity when reduced; `AnimatedNumber` renders final value |
| V6 | Solar boundary / fallback | ✅ logic | `src/lib/solar.ts` self-check (isDarkAt, msToNextBoundary); fixed-07/19 fallback engages on geo-deny/api-fail by construction. Browser clock-sim deferred |
| V7 | Tabular-numeral width test | ⏳ **deferred** | `.tabular` utility isolated in globals.css (one-line fallback point) |
| V8 | Keyboard focus + Lighthouse a11y ≥95 + contrast | ⏳ **deferred** | chart palette contrast/CVD **validated** via dataviz `validate_palette.js` (both card surfaces); focus-visible styles present |
| V9 | Import round-trip on a 2nd account | ✅ core+DB | `verify-import-e2e.ts` runs the real commit path for a fresh user. Literal 2nd-Google-OAuth sign-in deferred (auth, orthogonal to import) |
| V10 | Price refresh vs real Apps Script endpoint | ⏳ **deferred** | needs the live endpoint + token |

## Manual steps remaining (owner)

1. **Browser V-sweep** — `npm run dev` (port 3000 only), then Playwright: V3 (375/768/1440 × Ivory/Obsidian × 6 routes), V4 (hydration console), V7 (tnum width: `111,111.11` vs `999,999.99`), V8 (tab-walk focus + Lighthouse a11y on dashboard+transactions).
2. **V6 solar** — optional in-browser: stub geolocation + fake clock across a sunrise/sunset boundary; block `sunrise-sunset.org` to confirm the 07/19 fallback. Logic already unit-verified.
3. **V9 literal** — add a 2nd Google account as an OAuth test user, sign in, upload `public/templates/fortuna-import.xlsx` via `/import`, confirm the data lands.
4. **V10** — configure the price-feed URL/token in Settings, hit "Refresh prices" against the real Apps Script endpoint; confirm override precedence and the bad-token toast.
5. **Data caveat (from 9.4)** — net-worth liabilities show 0 because the P8 import captured only asset balance entries. Backfill via the dashboard Balance Editor or re-import with liability rows.
6. **Deploy** — out of scope (pairs with the pending `npx vercel login`).

## How to run the headless checks

```
npx tsc --noEmit && npm run build      # V1
npx tsx scripts/verify-import-e2e.ts   # V2/V9 (writes+deletes a throwaway user)
npx tsx scripts/verify-analytics.ts    # analytics vs legacy for a month
npx tsx src/lib/solar.ts               # V6 logic
npx tsx scripts/verify-import.ts       # template round-trip
```
