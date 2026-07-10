import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  bigint,
  numeric,
  boolean,
  timestamp,
  date,
  uuid,
  primaryKey,
  unique,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

/* ============================================================================
   Fortuna schema — single source of truth (frozen → drizzle migrations in P8).

   Conventions (from legacy Code.gs, preserved for zero-loss migration):
   · Money = integer cents in bigint `*_cents`; amounts positive + CHECK ≥ 0,
     `type` carries direction. Balances may be negative (no CHECK).
   · Shares / prices / FX = numeric (never float).
   · Months = text 'YYYY-MM' + regex CHECK; dates = date 'YYYY-MM-DD'.
   · Domain PKs = uuid generated APP-SIDE (crypto.randomUUID) — neon-http
     db.batch() can't read generated ids back mid-batch.
   · Every domain row is scoped by user_id → users.id ON DELETE CASCADE.
     Intra-domain FKs are RESTRICT — ledger history never cascades away.
   ========================================================================== */

const uuidPk = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** Timestamp helper — UTC, defaults to now(). */
const nowTs = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();

// ---- Enums (verbatim legacy casing) ---------------------------------------
export const txnType = pgEnum("txn_type", [
  "Income",
  "Expense",
  "Deduction",
  "Transfer",
]);
export const framework = pgEnum("framework", [
  "Needs",
  "Wants",
  "Savings",
  "Income",
  "Deduction",
  "Transfer",
]);
export const accountKind = pgEnum("account_kind", ["Asset", "Liability"]);
/** Payment-method category — one source of truth for the enum, zod, and the UI. */
export const PAYMENT_METHOD_KINDS = [
  "Bank account",
  "Credit card",
  "E-wallet",
  "BNPL",
  "Cash",
  "Other",
] as const;
export const paymentMethodKind = pgEnum("payment_method_kind", PAYMENT_METHOD_KINDS);
/** Recurring-rule amount kind — plain text (not pgEnum) so it stays a cheap
 *  additive column; one source of truth for the zod validator and the UI. */
export const AMOUNT_KINDS = ["fixed", "estimated", "variable"] as const;

/* ============================================================================
   Auth.js tables (adapter-standard). Collision fix: the OAuth link table is
   `oauth_accounts` so the financial entity keeps the clean name `accounts`.
   ========================================================================== */

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ============================================================================
   Domain tables
   ========================================================================== */

export const categories = pgTable(
  "categories",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // = legacy Subcategory
    mainCategory: text("main_category"),
    type: txnType("type").notNull(),
    framework: framework("framework").notNull(),
    monthlyBudgetCents: bigint("monthly_budget_cents", { mode: "number" })
      .notNull()
      .default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    unique("categories_user_name_uq").on(t.userId, t.name),
    check("categories_budget_nonneg", sql`${t.monthlyBudgetCents} >= 0`),
  ],
);

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: paymentMethodKind("kind").notNull().default("Other"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [unique("payment_methods_user_name_uq").on(t.userId, t.name)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: accountKind("kind").notNull(),
    sort: integer("sort").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [unique("accounts_user_name_uq").on(t.userId, t.name)],
);

export const bnplPlans = pgTable(
  "bnpl_plans",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    legacyId: text("legacy_id"),
    item: text("item").notNull(),
    platform: text("platform"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    totalAmountCents: bigint("total_amount_cents", { mode: "number" }).notNull(),
    nInstalments: integer("n_instalments").notNull(),
    instalmentCents: bigint("instalment_cents", { mode: "number" }).notNull(),
    firstDueMonth: text("first_due_month"),
    status: text("status").notNull().default("auto"),
    // Default payment method for instalments; overridable per record-payment.
    paymentMethodId: uuid("payment_method_id").references(() => paymentMethods.id, {
      onDelete: "restrict",
    }),
    notes: text("notes"),
  },
  (t) => [
    check("bnpl_total_nonneg", sql`${t.totalAmountCents} >= 0`),
    check("bnpl_n_nonneg", sql`${t.nInstalments} >= 0`),
    check("bnpl_instalment_nonneg", sql`${t.instalmentCents} >= 0`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    legacyId: text("legacy_id"),
    date: date("date").notNull(), // 'YYYY-MM-DD' (string mode)
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    description: text("description"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    paymentMethodId: uuid("payment_method_id").references(
      () => paymentMethods.id,
      { onDelete: "restrict" },
    ),
    type: txnType("type").notNull(),
    bnplPlanId: uuid("bnpl_plan_id").references(() => bnplPlans.id, {
      onDelete: "restrict",
    }),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: nowTs("created_at"),
    updatedAt: nowTs("updated_at"),
  },
  (t) => [
    // Keyset-pagination feed order (see server/queries + GET route).
    index("idx_txn_feed").on(
      t.userId,
      t.date.desc(),
      t.createdAt.desc(),
      t.id.desc(),
    ),
    index("idx_txn_category").on(t.userId, t.categoryId),
    uniqueIndex("txn_user_legacy_uq")
      .on(t.userId, t.legacyId)
      .where(sql`${t.legacyId} is not null`),
    check("transactions_amount_nonneg", sql`${t.amountCents} >= 0`),
  ],
);

/* ── Receivables ("Owed to me") ────────────────────────────────────────────
   The mirror of bnpl_plans: money others owe Andre. Outstanding is DERIVED
   (lent − Σ payments) from receivable_payments — history is truth, no editable
   balance field to drift. Counts as an asset in net worth. */
export const receivables = pgTable(
  "receivables",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    person: text("person").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    date: date("date").notNull(), // 'YYYY-MM-DD' — when it was lent
    note: text("note"),
    createdAt: nowTs("created_at"),
  },
  (t) => [
    index("idx_receivables_user").on(t.userId),
    check("receivables_amount_nonneg", sql`${t.amountCents} >= 0`),
  ],
);

export const receivablePayments = pgTable(
  "receivable_payments",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receivableId: uuid("receivable_id")
      .notNull()
      .references(() => receivables.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_receivable_payments_rid").on(t.receivableId),
    check("receivable_payments_amount_nonneg", sql`${t.amountCents} >= 0`),
  ],
);

export const holdings = pgTable(
  "holdings",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ticker: text("ticker").notNull(),
    name: text("name"),
    exchange: text("exchange"),
    shares: numeric("shares", { precision: 24, scale: 8 }),
    avgCostLocal: numeric("avg_cost_local", { precision: 24, scale: 6 }),
    ccy: text("ccy"),
    priceLive: numeric("price_live", { precision: 24, scale: 6 }),
    dayChgPct: numeric("day_chg_pct", { precision: 12, scale: 4 }),
    manualPriceOverride: numeric("manual_price_override", {
      precision: 24,
      scale: 6,
    }),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
  },
  (t) => [unique("holdings_user_ticker_uq").on(t.userId, t.ticker)],
);

export const fxRates = pgTable(
  "fx_rates",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pair: text("pair").notNull(),
    rateLive: numeric("rate_live", { precision: 24, scale: 8 }),
    fallback: numeric("fallback", { precision: 24, scale: 8 }),
  },
  (t) => [unique("fx_rates_user_pair_uq").on(t.userId, t.pair)],
);

