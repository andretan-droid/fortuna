# Fortuna — Loop Handoff (Phase 8.3 → Phase 13)

You are taking over an **autonomous build loop** driving the Fortuna budget-tracker
web app to completion. Phases 1–7 are done; Phase 8 is in progress. Continue the
state-machine exactly as below. **Paste this whole file into the fresh chat.**

---

## 0. The one thing that controls everything

`.fortuna-loop-state.json` at the fortuna root is the **single source of truth**
for where the loop is. Read it first, every time. It has `currentPhase`,
`currentTask`, and a `phases` tree where each task carries `status` +
`commit`. **Right now: `currentPhase: 8, currentTask: "8.3"`.**

Workspace root:
`c:\Users\AndreTanJunYi\OneDrive - Sage3 Capital Sdn Bhd\Desktop\Claude Playground\03 Internal Tools\Budget Tracker\fortuna`

---

## 1. The loop contract (do this per micro-task)

1. Read `.fortuna-loop-state.json` → focus **only** on the single next incomplete
   task. Do **not** write ahead into later phases before the current gate is green.
2. Write/update the task's files.
3. **Deterministic checker:** `npx tsc --noEmit && npm run build`.
   - **SUCCESS →** `git commit` (descriptive msg), set the task `status:"completed"`
     with its `commit`, advance `currentTask`/`currentPhase`, commit the state advance.
   - **FAIL →** parse errors, `git checkout -- src/` to discard, refine, retry.
4. Repeat until Phase 13 closure criteria (V1–V10) pass, then write the closure
   report, set `completed:true`, and stop.

Commit trailer used so far: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
(the user drives model switches manually via `/model` — **do not automate model
switching**; just keep coding).

---

## 2. LOCKED architectural rules (every line must obey)

- **Multi-tenancy:** every query/mutation/route goes through `requireUserId()`
  (`src/server/auth-helpers.ts`). Client input never dictates user scoping. In the
  import core, the trusted caller passes `userId` — same principle.
- **Money = integer cents** in `bigint *_cents`, stored **positive** with a `type`
  enum carrying direction (`Income|Expense|Deduction|Transfer`). Balances may be
  negative. The only string↔cents boundary is `src/lib/money.ts` (`toCents`,
  `formatCents`, `formatAmount`). Dates are ISO `YYYY-MM-DD` strings; months
  `YYYY-MM` (`src/lib/dates.ts`, `monthKey`/`todayISO`). Never use `Date` math for
  comparisons — lexicographic only.
- **DB:** Drizzle on `@neondatabase/serverless` **HTTP** driver. `getDb()`
  (`src/db/client.ts`) is a lazy singleton (no top-level env read → build passes
  with no `DATABASE_URL`). Multi-statement writes use `db.batch([...])` (the only
  transactional primitive on neon-http; it can't read generated ids back
  mid-batch → **all uuids are minted app-side** via `crypto.randomUUID()`).
- **RESTRICT vs delete:** categories / payment_methods / accounts are
  RESTRICT-referenced by the ledger → archive via `active` toggle, never
  hard-delete. sinking_funds / recurring_rules are referenced by nothing → real
  delete OK.
- **type→framework rule:** framework mirrors type for Income/Deduction/Transfer;
  only **Expense** splits into Needs/Wants/Savings.
- **Design tokens:** Ivory `#FFFEF2` / Obsidian `#050411`, Tailwind v4 `@theme`
  (no config file). Reads = RSC + `revalidatePath`; only the transactions feed uses
  TanStack Query. Actions are `"use server"` returning `ActionResult`
  (`{ok:true;id} | {ok:false;error}`) — **never throw** (Next masks prod errors).
- **Motion:** all `motion` animations route through `src/components/motion/reveal.tsx`
  (reduced-motion safe).
- **Ponytail mode is active** (lazy-senior style): minimal code, native
  `<select>`/checkboxes over new shadcn primitives, mark deliberate simplifications
  with `// ponytail:` comments, leave one runnable check for non-trivial logic.
- **Explanatory output style** is on: prefix code work with short
  `★ Insight ───` educational notes.

---

## 3. Environment gotchas (these WILL bite you)

- **OneDrive `.next` readlink EINVAL:** `npm run build` intermittently dies with
  `EINVAL: invalid argument, readlink '.next/...'` — a OneDrive cloud-sync artifact,
  **not a code error**. Fix: **kill the dev server → `rm -rf .next` → rebuild**.
  The dev server on port 3000 holds locks on `.next`; if `rm` says "Directory not
  empty," it's a transient post-kill lock — just retry `rm -rf .next` once. After a
  clean build, restart dev with `npm run dev` (background) for browser verification.
- **Dev server:** `npm run dev` on **port 3000 only** — Google OAuth redirect URI is
  registered for port 3000, so a stale server on another port breaks sign-in. Kill
  stragglers: `netstat -ano | grep ':3000' | grep LISTENING` → `taskkill //PID <pid> //F`.
