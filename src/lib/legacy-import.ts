/**
 * lib/legacy-import.ts — the shared migration core.
 *
 * One canonical intermediate shape (LegacyBundle) that BOTH the seed CLI
 * (scripts/seed-legacy, P8.2) and the in-app import wizard (P11.2) feed. The
 * sheet-format detection (v4 vs Ledger, P8.3) lives UPSTREAM in the caller; by
 * the time a bundle reaches here it is already cents-normalised and references
 * entities by NAME, never uuid.
 *
 * Pipeline:  validate (zod) → normalize (invariants + name→uuid graph) →
 * db.batch (FK-safe order, one implicit txn on neon-http) → reconcile (read
 * back, compare counts + cent-sums against the source bundle).
 *
 * NOT a route/action: the caller supplies an already-authenticated userId
 * (seed resolves it; the wizard action calls requireUserId first). Client input
 * never dictates user scoping — the userId arg is always trusted.
 */
import { z } from "zod";
import { eq, sql, type AnyColumn } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { BatchItem } from "drizzle-orm/batch";
import * as schema from "@/db/schema";

type Db = NeonHttpDatabase<typeof schema>;

/* ── The contract ──────────────────────────────────────────────────────────
   Every collection is optional and defaults to empty, so a partial sheet (only
   a ledger tab, say) still validates. References are by name; `type`/`framework`
   invariants are DERIVED in normalize, not trusted from the source. */

const centsInt = z.number().int(); // balances may be negative
const centsNonNeg = z.number().int().nonnegative(); // amounts, budgets, targets
const monthRe = /^\d{4}-\d{2}$/;
const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;

const TxnType = z.enum(["Income", "Expense", "Deduction", "Transfer"]);
const Framework = z.enum([
  "Needs",
  "Wants",
  "Savings",
  "Income",
  "Deduction",
  "Transfer",
]);
const name = z.string().trim().min(1).max(200);

