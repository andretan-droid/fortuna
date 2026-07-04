/**
 * scripts/import-bnpl-txns.ts — import the real BNPL instalment rows from Andre's
 * pasted 2026 ledger (Mar–Jun) and link each to its plan, so plan progress
 * (paid = count of linked Expense txns) reflects reality.
 *
 *   npx tsx scripts/import-bnpl-txns.ts            # DRY RUN — prints the plan, writes nothing
 *   npx tsx scripts/import-bnpl-txns.ts --apply    # link existing / insert missing, then link
 *
 * Idempotent. Per instalment line, in order of preference:
 *   1. already linked to this plan on this date  → skip
 *   2. an existing unlinked Expense txn matches (same date + amount) → LINK it (no insert)
 *   3. nothing matches → INSERT the row (stable legacyId) then link it
 * Never touches non-BNPL rows. Never deletes. A stable legacyId + the "already
 * linked" check make a second --apply a no-op.
 *
 * Run with DATABASE_URL exported first (secrets live in Windows user env):
 *   $env:DATABASE_URL = [System.Environment]::GetEnvironmentVariable("DATABASE_URL","User")
 */
import { readFileSync } from "node:fs";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bnplPlans, categories, paymentMethods, transactions, users } from "@/db/schema";
import { toCents } from "@/lib/money";

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

/* ── BNPL instalment lines extracted from the pasted ledger (Mar–Jun 2026). ────
 * plan  = matches a bnpl_plans.item exactly (strip the "(x/y)" suffix)
 * desc  = verbatim ledger description stored on the inserted txn
 * cat   = the category Andre actually filed it under in the ledger
 * pm    = payment method name as it appears in the ledger                        */
