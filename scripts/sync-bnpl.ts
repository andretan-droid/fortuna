/**
 * scripts/sync-bnpl.ts — reconcile the app's BNPL plans with the spreadsheet
 * tracker Andre maintains, and auto-link existing ledger instalments.
 *
 *   npx tsx scripts/sync-bnpl.ts            # DRY RUN — prints the plan, writes nothing
 *   npx tsx scripts/sync-bnpl.ts --apply    # actually insert / update / link
 *
 * Idempotent: a second run after --apply reports "no changes". It NEVER inserts
 * transactions (that would fake progress) — it only links Expense txns that
 * already exist and match an instalment amount in an expected month. It never
 * deletes plans; DB-only plans are reported, not removed.
 *
 * Run with DATABASE_URL exported first (secrets live in Windows user env):
 *   $env:DATABASE_URL = [System.Environment]::GetEnvironmentVariable("DATABASE_URL","User")
 */
import { readFileSync } from "node:fs";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bnplPlans, categories, transactions, users } from "@/db/schema";
import { toCents } from "@/lib/money";
import { addMonths, monthKey } from "@/lib/dates";

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

/* ── the tracker, pasted 2026-07-03 (29 rows). payoff: "" = paid off. ───────── */
type Row = {
  item: string;
  platform: string;
  category: string;
  total: string;
  n: number;
  left: number;
  instal: string;
  payoff: string; // 'YYYY-MM' for active, '' for paid off
};
const TRACKER: Row[] = [
  { item: "Key Rack Holder", platform: "Shopee", category: "Shopping", total: "19.07", n: 1, left: 0, instal: "19.07", payoff: "" },
  { item: "Stanley Boot", platform: "Shopee", category: "Shopping", total: "9.79", n: 1, left: 0, instal: "9.79", payoff: "" },
  { item: "Metal Desk Organizer", platform: "Shopee", category: "Shopping", total: "37.26", n: 1, left: 0, instal: "37.26", payoff: "" },
  { item: "Kapten Batik", platform: "Atome", category: "Shopping", total: "259.11", n: 3, left: 0, instal: "86.37", payoff: "" },
  { item: "Airpods Headphone Case", platform: "Shopee", category: "Shopping", total: "16.65", n: 3, left: 0, instal: "5.55", payoff: "" },
  { item: "Cute Card Holder", platform: "Shopee", category: "Home", total: "5.10", n: 3, left: 0, instal: "1.70", payoff: "" },
  { item: "RFID Tag", platform: "Shopee", category: "Car Maintenance", total: "19.59", n: 3, left: 0, instal: "6.53", payoff: "" },
  { item: "INHO Dustbin", platform: "Shopee", category: "Shopping", total: "41.28", n: 3, left: 0, instal: "13.76", payoff: "" },
  { item: "Razer Blackshark V3 Pro", platform: "Shopee", category: "Gifts", total: "972.42", n: 3, left: 0, instal: "324.14", payoff: "" },
  { item: "Bloomthis", platform: "Grab", category: "Gifts", total: "174.00", n: 4, left: 0, instal: "43.50", payoff: "" },
  { item: "Steam Games", platform: "Shopee", category: "Entertainment", total: "86.40", n: 1, left: 0, instal: "86.40", payoff: "" },
  { item: "Spigen Case + Screen Protector", platform: "Shopee", category: "Phone", total: "154.89", n: 3, left: 2, instal: "51.63", payoff: "2026-09" },
  { item: "Cafec Paper", platform: "Shopee", category: "Coffee", total: "28.89", n: 3, left: 2, instal: "9.63", payoff: "2026-09" },
  { item: "Origami Cup", platform: "Shopee", category: "Coffee", total: "52.43", n: 3, left: 2, instal: "17.48", payoff: "2026-09" },
  { item: "6L Kettle", platform: "Shopee", category: "Home", total: "28.31", n: 3, left: 2, instal: "9.44", payoff: "2026-09" },
  { item: "Third Wave Water", platform: "Shopee", category: "Coffee", total: "81.08", n: 3, left: 2, instal: "27.03", payoff: "2026-09" },
  { item: "YoloFoods", platform: "Atome", category: "Dinner", total: "208.07", n: 3, left: 1, instal: "69.36", payoff: "2026-08" },
  { item: "Puras", platform: "Atome", category: "Shopping", total: "73.50", n: 3, left: 2, instal: "24.50", payoff: "2026-09" },
  { item: "MHW-3 Bomber Coffee Server", platform: "Shopee", category: "Shopping", total: "95.85", n: 3, left: 2, instal: "31.95", payoff: "2026-09" },
  { item: "Zerov Bottle & Utensil Cleaner", platform: "Shopee", category: "Shopping", total: "3.08", n: 1, left: 1, instal: "3.08", payoff: "2026-08" },
  { item: "Ghostbird Coffee Bean", platform: "Shopee", category: "Coffee", total: "104.30", n: 1, left: 1, instal: "104.30", payoff: "2026-08" },
  { item: "Tekisu Glass Spray Bottle", platform: "Shopee", category: "Home", total: "2.82", n: 1, left: 1, instal: "2.82", payoff: "2026-08" },
  { item: "Bincoo Coffee Filter Presser", platform: "Shopee", category: "Coffee", total: "18.82", n: 1, left: 1, instal: "18.82", payoff: "2026-08" },
  { item: "Tekisu Cat Paw Lamp", platform: "Shopee", category: "Home", total: "47.28", n: 1, left: 0, instal: "47.28", payoff: "" },
  { item: "Yoasobi XL shirt", platform: "Shopee", category: "Shopping", total: "113.62", n: 1, left: 0, instal: "113.62", payoff: "" },
  { item: "Golf Umbrella", platform: "Shopee", category: "Home", total: "11.30", n: 3, left: 3, instal: "3.77", payoff: "2026-10" },
  { item: "Water Dispenser", platform: "Shopee", category: "Home", total: "20.20", n: 3, left: 3, instal: "6.73", payoff: "2026-10" },
  { item: "JWC Coffee", platform: "Shopee", category: "Coffee", total: "58.23", n: 3, left: 3, instal: "19.41", payoff: "2026-10" },
  { item: "Hario Tritan NEO", platform: "Shopee", category: "Coffee", total: "95.86", n: 3, left: 3, instal: "31.95", payoff: "2026-10" },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const cents = (s: string) => {
  const c = toCents(s);
  if (c == null) throw new Error(`Bad money string: "${s}"`);
  return c;
};

type Derived = {
  row: Row;
  item: string;
  platform: string | null;
  categoryId: string;
  totalAmountCents: number;
  nInstalments: number;
  instalmentCents: number;
  paid: number;
  firstDueMonth: string | null;
  expectedMonths: string[]; // months an instalment is expected in (for linking)
};

async function main() {
  loadEnv();
  const apply = process.argv.includes("--apply");
  const db = getDb();

  const [us] = await db.select({ id: users.id, email: users.email }).from(users);
  if (!us) throw new Error("No users — sign in once first.");
  const userId = us.id;

  // Resolve category names → ids. Unresolved = hard stop (never guess).
  const catRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId));
  const catByName = new Map(catRows.map((c) => [norm(c.name), c.id]));

  const unresolved = new Set<string>();
  const derived: Derived[] = TRACKER.map((row) => {
    const categoryId = catByName.get(norm(row.category));
    if (!categoryId) unresolved.add(row.category);
    const paid = row.n - row.left;
    // Active rows: firstDue = payoff − (n−1). Paid-off rows: unknown → null.
    const firstDueMonth = row.payoff ? addMonths(row.payoff, -(row.n - 1)) : null;
    const expectedMonths =
      firstDueMonth && paid > 0
        ? Array.from({ length: paid }, (_, i) => addMonths(firstDueMonth, i))
        : [];
    return {
      row,
      item: row.item.trim(),
      platform: row.platform.trim() || null,
      categoryId: categoryId ?? "",
      totalAmountCents: cents(row.total),
      nInstalments: row.n,
      instalmentCents: cents(row.instal),
      paid,
      firstDueMonth,
      expectedMonths,
    };
  });

  if (unresolved.size) {
    console.error("✗ Unresolved category names (create them or fix the tracker):");
    for (const n of unresolved) console.error(`   · ${n}`);
    process.exit(2);
  }

  // Existing plans + all live Expense txns (for matching / linking).
  const [planRows, txnRows] = await Promise.all([
    db
      .select({
        id: bnplPlans.id,
        item: bnplPlans.item,
        platform: bnplPlans.platform,
        categoryId: bnplPlans.categoryId,
        totalAmountCents: bnplPlans.totalAmountCents,
        nInstalments: bnplPlans.nInstalments,
        instalmentCents: bnplPlans.instalmentCents,
        firstDueMonth: bnplPlans.firstDueMonth,
      })
      .from(bnplPlans)
      .where(eq(bnplPlans.userId, userId)),
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        amountCents: transactions.amountCents,
        categoryId: transactions.categoryId,
        bnplPlanId: transactions.bnplPlanId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "Expense"),
          eq(transactions.deleted, false),
        ),
      )
      .orderBy(asc(transactions.date)),
  ]);

  const planByItem = new Map(planRows.map((p) => [norm(p.item), p]));
  const trackerItems = new Set(derived.map((d) => norm(d.item)));

  const inserts: Derived[] = [];
  const updates: { id: string; d: Derived; diffs: string[] }[] = [];

  for (const d of derived) {
    const existing = planByItem.get(norm(d.item));
    if (!existing) {
      inserts.push(d);
      continue;
    }
    const diffs: string[] = [];
    if (existing.totalAmountCents !== d.totalAmountCents)
      diffs.push(`total ${existing.totalAmountCents}→${d.totalAmountCents}`);
    if (existing.nInstalments !== d.nInstalments)
      diffs.push(`n ${existing.nInstalments}→${d.nInstalments}`);
    if (existing.instalmentCents !== d.instalmentCents)
      diffs.push(`instal ${existing.instalmentCents}→${d.instalmentCents}`);
    if ((existing.platform ?? "") !== (d.platform ?? ""))
      diffs.push(`platform ${existing.platform ?? "∅"}→${d.platform ?? "∅"}`);
    if (existing.categoryId !== d.categoryId) diffs.push("category");
    // Only set firstDueMonth from the tracker for active rows (we know it there).
    if (d.firstDueMonth && (existing.firstDueMonth ?? "").slice(0, 7) !== d.firstDueMonth)
      diffs.push(`firstDue ${existing.firstDueMonth ?? "∅"}→${d.firstDueMonth}`);
    if (diffs.length) updates.push({ id: existing.id, d, diffs });
  }

  const dbOnly = planRows.filter((p) => !trackerItems.has(norm(p.item)));

  // Pre-generate ids for inserts so we can link txns in the same run.
  const insertIds = new Map<Derived, string>();
  for (const d of inserts) insertIds.set(d, crypto.randomUUID());

  // ── Auto-link: for each plan, fill unlinked instalment txns in expected months.
  const linkedCountByPlan = new Map<string, number>();
  for (const t of txnRows) if (t.bnplPlanId) linkedCountByPlan.set(t.bnplPlanId, (linkedCountByPlan.get(t.bnplPlanId) ?? 0) + 1);
  const usedTxnIds = new Set<string>(); // don't link one txn to two plans in a run

  type Link = { txnId: string; planId: string; item: string; month: string };
  const links: Link[] = [];
  const ambiguous: string[] = [];
  const shortfalls: string[] = [];

  for (const d of derived) {
    const existing = planByItem.get(norm(d.item));
    const planId = existing ? existing.id : insertIds.get(d)!;
    const already = existing ? (linkedCountByPlan.get(planId) ?? 0) : 0;
    const monthsAlreadyLinked = new Set(
      txnRows.filter((t) => t.bnplPlanId === planId).map((t) => monthKey(t.date)),
    );
    let linkedThis = already;
    for (const month of d.expectedMonths) {
      if (linkedThis >= d.paid) break;
      if (monthsAlreadyLinked.has(month)) continue;
      // Candidate unlinked Expense txns in this month matching the instalment (±1c).
      const cands = txnRows.filter(
        (t) =>
          !t.bnplPlanId &&
          !usedTxnIds.has(t.id) &&
          monthKey(t.date) === month &&
          Math.abs(t.amountCents - d.instalmentCents) <= 1,
      );
      // Prefer same-category candidates when several amounts collide.
      const sameCat = cands.filter((t) => t.categoryId === d.categoryId);
      const pool = sameCat.length ? sameCat : cands;
      if (pool.length === 1) {
        usedTxnIds.add(pool[0].id);
        links.push({ txnId: pool[0].id, planId, item: d.item, month });
        linkedThis++;
      } else if (pool.length > 1) {
        ambiguous.push(`${d.item} @ ${month}: ${pool.length} candidates — skipped`);
      }
    }
    if (linkedThis < d.paid) {
      shortfalls.push(
        `${d.item}: tracker paid ${d.paid}, linkable ${linkedThis}` +
          (d.expectedMonths.length ? "" : " (paid-off, no due month → cannot auto-link)"),
      );
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`\nBNPL sync · ${us.email} · ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`tracker rows ${TRACKER.length} · db plans ${planRows.length}\n`);

  console.log(`Inserts (${inserts.length}):`);
  for (const d of inserts)
    console.log(`  + ${d.item}  ${d.platform ?? "—"}  ${d.nInstalments}×  first ${d.firstDueMonth ?? "∅"}`);

  console.log(`\nUpdates (${updates.length}):`);
  for (const u of updates) console.log(`  ~ ${u.d.item}: ${u.diffs.join(", ")}`);

  console.log(`\nAuto-links (${links.length}):`);
  for (const l of links) console.log(`  ↔ ${l.item} @ ${l.month}`);

  if (ambiguous.length) {
    console.log(`\nAmbiguous (not linked — resolve by hand):`);
    for (const a of ambiguous) console.log(`  ? ${a}`);
  }
  if (shortfalls.length) {
    console.log(`\nShortfalls (will show as not-fully-paid until back-linked):`);
    for (const s of shortfalls) console.log(`  ! ${s}`);
  }
  if (dbOnly.length) {
    console.log(`\nIn DB but not in tracker (left untouched):`);
    for (const p of dbOnly) console.log(`  · ${p.item}`);
  }

  const total = inserts.length + updates.length + links.length;
  if (!apply) {
    console.log(`\n${total} change(s) pending. Re-run with --apply to write.`);
    return;
  }
  if (total === 0) {
    console.log(`\n✓ No changes — already in sync.`);
    return;
  }

  // ── Apply ───────────────────────────────────────────────────────────────
  for (const d of inserts) {
    await db.insert(bnplPlans).values({
      id: insertIds.get(d)!,
      userId,
      status: "auto",
      item: d.item,
      platform: d.platform,
      categoryId: d.categoryId,
      totalAmountCents: d.totalAmountCents,
      nInstalments: d.nInstalments,
      instalmentCents: d.instalmentCents,
      firstDueMonth: d.firstDueMonth,
    });
  }
  for (const u of updates) {
    const set: Record<string, unknown> = {
      platform: u.d.platform,
      categoryId: u.d.categoryId,
      totalAmountCents: u.d.totalAmountCents,
      nInstalments: u.d.nInstalments,
      instalmentCents: u.d.instalmentCents,
    };
    if (u.d.firstDueMonth) set.firstDueMonth = u.d.firstDueMonth;
    await db.update(bnplPlans).set(set).where(and(eq(bnplPlans.id, u.id), eq(bnplPlans.userId, userId)));
  }
  for (const l of links) {
    await db
      .update(transactions)
      .set({ bnplPlanId: l.planId })
      .where(and(eq(transactions.id, l.txnId), eq(transactions.userId, userId), isNull(transactions.bnplPlanId)));
  }
  console.log(`\n✓ Applied ${inserts.length} insert(s), ${updates.length} update(s), ${links.length} link(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