const bundleSchema = z.object({
  categories: z
    .array(
      z.object({
        name,
        mainCategory: z.string().trim().max(200).nullish(),
        type: TxnType,
        // Optional: derived from type in normalize (Expense splits into
        // Needs/Wants/Savings; every other type mirrors itself).
        framework: Framework.optional(),
        monthlyBudgetCents: centsNonNeg.default(0),
        active: z.boolean().default(true),
      }),
    )
    .default([]),
  paymentMethods: z
    .array(z.object({ name, active: z.boolean().default(true) }))
    .default([]),
  accounts: z
    .array(
      z.object({
        name,
        kind: z.enum(["Asset", "Liability"]),
        sort: z.number().int().default(0),
        active: z.boolean().default(true),
      }),
    )
    .default([]),
  transactions: z
    .array(
      z.object({
        legacyId: z.string().trim().max(200).nullish(),
        date: z.string().regex(isoDateRe, "date must be YYYY-MM-DD"),
        amountCents: centsNonNeg,
        description: z.string().trim().max(500).nullish(),
        category: name, // → resolved to categoryId
        paymentMethod: z.string().trim().max(200).nullish(), // → paymentMethodId
        // type is derived from the referenced category unless explicitly given
        type: TxnType.optional(),
      }),
    )
    .default([]),
  netWorthEntries: z
    .array(
      z.object({
        month: z.string().regex(monthRe, "month must be YYYY-MM"),
        account: name, // → accountId
        balanceCents: centsInt,
      }),
    )
    .default([]),
  sinkingFunds: z
    .array(
      z.object({
        name,
        annualTargetCents: centsNonNeg.nullish(),
        monthlyAccrualCents: centsNonNeg.nullish(),
        matchCategory: z.string().trim().max(200).nullish(), // → matchCategoryId
        openingBalanceCents: centsInt.default(0),
        active: z.boolean().default(true),
      }),
    )
    .default([]),
  recurringRules: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(200),
        category: name, // → categoryId
        expectedCents: centsNonNeg.nullish(),
        paymentMethod: z.string().trim().max(200).nullish(),
        day: z.number().int().min(1).max(31).nullish(),
        tolerance: z.number().min(0).max(1).nullish(), // fraction, e.g. 0.05
        active: z.boolean().default(true),
      }),
    )
    .default([]),
  // ── Portfolio (P8.3): numerics are numbers here, stringified for the
  //    numeric() columns in buildGraph. bnpl references a category by name. ──
  holdings: z
    .array(
      z.object({
        ticker: z.string().trim().min(1).max(50),
        name: z.string().trim().max(200).nullish(),
        exchange: z.string().trim().max(50).nullish(),
        shares: z.number().nullish(),
        avgCostLocal: z.number().nullish(),
        ccy: z.string().trim().max(10).nullish(),
        priceLive: z.number().nullish(),
        dayChgPct: z.number().nullish(),
        manualPriceOverride: z.number().nullish(),
      }),
    )
    .default([]),
  fxRates: z
    .array(
      z.object({
        pair: z.string().trim().min(1).max(20),
        rateLive: z.number().nullish(),
        fallback: z.number().nullish(),
      }),
    )
    .default([]),
  snapshots: z
    .array(
      z.object({
        month: z.string().regex(monthRe, "month must be YYYY-MM"),
        portfolioValueCents: centsInt.nullish(),
        usdMyrAtSnap: z.number().nullish(),
        notes: z.string().trim().max(500).nullish(),
      }),
    )
    .default([]),
  bnplPlans: z
    .array(
      z.object({
        legacyId: z.string().trim().max(200).nullish(),
        item: z.string().trim().min(1).max(300),
        platform: z.string().trim().max(100).nullish(),
        category: name, // → resolved to categoryId (RESTRICT)
        totalAmountCents: centsNonNeg,
        nInstalments: z.number().int().min(1),
        instalmentCents: centsNonNeg,
        firstDueMonth: z.string().regex(monthRe).nullish(),
        status: z.string().trim().max(50).default("auto"),
        notes: z.string().trim().max(500).nullish(),
      }),
    )
    .default([]),
  settings: z
    .object({
      currency: z.string().trim().min(1).max(8).default("RM"),
      grossSalaryCents: centsNonNeg.nullish(),
      statutoryCents: centsNonNeg.nullish(),
      netSalaryCents: centsNonNeg.nullish(),
      targetSavingsRate: z.number().min(0).max(1).nullish(),
      fxUsdFallback: z.number().positive().nullish(),
      defaultPaymentMethod: z.string().trim().max(200).nullish(),
    })
    .nullish(),
});

export type LegacyBundle = z.input<typeof bundleSchema>;

export type ReconRow = {
  table: string;
  sourceCount: number;
  writtenCount: number;
  sourceSumCents: number; // 0 for tables with no natural money column
  writtenSumCents: number;
  match: boolean;
};

export type ImportResult =
  | { ok: true; counts: Record<string, number>; reconciliation: ReconRow[] }
  | { ok: false; errors: string[] };

/* Portfolio tables (holdings/fx_rates/snapshots/bnpl_plans) are now in scope
   (P8.3): the v5 export ships dedicated Holdings/FX/Snapshots/BNPL_Plans tabs.
   Numerics (shares/prices/rates) are numeric() columns → stringified below;
   money (bnpl totals, snapshot value) stays integer cents. */

/** Derive the framework invariant: only Expense splits; all else mirrors type. */
function frameworkFor(
  type: z.infer<typeof TxnType>,
  given: z.infer<typeof Framework> | undefined,
): z.infer<typeof Framework> {
  if (type !== "Expense") return type; // Income/Deduction/Transfer mirror
  // Expense → must be a spend bucket; default Needs if missing/invalid.
  return given === "Needs" || given === "Wants" || given === "Savings"
    ? given
    : "Needs"; // ponytail: Needs is the safe default; wizard lets user re-bucket
}

