/**
 * scripts/verify-analytics.ts — Phase 10.3 gate.
 *
 *   npx tsx scripts/verify-analytics.ts [YYYY-MM ...]   (default: latest data month)
 *
 * Prints the analytics-specific aggregates (per-category breakdown, framework
 * donut, net-worth trend) straight from the DB so they can be eyeballed against
 * the legacy Sheet. Re-derives the SQL + carry-forward here independently — does
 * NOT import queries/analytics.ts — so a bug there can't hide behind itself.
 * Read-only (SELECTs only).
 */
import { readFileSync } from "node:fs";
import { and, asc, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accounts, bnplPlans, categories, netWorthEntries, transactions, users } from "@/db/schema";
import { bnplOutstandingAtCents, type BnplPlanInput, type BnplTxnMonth } from "@/lib/bnpl";
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

async function categoryAndFramework(db: Db, userId: string, month: string) {
  const { first, nextFirst } = monthBounds(month);
  const rows = await db
    .select({
      category: categories.name,
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
    .groupBy(categories.name, categories.framework)
    .orderBy(desc(sql`sum(${transactions.amountCents})`));

  console.log(`\n── ${month} · category breakdown ─────────────────`);
  const fw = new Map<string, number>();
  for (const r of rows) {
    const c = Number(r.cents);
    if (c === 0) continue;
    fw.set(r.framework, (fw.get(r.framework) ?? 0) + c);
    console.log(`  ${r.category.padEnd(22)} ${r.framework.padEnd(10)} ${formatCents(c).padStart(15)}`);
  }
  console.log(`  ── framework donut (Needs/Wants/Savings) ──`);
  for (const f of ["Needs", "Wants", "Savings"]) {
    console.log(`  ${f.padEnd(10)} ${formatCents(fw.get(f) ?? 0).padStart(15)}`);
  }
}

async function netWorthTrend(db: Db, userId: string) {
  const [nwe, accts, planRows, txnRows] = await Promise.all([
    db
      .select({
        accountId: netWorthEntries.accountId,
        month: netWorthEntries.month,
        balanceCents: netWorthEntries.balanceCents,
      })
      .from(netWorthEntries)
      .where(eq(netWorthEntries.userId, userId))
      .orderBy(asc(netWorthEntries.month)),
    db.select({ id: accounts.id, kind: accounts.kind }).from(accounts).where(eq(accounts.userId, userId)),
    // BNPL inputs re-derived here (not via queries/debts) so a wiring bug there
    // can't hide behind itself — same independence rule as the rest of the file.
    db
      .select({
        id: bnplPlans.id,
        item: bnplPlans.item,
        platform: bnplPlans.platform,
        totalAmountCents: bnplPlans.totalAmountCents,
        nInstalments: bnplPlans.nInstalments,
        instalmentCents: bnplPlans.instalmentCents,
        firstDueMonth: bnplPlans.firstDueMonth,
        status: bnplPlans.status,
      })
      .from(bnplPlans)
      .where(eq(bnplPlans.userId, userId)),
    db
      .select({ planId: transactions.bnplPlanId, date: transactions.date })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "Expense"),
          eq(transactions.deleted, false),
          isNotNull(transactions.bnplPlanId),
        ),
      ),
  ]);
  const kind = new Map(accts.map((a) => [a.id, a.kind]));
  const plans: BnplPlanInput[] = planRows;
  const bnplTxns: BnplTxnMonth[] = txnRows
    .filter((t): t is { planId: string; date: string } => t.planId != null)
    .map((t) => ({ planId: t.planId, month: monthKey(t.date) }));
  const months = [...new Set(nwe.map((r) => r.month))].sort();

  console.log(`\n── net-worth trend (carry-forward; liab incl. BNPL outstanding) ──`);
  for (const month of months) {
    const latest = new Map<string, number>();
    for (const r of nwe) if (r.month <= month) latest.set(r.accountId, r.balanceCents);
    let assets = 0;
    let liab = 0;
    for (const [id, bal] of latest) {
      if (kind.get(id) === "Liability") liab += bal;
      else assets += bal;
    }
    const bnpl = bnplOutstandingAtCents(plans, bnplTxns, month);
    liab += bnpl; // legacy calc.js:259-260 parity — BNPL is a liability each month
    console.log(
      `  ${month}   assets ${formatCents(assets).padStart(15)}   liab ${formatCents(liab).padStart(12)}   (bnpl ${formatCents(bnpl).padStart(10)})   net ${formatCents(assets - liab).padStart(15)}`,
    );
  }
}

async function main() {
  loadEnv();
  const db = getDb();
  const [us] = await db.select({ id: users.id, email: users.email }).from(users);
  if (!us) throw new Error("No users — sign in once first.");

  const [{ maxDate }] = await db
    .select({ maxDate: sql<string | null>`max(${transactions.date})` })
    .from(transactions)
    .where(and(eq(transactions.userId, us.id), eq(transactions.deleted, false)));
  const latest = maxDate ? monthKey(maxDate) : monthKey(todayISO());

  const argMonths = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}$/.test(a));
  const months = argMonths.length ? argMonths : [latest];

  console.log(`Fortuna analytics verify · ${us.email}`);
  console.log(`latest-data-month=${latest}  checking=${months.join(", ")}`);
  for (const month of months) await categoryAndFramework(db, us.id, month);
  await netWorthTrend(db, us.id);
  console.log("\nCross-check the above against the legacy Sheet's month + net-worth tabs.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