- **Playwright MCP** holds the **signed-in browser session** — use it for all
  in-browser verification (dashboard, categories, settings). Do **not** try to
  materialize/print session JWTs or credentials (the permission classifier blocks it,
  and it's unnecessary — the Playwright profile is already authenticated).
- **App's sole user:** Neon `users.id = 42bed719-6796-4d6b-8499-69c9ce26ff28`
  (email `andretanbusiness@gmail.com`). The seed CLI resolves the sole user
  automatically; pass `--user <email>` only if a second user ever exists.
- **tsx** runs the CLI scripts and resolves the `@/` path alias via tsconfig.
  `npx tsc --noEmit` covers `scripts/**` (tsconfig `**/*.ts` include).

---

## 4. What's DONE (git history, newest first)

```
945c29f loop: mark 8.2 complete, advance pointer → 8.3
1baf756 Phase 8.2: seed:legacy CLI
ad4ae20 Phase 8.1: legacy-import core (validate → uuid graph → batch → reconcile)
6e7cd56 Phase 7.4: fix category spend subquery + close phase
97647ae Phase 7.3: settings page (profile, price feed, PMs, accounts, sinking, recurring, danger)
c88513a Phase 7.2: categories page (manager, editor, framework summary, budget bars)
b476296 Phase 7.1: categories + settings server data layer
6da51e8 (Phases 1–6 baseline)
```

**Phase 7 (CLOSED):** categories page + all settings managers, browser-verified
(budget edit persists; profile/account/sinking-fund persist across reload). A
critical spend-subquery bug was fixed in `src/server/queries/categories.ts`: inside
a raw ``sql`...` `` template, a Drizzle column ref like `${categories.id}` renders
**unqualified** as `"id"` and PG binds it to the inner subquery table. Fix: alias
the inner table (`t`) and write the outer correlation as **literal text**
`categories.id`. Remember this pattern for any future correlated subquery.

**Phase 8.1 (`src/lib/legacy-import.ts`) — the migration core, DONE:**
- `LegacyBundle` zod contract: every collection optional/defaulted (a partial sheet
  still validates). Children reference parents by **name**, not uuid.
- `buildGraph(userId, bundle)` — **pure** (no DB): mints parent uuids, resolves child
  FKs from name→uuid maps, derives `txn.type` from the referenced category and
  `framework` from type. Dangling refs are **collected** (not thrown); import aborts
  before any write if any name is unresolved.
- `importLegacyBundle(db, userId, bundle, {wipeFirst})` — FK-safe `db.batch` (one
  implicit txn), 500-row chunks under the PG param ceiling, optional wipe-first.
- `reconcile()` — reads back count + cent-sum per table; **fails the import on any
  mismatch** (this is the V2 gate's teeth).
- `selfCheck()` (argv-guarded) verifies graph logic without a DB — green.
- **Portfolio tables (holdings / fx_rates / snapshots / bnpl_plans) are NOW in the
  core** (bundle collections `holdings`, `fxRates`, `snapshots`, `bnplPlans`).
  numeric() columns (shares/prices/rates) take numbers in the bundle and are
  stringified in `buildGraph`; bnpl references a category by name; inserts are
  FK-ordered (bnpl after categories). Reconcile + selfCheck cover them. So 8.3 just
  needs to *populate* these collections from the sheet's portfolio tabs if present.

**Phase 8.2 (`scripts/seed-legacy.ts` + `npm run seed:legacy`) — DONE:**
- `npm run seed:legacy -- [--file data/legacy/bundle.json] [--force] [--user <email>]`
- Loads `.env.local` in-script (tsx doesn't auto-load it), resolves the user, imports,
  prints the reconciliation table, exits 1 on any failure. `--force` wipes first.

---

## 5. What's LEFT — Phase 8.3 → Phase 13

### Phase 8 — Migration (gate: V2 reconciliation all-match on real data)
- **8.3 (NEXT):** Use **Google Drive MCP** to export the legacy budget Sheet, then
  **map it into a `LegacyBundle` JSON** at `data/legacy/bundle.json`. This is where
  **format-detection (v4 vs "Ledger")** lives — the two known legacy sheet layouts.
  The mapping is the real work: sheet columns → bundle fields, parse money strings to
  cents with `toCents`, dates to ISO, derive nothing the core already derives
  (type/framework). The core **already accepts** portfolio collections
  (holdings/fxRates/snapshots/bnplPlans) — just populate them from the sheet's
  portfolio tabs if the v4 workbook has them.
  - **SOURCE FILE ALREADY LOCATED (Drive MCP, this session).** The legacy source is
    **`Ultimate_Budget_Tracker_v4.xlsx`**, Drive fileId
    **`1QfrHrcE4W7BktpSMVMhuJ83IA39_UkAn`** (owner andretanbusiness@gmail.com,
    modified 2026-05-30 — the newest of the lineage). This is the "v4" format.
    Older lineage (v3 `1PFxIfVDuqf7Rp_w_HZSC6123OzORHnyg`, v2, REBUILT) exists but v4
    is authoritative. The "Ledger" format = the v5-app-era layout (see the
    `project_budget_tracker_v5` memory) — only relevant if a v5 Ledger sheet is the
    chosen source instead; default to v4.
  - **Fresh-chat plan for 8.3:** call `mcp__claude_ai_Google_Drive__read_file_content`
    with that fileId (openxml spreadsheet is supported → returns NL text of all tabs).
    Read the tab layout, map each tab to a bundle collection (transactions/ledger →
    `transactions`; category/budget tab → `categories`; net-worth/accounts tab →
    `accounts` + `netWorthEntries`; sinking/recurring tabs likewise). Parse money via
    `toCents`, dates to ISO `YYYY-MM-DD`, months to `YYYY-MM`. Write
    `data/legacy/bundle.json`. **Do NOT set type/framework** beyond what the core
    derives — just give each category its `type`. Then `tsc && build` (no app code
    changed, so it should stay green), commit, advance to 8.4.
  - **Drive MCP was authorized this session** (Google Drive tools worked). If a fresh
    session isn't authorized, ask the user to authorize the connector.
- **8.4:** `npm run seed:legacy -- --force` against the real bundle. **⚠ `--force`
  wipes the app's data** — the current DB holds only manual Phase-7 verification rows
  (fine to wipe). Iterate until V2 reconciliation is **exact-match** (the CLI prints
  the table and exits 0 only when clean).
- **8.5:** Freeze the schema — `npm run db:generate` (drizzle-kit), commit the
  generated migrations under `drizzle/`. Schema (`src/db/schema.ts`) is the frozen
  source of truth; this captures it as versioned SQL.

### Phase 9 — Dashboard on real data (gate: current-month totals match the Sheet)
- **9.1** `queries/wealth.ts` + dashboard queries (batch with `Promise.all`).
- **9.2** widgets: hero-numbers, month-pulse, budget-frameworks, sinking-funds,
  recent-activity, empty-state.
- **9.3** wealth-card, holdings-table, refresh-prices-button, account-cards,
  balance-editor.
- **9.4** verify current-month totals vs the Sheet; close phase.

### Phase 10 — Analytics (gate: numbers cross-checked vs legacy for a known month)
- **10.1** analytics queries (month-scoped aggregates).
- **10.2** month-picker, cashflow-chart, category-breakdown, framework-donut,
  networth-area, savings-trend.
- **10.3** cross-check a known month vs legacy; close.

### Phase 11 — Import wizard + template + start-fresh (gate: template round-trips, V9)
- **11.1** `make:template` script (emits legacy sheet/column names).
- **11.2** wizard: upload → mapping → preview → commit — **shares the
  `lib/legacy-import` core** (don't duplicate import logic).
- **11.3** start-fresh path + V9 verify (template round-trips on a 2nd account); close.

### Phase 12 — Solar theme + motion polish (gate: V5/V6)
- **12.1** `use-solar-theme` resolution ladder + `fortuna-theme-mode` storage key.
- **12.2** motion polish through the `motion/reveal.tsx` choke point.
- **12.3** V5 reduced-motion + V6 solar-boundary verify; close.

### Phase 13 — Final sweep + closure (gate: V1–V10 green)
- **13.1** run the V1–V10 sweep, fix regressions:
  - **V1** `tsc --noEmit` + `next build` green with no env flags.
  - **V2** migration reconciliation matches source exactly.
  - **V3–V6** layout render, hydration, reduced-motion override, solar boundary.
  - **V7–V10** tabular-numeral layout stability + price-feed API token
    fault-tolerance.
- **13.2** write the closure report to the workspace, set `completed:true` in
  `.fortuna-loop-state.json`, **terminate the loop**.

---

## 6. Key files map

| Path | What |
|---|---|
| `.fortuna-loop-state.json` | Loop state — read first, update last. |
| `src/db/schema.ts` | Frozen schema (all tables/enums/constraints). |
| `src/db/client.ts` | `getDb()` lazy singleton (neon-http). |
| `src/lib/legacy-import.ts` | Migration core (8.1) — reused by seed + wizard. |
| `scripts/seed-legacy.ts` | Seed CLI (8.2). |
| `src/lib/money.ts` / `dates.ts` | Cents + ISO/month helpers (the only conversion boundary). |
| `src/server/auth-helpers.ts` | `requireUserId()`. |
| `src/server/queries/*` | `import "server-only"` read fns (RSC). |
| `src/server/actions/*` | `"use server"` mutations → `ActionResult`. |
| `src/components/motion/reveal.tsx` | Motion choke point. |
| `data/legacy/bundle.json` | (8.3 will create) the mapped LegacyBundle. |
| `drizzle/` | (8.5 will create) frozen migrations. |

---

## 7. Start-of-session checklist for the fresh chat

1. Read `.fortuna-loop-state.json` → confirm `currentTask` (should be `8.3`).
2. Confirm git is clean: `git status --short`, `git log --oneline -6`.
3. Confirm Google Drive MCP is authorized (8.3 needs it) — if not, ask the user.
4. Execute 8.3: export the Sheet, map → `data/legacy/bundle.json`, then run the
   deterministic checker, commit, advance.
5. Keep going through the phases; honor the `.next` build gotcha and port-3000 rule.
