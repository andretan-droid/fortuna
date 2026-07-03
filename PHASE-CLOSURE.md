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

**Browser sweep run 2026-07-03** (Playwright against the live authed session,
commit `b36f8b5`). Two defects found and fixed mid-sweep.

| # | Check | Status | Evidence |
|---|---|---|---|
| V1 | `tsc` + `next build` green, no env | ✅ | green at every commit incl. `b36f8b5`; Phase-4 no-env safety intact |
| V2 | Migration reconciliation exact-match | ✅ | 8.4 (real data) + `scripts/verify-import-e2e.ts` (fresh user, 7 collections tie out) |
| V3 | Viewport × theme × route sweep | ✅ **browser** | 375/768/1440 × Ivory/Obsidian × 6 routes, 0 horizontal overflow. **Fixed:** `/analytics` overflowed 66px @375 — framework-donut row now stacks below `sm` |
| V4 | Hydration console sweep | ✅ **browser** | 0 errors / 0 warnings across all 6 routes on load |
| V5 | Reduced-motion — nothing stuck hidden | ✅ by construction | `reveal.tsx` + `app/(app)/template.tsx` render children statically at full opacity when reduced; `AnimatedNumber` renders final value |
| V6 | Solar boundary / fallback | ✅ **browser** | solar mode resolved to `light` in-browser (07:00 boundary), 0 console errors; `src/lib/solar.ts` self-check backs the logic; fixed-07/19 fallback by construction |
| V7 | Tabular-numeral width test | ✅ **browser** | `.tabular` = `tabular-nums`; `111,111.11` / `999,999.99` / `000,000.00` all render **79.375px — 0px jitter** |
| V8 | Keyboard focus + a11y + contrast | ✅ **browser** | 0 label/name violations after fix (account-type select got `aria-label`); focus ring present on tab-walk; contrast 8.31:1 (nav) to 15.51:1 (h1); chart palette CVD/contrast validated via dataviz `validate_palette.js`. _Literal Lighthouse numeric score not run — the audit tool launches an unauthenticated browser; its constituent a11y checks were run directly against the signed-in pages instead._ |
| V9 | Import round-trip on a 2nd account | ✅ core+DB | `verify-import-e2e.ts` runs the real commit path for a fresh user. Literal 2nd-Google-OAuth sign-in still owner-only (auth, orthogonal to import) |
| V10 | Price refresh vs real Apps Script endpoint | ⏳ **owner-only** | needs the live endpoint + token — un-runnable without Andre's credentials |

## Manual steps remaining (owner)

1. ~~Browser V-sweep (V3/V4/V7/V8)~~ — **DONE 2026-07-03** (commit `b36f8b5`). See matrix above.
2. ~~V6 solar~~ — **DONE** (resolved in-browser, no errors). Optional extra: fake-clock across a boundary + block `sunrise-sunset.org` to eyeball the 07/19 fallback; logic already unit-verified.
3. **V9 literal** — add a 2nd Google account as an OAuth test user, sign in, upload `public/templates/fortuna-import.xlsx` via `/import`, confirm the data lands. _(Import commit path already proven headlessly; this only exercises OAuth.)_
4. **V10** — configure the price-feed URL/token in Settings, hit "Refresh prices" against the real Apps Script endpoint; confirm override precedence and the bad-token toast. **Blocks `completed: true`** — needs your live endpoint.
5. **Data caveat (from 9.4)** — net-worth liabilities show 0 because the P8 import captured only asset balance entries (confirmed live: Net Worth reads RM 202,645.63 with liabilities=0). Backfill via the dashboard Balance Editor or re-import with liability rows.
6. **Deploy** — out of scope (pairs with the pending `npx vercel login`).

## How to run the headless checks

```
npx tsc --noEmit && npm run build      # V1
npx tsx scripts/verify-import-e2e.ts   # V2/V9 (writes+deletes a throwaway user)
npx tsx scripts/verify-analytics.ts    # analytics vs legacy for a month
npx tsx src/lib/solar.ts               # V6 logic
npx tsx scripts/verify-import.ts       # template round-trip
```
