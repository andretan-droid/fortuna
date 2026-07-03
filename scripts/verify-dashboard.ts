/**
 * scripts/verify-dashboard.ts — Phase 9.4 gate.
 *
 *   npx tsx scripts/verify-dashboard.ts
 *
 * Prints the dashboard's headline numbers straight from the DB so they can be
 * eyeballed against the legacy Sheet. Deliberately re-derives the SQL here
 * (does NOT import the server-only app queries): an independent check catches a
 * bug the app query would otherwise mirror. Read-only — SELECTs only.
 */
import { readFileSync } from "node:fs";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  accounts,
  categories,
  fxRates,
  holdings,
  netWorthEntries,
  transactions,
  users,
} from "@/db/schema";
import { formatCents } from "@/lib/money";
import { monthBounds, monthKey, todayISO } from "@/lib/dates";

function loadEnv() {
  try {
    const env = readFileSync(".env.local", "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    /* env may already be set */
  }
}

type Db = ReturnType<typeof getDb>;

async function cashflow(db: Db, userId: string, month: string) {
  const { first, nextFirst } = monthBounds(month);
  const rows = await db
    .select({
      framework: categories.framework,
      cents: sql<number>`coalesce(sum(${transactions.amountCents})::bigint, 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.deleted, false),
        gte(transactions.date, first),
        lt(transactions.date, nextFirst),
      ),
    )
    .groupBy(categories.framework);

  const m = new Map(rows.map((r) => [r.framework, Number(r.cents)]));
  const income = m.get("Income") ?? 0;
  const needs = m.get("Needs") ?? 0;
  const wants = m.get("Wants") ?? 0;
  const savings = m.get("Savings") ?? 0;
  const deduction = m.get("Deduction") ?? 0;
  const expense = needs + wants + savings;
  const net = income - expense - deduction;
  const rate = income > 0 ? ((income - expense) / income) * 100 : 0;

  console.log(`\n── ${month} · cash flow ──────────────────────────`);
  console.log(`  Income      ${formatCents(income).padStart(16)}`);
  console.log(`  Needs       ${formatCents(needs).padStart(16)}`);
  console.log(`  Wants       ${formatCents(wants).padStart(16)}`);
  console.log(`  Savings     ${formatCents(savings).padStart(16)}`);
  console.log(`  Deduction   ${formatCents(deduction).padStart(16)}`);
  console.log(`  ── expense  ${formatCents(expense).padStart(16)}`);
  console.log(`  ── net      ${formatCents(net).padStart(16)}`);
  console.log(`  ── savings rate  ${rate.toFixed(1)}%`);
}

async function netWorth(db: Db, userId: string) {
  const [accts, nwe, hs, fx] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.active, true)))
      .orderBy(asc(accounts.sort)),
    db
      .select({
        accountId: netWorthEntries.accountId,
        month: netWorthEntries.month,
        balanceCents: netWorthEntries.balanceCents,
      })
      .from(netWorthEntries)
      .where(eq(netWorthEntries.userId, userId))
      .orderBy(asc(netWorthEntries.accountId), asc(netWorthEntries.month)),
    db.select().from(holdings).where(eq(holdings.userId, userId)),
    db.select().from(fxRates).where(eq(fxRates.userId, userId)),
  ]);

  const latest = new Map<string, { month: string; balanceCents: number }>();
  for (const e of nwe) latest.set(e.accountId, { month: e.month, balanceCents: e.balanceCents });

  let assets = 0;
  let liab = 0;
  for (const a of accts) {
    const l = latest.get(a.id);
    if (!l) continue;
    if (a.kind === "Asset") assets += l.balanceCents;
    else liab += l.balanceCents;
  }

  const fxMap = new Map<string, number>();
  for (const f of fx) {
    const r = Number(f.rateLive ?? f.fallback);
    if (Number.isFinite(r)) fxMap.set(f.pair, r);
  }
  let port = 0;
  for (const h of hs) {
    const ccy = h.ccy ?? "MYR";
    const shares = Number(h.shares ?? 0);
    const price = Number(h.manualPriceOverride ?? h.priceLive ?? 0);
    const rate = ccy === "MYR" ? 1 : (fxMap.get(`${ccy}MYR`) ?? 0);
    port += Math.round(shares * price * rate * 100);
  }

  console.log(`\n── net worth (latest balances + live portfolio) ──`);
  console.log(`  Assets       ${formatCents(assets).padStart(16)}`);
  console.log(`  Liabilities  ${formatCents(liab).padStart(16)}`);
  console.log(`  Portfolio    ${formatCents(port).padStart(16)}  (${hs.length} holdings)`);
  console.log(`  ── net worth ${formatCents(assets - liab + port).padStart(16)}`);
}

async function main() {
  loadEnv();
  const db = getDb();
  const us = await db.select({ id: users.id, email: users.email }).from(users);
  if (!us.length) throw new Error("No users — sign in once first.");
  const { id: userId, email } = us[0];

  const [{ maxDate }] = await db
    .select({ maxDate: sql<string | null>`max(${transactions.date})` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.deleted, false)));

  const current = monthKey(todayISO());
  const latest = maxDate ? monthKey(maxDate) : current;

  // Optional explicit months: `tsx scripts/verify-dashboard.ts 2026-06 2026-05`.
  const argMonths = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}$/.test(a));
  const months = argMonths.length ? argMonths : [...new Set([current, latest])];

  console.log(`Fortuna dashboard verify · ${email}`);
  console.log(`today=${todayISO()}  current-month=${current}  latest-data-month=${latest}`);

  for (const month of months) {
    await cashflow(db, userId, month);
  }
  await netWorth(db, userId);
  console.log("\nCompare the above against the legacy Sheet's month tab + Net Worth tab.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