/** Pure: bundle + userId → row arrays with minted uuids and resolved FKs, or a
 *  list of dangling-reference errors. No DB access — unit-testable in isolation. */
export function buildGraph(userId: string, bundle: LegacyBundle) {
  const b = bundleSchema.parse(bundle);
  const errors: string[] = [];

  // Parents get uuids first; name→id maps drive every child reference.
  const catId = new Map<string, string>();
  const pmId = new Map<string, string>();
  const acctId = new Map<string, string>();

  const categoryRows = b.categories.map((c) => {
    const id = crypto.randomUUID();
    catId.set(c.name, id);
    return {
      id,
      userId,
      name: c.name,
      mainCategory: c.mainCategory ?? null,
      type: c.type,
      framework: frameworkFor(c.type, c.framework),
      monthlyBudgetCents: c.monthlyBudgetCents,
      active: c.active,
    };
  });

  const paymentMethodRows = b.paymentMethods.map((p) => {
    const id = crypto.randomUUID();
    pmId.set(p.name, id);
    return { id, userId, name: p.name, active: p.active };
  });

  const accountRows = b.accounts.map((a) => {
    const id = crypto.randomUUID();
    acctId.set(a.name, id);
    return { id, userId, name: a.name, kind: a.kind, sort: a.sort, active: a.active };
  });

  // Reference resolvers collect (never throw) so every dangling name surfaces.
  const cat = (n: string, ctx: string) => {
    const id = catId.get(n);
    if (!id) errors.push(`${ctx}: unknown category "${n}"`);
    return id;
  };
  const pm = (n: string | null | undefined, ctx: string) => {
    if (!n) return null;
    const id = pmId.get(n);
    if (!id) errors.push(`${ctx}: unknown payment method "${n}"`);
    return id ?? null;
  };
  const acct = (n: string, ctx: string) => {
    const id = acctId.get(n);
    if (!id) errors.push(`${ctx}: unknown account "${n}"`);
    return id;
  };

  const txnTypeByCat = new Map(categoryRows.map((c) => [c.name, c.type]));
  const transactionRows = b.transactions.map((t, i) => ({
    id: crypto.randomUUID(),
    userId,
    legacyId: t.legacyId ?? null,
    date: t.date,
    amountCents: t.amountCents,
    description: t.description ?? null,
    categoryId: cat(t.category, `transaction[${i}]`),
    paymentMethodId: pm(t.paymentMethod, `transaction[${i}]`),
    // Trust the category's type (the sheet's ⚡ formula), not a stray bundle value.
    type: txnTypeByCat.get(t.category) ?? t.type ?? "Expense",
    deleted: false,
  }));

  const netWorthRows = b.netWorthEntries.map((n, i) => ({
    id: crypto.randomUUID(),
    userId,
    month: n.month,
    accountId: acct(n.account, `netWorthEntry[${i}]`),
    balanceCents: n.balanceCents,
  }));

  const sinkingRows = b.sinkingFunds.map((s) => ({
    id: crypto.randomUUID(),
    userId,
    name: s.name,
    annualTargetCents: s.annualTargetCents ?? null,
    monthlyAccrualCents: s.monthlyAccrualCents ?? null,
    matchCategoryId: s.matchCategory
      ? cat(s.matchCategory, `sinkingFund "${s.name}"`) ?? null
      : null,
    openingBalanceCents: s.openingBalanceCents,
    active: s.active,
  }));

  const recurringRows = b.recurringRules.map((r) => ({
    id: crypto.randomUUID(),
    userId,
    description: r.description,
    categoryId: cat(r.category, `recurringRule "${r.description}"`),
    expectedCents: r.expectedCents ?? null,
    paymentMethodId: pm(r.paymentMethod, `recurringRule "${r.description}"`),
    day: r.day ?? null,
    tolerance: r.tolerance?.toString() ?? null,
    active: r.active,
  }));

  // Portfolio rows. numeric() columns take strings; bnpl resolves its category.
  const holdingRows = b.holdings.map((h) => ({
    id: crypto.randomUUID(),
    userId,
    ticker: h.ticker,
    name: h.name ?? null,
    exchange: h.exchange ?? null,
    shares: h.shares?.toString() ?? null,
    avgCostLocal: h.avgCostLocal?.toString() ?? null,
    ccy: h.ccy ?? null,
    priceLive: h.priceLive?.toString() ?? null,
    dayChgPct: h.dayChgPct?.toString() ?? null,
    manualPriceOverride: h.manualPriceOverride?.toString() ?? null,
  }));

  const fxRateRows = b.fxRates.map((f) => ({
    id: crypto.randomUUID(),
    userId,
    pair: f.pair,
    rateLive: f.rateLive?.toString() ?? null,
    fallback: f.fallback?.toString() ?? null,
  }));

  const snapshotRows = b.snapshots.map((sn) => ({
    id: crypto.randomUUID(),
    userId,
    month: sn.month,
    portfolioValueCents: sn.portfolioValueCents ?? null,
    usdMyrAtSnap: sn.usdMyrAtSnap?.toString() ?? null,
    notes: sn.notes ?? null,
  }));

  const bnplRows = b.bnplPlans.map((p) => ({
    id: crypto.randomUUID(),
    userId,
    legacyId: p.legacyId ?? null,
    item: p.item,
    platform: p.platform ?? null,
    categoryId: cat(p.category, `bnplPlan "${p.item}"`),
    totalAmountCents: p.totalAmountCents,
    nInstalments: p.nInstalments,
    instalmentCents: p.instalmentCents,
    firstDueMonth: p.firstDueMonth ?? null,
    status: p.status,
    notes: p.notes ?? null,
  }));

  const settingsRow = b.settings
    ? {
        userId,
        currency: b.settings.currency,
        grossSalaryCents: b.settings.grossSalaryCents ?? null,
        statutoryCents: b.settings.statutoryCents ?? null,
        netSalaryCents: b.settings.netSalaryCents ?? null,
        targetSavingsRate: b.settings.targetSavingsRate?.toString() ?? null,
        fxUsdFallback: b.settings.fxUsdFallback?.toString() ?? null,
        defaultPaymentMethodId: b.settings.defaultPaymentMethod
          ? pm(b.settings.defaultPaymentMethod, "settings.defaultPaymentMethod")
          : null,
      }
    : null;

  return {
    errors,
    rows: {
      categoryRows,
      paymentMethodRows,
      accountRows,
      transactionRows: transactionRows as (Omit<
        (typeof transactionRows)[number],
        "categoryId"
      > & { categoryId: string })[],
      netWorthRows: netWorthRows as (Omit<
        (typeof netWorthRows)[number],
        "accountId"
      > & { accountId: string })[],
      sinkingRows,
      recurringRows: recurringRows as (Omit<
        (typeof recurringRows)[number],
        "categoryId"
      > & { categoryId: string })[],
      holdingRows,
      fxRateRows,
      snapshotRows,
      bnplRows: bnplRows as (Omit<
        (typeof bnplRows)[number],
        "categoryId"
      > & { categoryId: string })[],
      settingsRow,
    },
  };
}

