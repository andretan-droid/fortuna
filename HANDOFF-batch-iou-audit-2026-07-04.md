# Fortuna Plan — Batch Add · IOU Tracker · Full UI/UX Audit

**Date:** 2026-07-04 · **Build order:** WS-A → WS-B → WS-C

> **Archived 2026-07-09.** WS-A (batch add) shipped in commit `2a812a6`; WS-B (IOU
> tracker) shipped in `fe23301`. **Only WS-C remains** — the report-first full
> UI/UX audit (`/impeccable` + `/ui-ux-pro-max` + `frontend-design` across all 7
> pages), which was never run. Revive this doc if/when that audit is commissioned.

Decisions locked via Q&A:

| Decision | Choice |
|---|---|
| Batch-add input style | **Both** — paste box *and* editable grid in one screen |
| Receivables depth | **Simple IOU list** (person, amount, date, note, partial repayments) |
| Receivables in net worth | **Yes — counts as an asset** (mirror of BNPL liability) |
| Audit scope | **All 7 pages, report first** — fixes only after Andre approves the list |
| Audit tooling | `/impeccable` + `/ui-ux-pro-max` + `frontend-design` (all verified installed) |

---

## WS-A — Batch add transactions (paste + grid, one screen)

**What Andre gets:** a "Batch add" button on the Transactions page opening a full-height sheet with two ways in:

1. **Paste box** — paste rows straight from Excel/Notes in the existing format
   (`date ⇥ amount ⇥ description ⇥ category ⇥ method`). Parser reuses `toCents` and the
   date helpers; category/method matched by name, case-insensitive.
2. **Preview grid** — every parsed line becomes an editable row: date input, amount,
   description, category + method dropdowns. Bad rows get a red flag with the reason
   (unknown category, negative amount, bad date) but don't block the good rows.
   Blank rows can be added and typed directly — same grid serves paste and manual entry.
3. **"Add N transactions"** commits everything in one atomic `db.batch`
   (all-or-nothing, same pattern as the import wizard), then the feed refreshes.

**Defaults (flag if wrong):**
- Income vs Expense inferred from the category's type (Salary → Income).
- Parenthesised amounts rejected with "record refunds as an Income-type row".
- BNPL "(2/3)" suffixes kept as description text, **not** auto-linked — linking stays
  deliberate via the plan editor. (Auto-link = possible later add-on.)

**Build:** 1 server action (`createTransactionsBatch`), 1 client parser module +
self-check, 1 sheet component. **No schema change.**

---

## WS-B — "Owed to me" IOU tracker

**What Andre gets:**
- **"Owed to me"** section on the Debts page: one card per person — outstanding amount,
  original date, note — with an inline **"Log repayment"** action (partial amounts fine).
  Fully repaid IOUs collapse into a "Settled" `<details>` section (mirrors BNPL paid-off).
- **Add IOU** dialog: person (free text), amount, date, note.
- **Net worth:** total outstanding receivables appears as an asset line — the exact
  mirror of BNPL outstanding as a liability. Shows in the dashboard wealth card and
  the Debts page headline.

**Schema (additive migration — Andre runs `npm run db:push`):**
- `receivables` — person, amountCents, date, note
- `receivable_payments` — receivableId, date, amountCents
- Outstanding is **derived** (lent − sum of payments) — history is truth, no editable
  balance field to drift. Same philosophy as BNPL progress.

**Build:** 2 tables, 4 server actions (create/edit/delete IOU, log payment), 1 query,
Debts-page section + wealth-summary line.

**Noted default:** repayments do **not** create ledger transactions (per the "simple
list" choice) — so repayments won't appear in monthly cash flow. IOU history lives in
its own table.

---

## WS-C — Full UI/UX audit (all 7 pages, report first)

Runs **after** A and B so the new screens get audited too.

1. Invoke **`/impeccable` (audit mode)**, **`/ui-ux-pro-max`**, and **`frontend-design`**
   against the live app.
2. Playwright pass over all 7 pages — desktop + mobile widths, light + dark themes,
   screenshot every finding.
3. **Deliverable: ranked findings report** (severity · page · screenshot · proposed
   fix · effort). Andre ticks which fixes get implemented. **Nothing changes without
   approval** — outline-first gate applies.

---

## Verification gates (every workstream)

1. `npx tsc --noEmit` clean
2. `npm run build` exit 0
3. Self-checks pass (parser assertions; existing `verify-debts` untouched)
4. Playwright proof screenshots against `npm run dev` (port 3000)
5. Commit + push to `main` after each workstream lands

**Protected actions that stay Andre's:** `npm run db:push` (WS-B pauses for it) and
approving the WS-C fix list.

---

## Environment facts (for future sessions)

- `/impeccable` = enabled plugin `impeccable@impeccable` v3.5.0 (plugin cache).
- `/ui-ux-pro-max` = personal skill at `~/.claude/skills/ui-ux-pro-max`.
- Earlier "not installed" notes were stale and wrong — check disk before claiming a
  skill is unavailable. (Saved to memory as `design-skills-installed`.)