export const snapshots = pgTable(
  "snapshots",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    portfolioValueCents: bigint("portfolio_value_cents", { mode: "number" }),
    usdMyrAtSnap: numeric("usd_myr_at_snap", { precision: 24, scale: 8 }),
    notes: text("notes"),
  },
  (t) => [
    unique("snapshots_user_month_uq").on(t.userId, t.month),
    check("snapshots_month_fmt", sql`${t.month} ~ '^\\d{4}-\\d{2}$'`),
    check("snapshots_portfolio_nonneg", sql`${t.portfolioValueCents} >= 0`),
  ],
);

export const netWorthEntries = pgTable(
  "net_worth_entries",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    balanceCents: bigint("balance_cents", { mode: "number" }).notNull(),
  },
  (t) => [
    unique("nwe_user_account_month_uq").on(t.userId, t.accountId, t.month),
    index("idx_nwe_user_month").on(t.userId, t.month),
    check("nwe_month_fmt", sql`${t.month} ~ '^\\d{4}-\\d{2}$'`),
  ],
);

export const sinkingFunds = pgTable(
  "sinking_funds",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    annualTargetCents: bigint("annual_target_cents", { mode: "number" }),
    monthlyAccrualCents: bigint("monthly_accrual_cents", { mode: "number" }),
    matchCategoryId: uuid("match_category_id").references(() => categories.id, {
      onDelete: "restrict",
    }),
    openingBalanceCents: bigint("opening_balance_cents", { mode: "number" })
      .notNull()
      .default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    check("sinking_target_nonneg", sql`${t.annualTargetCents} >= 0`),
    check("sinking_accrual_nonneg", sql`${t.monthlyAccrualCents} >= 0`),
  ],
);

export const recurringRules = pgTable(
  "recurring_rules",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    expectedCents: bigint("expected_cents", { mode: "number" }),
    paymentMethodId: uuid("payment_method_id").references(
      () => paymentMethods.id,
      { onDelete: "restrict" },
    ),
    day: integer("day"),
    tolerance: numeric("tolerance", { precision: 6, scale: 4 }),
    // fixed = amount-tolerance matching (legacy behaviour); estimated/variable
    // match on category+method only — the expected amount becomes a hint.
    amountKind: text("amount_kind").notNull().default("fixed"),
    // Cadence: 1=monthly, 3=quarterly, 12=yearly. null start = "always monthly".
    intervalMonths: integer("interval_months").notNull().default(1),
    startMonth: text("start_month"),
    endMonth: text("end_month"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    check("recurring_day_range", sql`${t.day} between 1 and 31`),
    check("recurring_interval_min", sql`${t.intervalMonths} >= 1`),
  ],
);

export const userSettings = pgTable(
  "user_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: text("currency").notNull().default("RM"),
    grossSalaryCents: bigint("gross_salary_cents", { mode: "number" }),
    statutoryCents: bigint("statutory_cents", { mode: "number" }),
    netSalaryCents: bigint("net_salary_cents", { mode: "number" }),
    fxUsdFallback: numeric("fx_usd_fallback", { precision: 24, scale: 8 }),
    targetSavingsRate: numeric("target_savings_rate", { precision: 6, scale: 4 }),
    // SET NULL (not RESTRICT): deleting a payment method just clears the default.
    defaultPaymentMethodId: uuid("default_payment_method_id").references(
      () => paymentMethods.id,
      { onDelete: "set null" },
    ),
    priceFeedUrl: text("price_feed_url"),
    priceFeedToken: text("price_feed_token"),
    pricesUpdatedAt: timestamp("prices_updated_at", { withTimezone: true }),
    updatedAt: nowTs("updated_at"),
  },
  (t) => [
    check("settings_gross_nonneg", sql`${t.grossSalaryCents} >= 0`),
    check("settings_statutory_nonneg", sql`${t.statutoryCents} >= 0`),
    check("settings_net_nonneg", sql`${t.netSalaryCents} >= 0`),
  ],
);