type Line = { plan: string; desc: string; date: string; amount: string; cat: string; pm: string };
const LINES: Line[] = [
  // 2026-01 / -02 — Kapten Batik early instalments (Andre supplied 2026-07-04)
  { plan: "Kapten Batik", desc: "Kapten Batik 1/3", date: "2026-01-17", amount: "86.37", cat: "Shopping", pm: "Atome" },
  { plan: "Kapten Batik", desc: "Kapten Batik 2/3", date: "2026-02-03", amount: "86.37", cat: "Shopping", pm: "Atome" },
  // 2026-03-08
  { plan: "Key Rack Holder", desc: "Key Rack Holder (1/1)", date: "2026-03-08", amount: "19.07", cat: "Home", pm: "Shopee Pay" },
  { plan: "Stanley Boot", desc: "Stanley Boot (1/1)", date: "2026-03-08", amount: "9.79", cat: "Shopping", pm: "Shopee Pay" },
  { plan: "Metal Desk Organizer", desc: "Metal Desk Organizer (1/1)", date: "2026-03-08", amount: "37.26", cat: "Rental / Utilities", pm: "Shopee Pay" },
  { plan: "Airpods Headphone Case", desc: "Airpods Headphone Case (1/3)", date: "2026-03-08", amount: "5.55", cat: "Shopping", pm: "Shopee Pay" },
  { plan: "Cute Card Holder", desc: "Cute Card Holder (1/3)", date: "2026-03-08", amount: "1.70", cat: "Home", pm: "Shopee Pay" },
  { plan: "RFID Tag", desc: "RFID Tag (1/3)", date: "2026-03-08", amount: "6.53", cat: "Home", pm: "Shopee Pay" },
  { plan: "INHO Dustbin", desc: "INHO Dustbin (1/3)", date: "2026-03-08", amount: "13.76", cat: "Home", pm: "Shopee Pay" },
  { plan: "Bloomthis", desc: "Bloomthis (1/4)", date: "2026-03-08", amount: "43.50", cat: "Gifts", pm: "Grab" },
  { plan: "Kapten Batik", desc: "Kapten Batik (3/3)", date: "2026-03-08", amount: "86.37", cat: "Shopping", pm: "Atome" },
  // 2026-04-03
  { plan: "Airpods Headphone Case", desc: "Airpods Headphone Case (2/3)", date: "2026-04-03", amount: "5.55", cat: "Shopping", pm: "Shopee Pay" },
  { plan: "Cute Card Holder", desc: "Cute Card Holder (2/3)", date: "2026-04-03", amount: "1.70", cat: "Home", pm: "Shopee Pay" },
  { plan: "RFID Tag", desc: "RFID Tag (2/3)", date: "2026-04-03", amount: "6.53", cat: "Home", pm: "Shopee Pay" },
  { plan: "INHO Dustbin", desc: "INHO Dustbin (2/3)", date: "2026-04-03", amount: "13.76", cat: "Home", pm: "Shopee Pay" },
  { plan: "Razer Blackshark V3 Pro", desc: "Razer Blackshark V3 Pro (1/3)", date: "2026-04-03", amount: "324.14", cat: "Gifts", pm: "Shopee Pay" },
  { plan: "Bloomthis", desc: "Bloomthis (2/4)", date: "2026-04-03", amount: "43.50", cat: "Gifts", pm: "Grab" },
  // 2026-05-04 / -06 / -24
  { plan: "Airpods Headphone Case", desc: "Airpods Headphone Case (3/3)", date: "2026-05-04", amount: "5.55", cat: "Shopping", pm: "Shopee Pay" },
  { plan: "Cute Card Holder", desc: "Cute Card Holder (3/3)", date: "2026-05-04", amount: "1.70", cat: "Home", pm: "Shopee Pay" },
  { plan: "RFID Tag", desc: "RFID Tag (3/3)", date: "2026-05-04", amount: "6.53", cat: "Home", pm: "Shopee Pay" },
  { plan: "INHO Dustbin", desc: "INHO Dustbin (3/3)", date: "2026-05-04", amount: "13.76", cat: "Home", pm: "Shopee Pay" },
  { plan: "Razer Blackshark V3 Pro", desc: "Razer Blackshark V3 Pro (2/3)", date: "2026-05-04", amount: "324.14", cat: "Gifts", pm: "Shopee Pay" },
  { plan: "Bloomthis", desc: "Bloomthis (3/4)", date: "2026-05-04", amount: "43.50", cat: "Gifts", pm: "Grab" },
  { plan: "Steam Games", desc: "Steam Games", date: "2026-05-04", amount: "86.40", cat: "Entertainment", pm: "Shopee Pay" },
  { plan: "YoloFoods", desc: "YoloFoods", date: "2026-05-06", amount: "69.36", cat: "Dinner", pm: "Atome" },
  { plan: "Puras", desc: "Puras Atome", date: "2026-05-24", amount: "24.50", cat: "Grooming", pm: "Atome" },
  // 2026-06-02 / -05 / -14
  { plan: "Razer Blackshark V3 Pro", desc: "Razer Blackshark V3 Pro (3/3)", date: "2026-06-02", amount: "324.14", cat: "Gifts", pm: "Shopee Pay" },
  { plan: "Bloomthis", desc: "Bloomthis (4/4)", date: "2026-06-02", amount: "43.50", cat: "Gifts", pm: "Grab" },
  { plan: "MHW-3 Bomber Coffee Server", desc: "MHW-3 Bomber Coffee Server (1/3)", date: "2026-06-02", amount: "31.95", cat: "Coffee", pm: "Shopee Pay" },
  { plan: "Cafec Paper", desc: "Cafec Paper", date: "2026-06-02", amount: "9.63", cat: "Coffee", pm: "Shopee Pay" },
  { plan: "Origami Cup", desc: "Origami Cup", date: "2026-06-02", amount: "17.48", cat: "Coffee", pm: "Shopee Pay" },
  { plan: "6L Kettle", desc: "6L Kettle", date: "2026-06-02", amount: "9.44", cat: "Home", pm: "Shopee Pay" },
  { plan: "Third Wave Water", desc: "Third Wave Water", date: "2026-06-02", amount: "27.03", cat: "Coffee", pm: "Shopee Pay" },
  { plan: "Spigen Case + Screen Protector", desc: "Spigen Case + Screen Protector", date: "2026-06-02", amount: "51.63", cat: "Phone", pm: "Shopee Pay" },
  { plan: "YoloFoods", desc: "YoloFoods", date: "2026-06-05", amount: "69.36", cat: "Dinner", pm: "Atome" },
  { plan: "Tekisu Cat Paw Lamp", desc: "Tekisu Cat Paw Lamp", date: "2026-06-14", amount: "47.28", cat: "Shopping", pm: "Shopee Pay" },
  { plan: "Yoasobi XL shirt", desc: "Yoasobi XL shirt", date: "2026-06-14", amount: "113.62", cat: "Shopping", pm: "Shopee Pay" },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const cents = (s: string) => {
  const c = toCents(s);
  if (c == null) throw new Error(`Bad money string: "${s}"`);
  return c;
};

async function main() {
  loadEnv();
  const apply = process.argv.includes("--apply");
  const db = getDb();

  const [us] = await db.select({ id: users.id, email: users.email }).from(users);
  if (!us) throw new Error("No users — sign in once first.");
  const userId = us.id;

  const [catRows, pmRows, planRows, txnRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.userId, userId)),
    db.select({ id: paymentMethods.id, name: paymentMethods.name }).from(paymentMethods).where(eq(paymentMethods.userId, userId)),
    db.select({ id: bnplPlans.id, item: bnplPlans.item }).from(bnplPlans).where(eq(bnplPlans.userId, userId)),
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        amountCents: transactions.amountCents,
        description: transactions.description,
        bnplPlanId: transactions.bnplPlanId,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "Expense"), eq(transactions.deleted, false)))
      .orderBy(asc(transactions.date)),
  ]);

  const catByName = new Map(catRows.map((c) => [norm(c.name), c.id]));
  const pmByName = new Map(pmRows.map((p) => [norm(p.name), p.id]));
  const planByItem = new Map(planRows.map((p) => [norm(p.item), p.id]));

  // Hard-stop on any unresolved name — never guess.
  const missing = { cat: new Set<string>(), pm: new Set<string>(), plan: new Set<string>() };
  for (const l of LINES) {
    if (!catByName.has(norm(l.cat))) missing.cat.add(l.cat);
    if (!pmByName.has(norm(l.pm))) missing.pm.add(l.pm);
    if (!planByItem.has(norm(l.plan))) missing.plan.add(l.plan);
  }
  if (missing.cat.size || missing.pm.size || missing.plan.size) {
    if (missing.plan.size) console.error("✗ Unknown plans (run sync-bnpl --apply first):", [...missing.plan]);
    if (missing.cat.size) console.error("✗ Unknown categories:", [...missing.cat]);
    if (missing.pm.size) console.error("✗ Unknown payment methods (add in Settings):", [...missing.pm]);
    process.exit(2);
  }

  const usedTxnIds = new Set<string>(); // don't reuse one existing row for two lines

  type Act = { line: Line; planId: string; kind: "skip" | "link" | "insert"; txnId?: string; note: string };
  const acts: Act[] = [];
  const ambiguous: string[] = [];

  for (const l of LINES) {
    const planId = planByItem.get(norm(l.plan))!;
    const amt = cents(l.amount);

    // 1. Already linked to this plan on this date?
    const already = txnRows.find((t) => t.bnplPlanId === planId && t.date === l.date && t.amountCents === amt);
    if (already) {
      acts.push({ line: l, planId, kind: "skip", txnId: already.id, note: "already linked" });
      continue;
    }

    // 2. An existing unlinked Expense row on the same date + amount → link it.
    const cands = txnRows.filter(
      (t) => !t.bnplPlanId && !usedTxnIds.has(t.id) && t.date === l.date && t.amountCents === amt,
    );
    // Prefer a description that carries the item name when several amounts collide.
    const byDesc = cands.filter((t) => norm(t.description ?? "").includes(norm(l.plan)));
    const pool = byDesc.length ? byDesc : cands;
    if (pool.length === 1) {
      usedTxnIds.add(pool[0].id);
      acts.push({ line: l, planId, kind: "link", txnId: pool[0].id, note: "link existing ledger row" });
      continue;
    }
    if (pool.length > 1) {
      ambiguous.push(`${l.desc} @ ${l.date} RM${l.amount}: ${pool.length} existing rows — insert new instead`);
    }
    // 3. Nothing to link → insert a fresh row.
    acts.push({ line: l, planId, kind: "insert", note: "insert new row" });
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const links = acts.filter((a) => a.kind === "link");
  const inserts = acts.filter((a) => a.kind === "insert");
  const skips = acts.filter((a) => a.kind === "skip");

  console.log(`\nBNPL txn import · ${us.email} · ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`lines ${LINES.length} · ledger Expense rows ${txnRows.length}\n`);

  console.log(`Link existing (${links.length}):`);
  for (const a of links) console.log(`  ↔ ${a.line.desc} @ ${a.line.date}  RM${a.line.amount}`);
  console.log(`\nInsert new (${inserts.length}):`);
  for (const a of inserts) console.log(`  + ${a.line.desc} @ ${a.line.date}  RM${a.line.amount}  [${a.line.cat} · ${a.line.pm}]`);
  console.log(`\nSkip — already linked (${skips.length}):`);
  for (const a of skips) console.log(`  = ${a.line.desc} @ ${a.line.date}`);
  if (ambiguous.length) {
    console.log(`\nNote — multiple existing rows share this date+amount, inserting a distinct row:`);
    for (const s of ambiguous) console.log(`  ? ${s}`);
  }

  // Per-plan projected paid count after this import.
  const linkedNow = new Map<string, number>();
  for (const t of txnRows) if (t.bnplPlanId) linkedNow.set(t.bnplPlanId, (linkedNow.get(t.bnplPlanId) ?? 0) + 1);
  const gain = new Map<string, number>();
  for (const a of acts) if (a.kind !== "skip") gain.set(a.planId, (gain.get(a.planId) ?? 0) + 1);
  const planName = new Map(planRows.map((p) => [p.id, p.item]));
  console.log(`\nProjected linked-instalment count per plan touched:`);
  for (const [pid, g] of [...gain].sort()) {
    const before = linkedNow.get(pid) ?? 0;
    console.log(`  · ${planName.get(pid)}: ${before} → ${before + g}`);
  }

  const total = links.length + inserts.length;
  if (!apply) {
    console.log(`\n${total} write(s) pending (${links.length} link, ${inserts.length} insert). Re-run with --apply to write.`);
    return;
  }
  if (total === 0) {
    console.log(`\n✓ No changes — every instalment already linked.`);
    return;
  }

  // ── Apply ───────────────────────────────────────────────────────────────
  for (const a of links) {
    await db
      .update(transactions)
      .set({ bnplPlanId: a.planId })
      .where(and(eq(transactions.id, a.txnId!), eq(transactions.userId, userId), isNull(transactions.bnplPlanId)));
  }
  for (const a of inserts) {
    await db.insert(transactions).values({
      userId,
      legacyId: `bnpl-instal:${norm(a.line.plan).replace(/\s+/g, "-")}:${a.line.date}:${a.line.amount}`,
      date: a.line.date,
      amountCents: cents(a.line.amount),
      description: a.line.desc,
      categoryId: catByName.get(norm(a.line.cat))!,
      paymentMethodId: pmByName.get(norm(a.line.pm))!,
      type: "Expense",
      bnplPlanId: a.planId,
      deleted: false,
    });
  }
  console.log(`\n✓ Applied ${links.length} link(s), ${inserts.length} insert(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