/** PG bind-parameter ceiling is 65535; chunk multi-row inserts well under it.
 *  ponytail: fixed 500-row chunks — raise only if a huge sheet is slow. */
function chunk<T>(arr: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** FK-safe delete of all domain rows for this user (children before parents).
 *  Mirrors wipeAllData in actions/settings — kept local so the core has no
 *  dependency on a "use server" module. ponytail: two copies, one list. */
function wipeStatements(db: Db, userId: string): BatchItem<"pg">[] {
  const s = schema;
  return [
    db.delete(s.transactions).where(eq(s.transactions.userId, userId)),
    db.delete(s.netWorthEntries).where(eq(s.netWorthEntries.userId, userId)),
    db.delete(s.recurringRules).where(eq(s.recurringRules.userId, userId)),
    db.delete(s.sinkingFunds).where(eq(s.sinkingFunds.userId, userId)),
    db.delete(s.bnplPlans).where(eq(s.bnplPlans.userId, userId)),
    db.delete(s.holdings).where(eq(s.holdings.userId, userId)),
    db.delete(s.fxRates).where(eq(s.fxRates.userId, userId)),
    db.delete(s.snapshots).where(eq(s.snapshots.userId, userId)),
    db.delete(s.userSettings).where(eq(s.userSettings.userId, userId)),
    db.delete(s.accounts).where(eq(s.accounts.userId, userId)),
    db.delete(s.categories).where(eq(s.categories.userId, userId)),
    db.delete(s.paymentMethods).where(eq(s.paymentMethods.userId, userId)),
  ];
}

/** Read back counts + cent-sums and compare to the source rows just built. */
async function reconcile(
  db: Db,
  userId: string,
  rows: ReturnType<typeof buildGraph>["rows"],
): Promise<ReconRow[]> {
  const countSum = async (
    table: PgTable,
    userCol: AnyColumn,
    sumCol: AnyColumn | null,
  ) => {
    const [r] = await db
      .select({
        c: sql<number>`count(*)::int`,
        s: sumCol
          ? sql<number>`coalesce(sum(${sumCol})::bigint, 0)`
          : sql<number>`0::bigint`,
      })
      .from(table)
      .where(eq(userCol, userId));
    return { count: Number(r.c), sum: Number(r.s) };
  };

  const sum = (arr: { [k: string]: unknown }[], key: string) =>
    arr.reduce((n, row) => n + (Number(row[key]) || 0), 0);

  const specs: {
    table: string;
    src: number;
    srcSum: number;
    read: () => Promise<{ count: number; sum: number }>;
  }[] = [
    {
      table: "categories",
      src: rows.categoryRows.length,
      srcSum: sum(rows.categoryRows, "monthlyBudgetCents"),
      read: () => countSum(schema.categories, schema.categories.userId, schema.categories.monthlyBudgetCents),
    },
    {
      table: "payment_methods",
      src: rows.paymentMethodRows.length,
      srcSum: 0,
      read: () => countSum(schema.paymentMethods, schema.paymentMethods.userId, null),
    },
    {
      table: "accounts",
      src: rows.accountRows.length,
      srcSum: 0,
      read: () => countSum(schema.accounts, schema.accounts.userId, null),
    },
    {
      table: "transactions",
      src: rows.transactionRows.length,
      srcSum: sum(rows.transactionRows, "amountCents"),
      read: () => countSum(schema.transactions, schema.transactions.userId, schema.transactions.amountCents),
    },
    {
      table: "net_worth_entries",
      src: rows.netWorthRows.length,
      srcSum: sum(rows.netWorthRows, "balanceCents"),
      read: () => countSum(schema.netWorthEntries, schema.netWorthEntries.userId, schema.netWorthEntries.balanceCents),
    },
    {
      table: "sinking_funds",
      src: rows.sinkingRows.length,
      srcSum: 0,
      read: () => countSum(schema.sinkingFunds, schema.sinkingFunds.userId, null),
    },
    {
      table: "recurring_rules",
      src: rows.recurringRows.length,
      srcSum: 0,
      read: () => countSum(schema.recurringRules, schema.recurringRules.userId, null),
    },
    {
      table: "bnpl_plans",
      src: rows.bnplRows.length,
      srcSum: sum(rows.bnplRows, "totalAmountCents"),
      read: () => countSum(schema.bnplPlans, schema.bnplPlans.userId, schema.bnplPlans.totalAmountCents),
    },
    {
      table: "holdings",
      src: rows.holdingRows.length,
      srcSum: 0,
      read: () => countSum(schema.holdings, schema.holdings.userId, null),
    },
    {
      table: "fx_rates",
      src: rows.fxRateRows.length,
      srcSum: 0,
      read: () => countSum(schema.fxRates, schema.fxRates.userId, null),
    },
    {
      table: "snapshots",
      src: rows.snapshotRows.length,
      srcSum: sum(rows.snapshotRows, "portfolioValueCents"),
      read: () => countSum(schema.snapshots, schema.snapshots.userId, schema.snapshots.portfolioValueCents),
    },
  ];

  const out: ReconRow[] = [];
  for (const spec of specs) {
    const got = await spec.read();
    out.push({
      table: spec.table,
      sourceCount: spec.src,
      writtenCount: got.count,
      sourceSumCents: spec.srcSum,
      writtenSumCents: got.sum,
      match: got.count === spec.src && got.sum === spec.srcSum,
    });
  }
  return out;
}

/** Validate → graph → (optional wipe) → batch insert → reconcile. Atomic on
 *  neon-http: the whole batch is one implicit transaction. */
export async function importLegacyBundle(
  db: Db,
  userId: string,
  bundle: LegacyBundle,
  opts: { wipeFirst?: boolean } = {},
): Promise<ImportResult> {
  let graph: ReturnType<typeof buildGraph>;
  try {
    graph = buildGraph(userId, bundle);
  } catch (err) {
    // zod validation failure
    if (err instanceof z.ZodError)
      return { ok: false, errors: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
    throw err;
  }
  if (graph.errors.length) return { ok: false, errors: graph.errors };

  const { rows } = graph;
  const stmts: BatchItem<"pg">[] = [];
  if (opts.wipeFirst) stmts.push(...wipeStatements(db, userId));

  // Parents before children (categories/pm/accounts) → txns/nwe/sinking/recurring.
  if (rows.categoryRows.length)
    for (const c of chunk(rows.categoryRows)) stmts.push(db.insert(schema.categories).values(c));
  if (rows.paymentMethodRows.length)
    for (const c of chunk(rows.paymentMethodRows)) stmts.push(db.insert(schema.paymentMethods).values(c));
  if (rows.accountRows.length)
    for (const c of chunk(rows.accountRows)) stmts.push(db.insert(schema.accounts).values(c));
  // bnpl_plans reference categories (RESTRICT) → after categories, before anything
  // that might reference a plan.
  if (rows.bnplRows.length)
    for (const c of chunk(rows.bnplRows)) stmts.push(db.insert(schema.bnplPlans).values(c));
  if (rows.transactionRows.length)
    for (const c of chunk(rows.transactionRows)) stmts.push(db.insert(schema.transactions).values(c));
  if (rows.netWorthRows.length)
    for (const c of chunk(rows.netWorthRows)) stmts.push(db.insert(schema.netWorthEntries).values(c));
  if (rows.sinkingRows.length)
    for (const c of chunk(rows.sinkingRows)) stmts.push(db.insert(schema.sinkingFunds).values(c));
  if (rows.recurringRows.length)
    for (const c of chunk(rows.recurringRows)) stmts.push(db.insert(schema.recurringRules).values(c));
  // Portfolio tables scope by user_id only (no intra-domain FK) → any order.
  if (rows.holdingRows.length)
    for (const c of chunk(rows.holdingRows)) stmts.push(db.insert(schema.holdings).values(c));
  if (rows.fxRateRows.length)
    for (const c of chunk(rows.fxRateRows)) stmts.push(db.insert(schema.fxRates).values(c));
  if (rows.snapshotRows.length)
    for (const c of chunk(rows.snapshotRows)) stmts.push(db.insert(schema.snapshots).values(c));
  if (rows.settingsRow)
    stmts.push(
      db
        .insert(schema.userSettings)
        .values(rows.settingsRow)
        .onConflictDoUpdate({ target: schema.userSettings.userId, set: rows.settingsRow }),
    );

  if (stmts.length)
    await db.batch(stmts as [BatchItem<"pg">, ...BatchItem<"pg">[]]);

  const reconciliation = await reconcile(db, userId, rows);
  const counts: Record<string, number> = {
    categories: rows.categoryRows.length,
    paymentMethods: rows.paymentMethodRows.length,
    accounts: rows.accountRows.length,
    transactions: rows.transactionRows.length,
    netWorthEntries: rows.netWorthRows.length,
    sinkingFunds: rows.sinkingRows.length,
    recurringRules: rows.recurringRows.length,
    bnplPlans: rows.bnplRows.length,
    holdings: rows.holdingRows.length,
    fxRates: rows.fxRateRows.length,
    snapshots: rows.snapshotRows.length,
  };

  const mismatched = reconciliation.filter((r) => !r.match);
  if (mismatched.length)
    return {
      ok: false,
      errors: mismatched.map(
        (r) =>
          `${r.table}: expected ${r.sourceCount} rows / ${r.sourceSumCents}c, got ${r.writtenCount} / ${r.writtenSumCents}c`,
      ),
    };

  return { ok: true, counts, reconciliation };
}

/* ── Self-check (pure graph logic; no DB) ────────────────────────────────────
   Run via the app's resolver: `npx tsx -r tsconfig-paths/register src/lib/legacy-import.ts`
   or call selfCheck() from the seed script. Guards on argv so importing this
   module never triggers it. */
export function selfCheck() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`selfCheck: ${msg}`);
  };

  // framework derivation
  assert(frameworkFor("Income", undefined) === "Income", "Income mirrors");
  assert(frameworkFor("Expense", undefined) === "Needs", "Expense defaults Needs");
  assert(frameworkFor("Expense", "Wants") === "Wants", "Expense keeps Wants");
  assert(frameworkFor("Transfer", "Needs") === "Transfer", "Transfer mirrors, ignores given");

  // graph resolves refs + derives txn type from its category
  const g = buildGraph("u1", {
    categories: [{ name: "Dinner", type: "Expense", framework: "Needs" }],
    transactions: [
      { date: "2026-07-01", amountCents: 2500, category: "Dinner" },
      { date: "2026-07-02", amountCents: 1000, category: "Ghost" }, // dangling
    ],
  });
  assert(g.errors.length === 1 && g.errors[0].includes("Ghost"), "dangling ref caught");
  assert(g.rows.transactionRows[0].type === "Expense", "txn type derived from category");
  assert(g.rows.categoryRows[0].id === g.rows.transactionRows[0].categoryId, "FK wired");

  // portfolio: bnpl resolves its category; numeric() fields stringify.
  const g2 = buildGraph("u1", {
    categories: [{ name: "Shopping", type: "Expense", framework: "Wants" }],
    bnplPlans: [
      { item: "Gadget", category: "Shopping", totalAmountCents: 30000, nInstalments: 3, instalmentCents: 10000 },
      { item: "Ghost", category: "Nope", totalAmountCents: 100, nInstalments: 1, instalmentCents: 100 }, // dangling
    ],
    holdings: [{ ticker: "NVDA", shares: 1.5, priceLive: 190.5 }],
    snapshots: [{ month: "2026-06", portfolioValueCents: 9504843 }],
  });
  assert(g2.errors.length === 1 && g2.errors[0].includes("Nope"), "bnpl dangling ref caught");
  assert(g2.rows.bnplRows[0].categoryId === g2.rows.categoryRows[0].id, "bnpl FK wired");
  assert(g2.rows.holdingRows[0].shares === "1.5", "holding numeric → string");
  assert(g2.rows.snapshotRows[0].portfolioValueCents === 9504843, "snapshot cents pass-through");

  // eslint-disable-next-line no-console
  console.log("legacy-import selfCheck: OK");
}

// Node-only guard; undefined in the Next bundle → never runs on import.
if (typeof process !== "undefined" && process.argv?.[1]?.replace(/\\/g, "/").endsWith("legacy-import.ts")) {
  selfCheck();
}
