CREATE TYPE "public"."account_kind" AS ENUM('Asset', 'Liability');--> statement-breakpoint
CREATE TYPE "public"."framework" AS ENUM('Needs', 'Wants', 'Savings', 'Income', 'Deduction', 'Transfer');--> statement-breakpoint
CREATE TYPE "public"."txn_type" AS ENUM('Income', 'Expense', 'Deduction', 'Transfer');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "account_kind" NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "accounts_user_name_uq" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "bnpl_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"legacy_id" text,
	"item" text NOT NULL,
	"platform" text,
	"category_id" uuid NOT NULL,
	"total_amount_cents" bigint NOT NULL,
	"n_instalments" integer NOT NULL,
	"instalment_cents" bigint NOT NULL,
	"first_due_month" text,
	"status" text DEFAULT 'auto' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"main_category" text,
	"type" "txn_type" NOT NULL,
	"framework" "framework" NOT NULL,
	"monthly_budget_cents" bigint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categories_user_name_uq" UNIQUE("user_id","name"),
	CONSTRAINT "categories_budget_nonneg" CHECK ("categories"."monthly_budget_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"pair" text NOT NULL,
	"rate_live" numeric(24, 8),
	"fallback" numeric(24, 8),
	CONSTRAINT "fx_rates_user_pair_uq" UNIQUE("user_id","pair")
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ticker" text NOT NULL,
	"name" text,
	"exchange" text,
	"shares" numeric(24, 8),
	"avg_cost_local" numeric(24, 6),
	"ccy" text,
	"price_live" numeric(24, 6),
	"day_chg_pct" numeric(12, 4),
	"manual_price_override" numeric(24, 6),
	"price_updated_at" timestamp with time zone,
	CONSTRAINT "holdings_user_ticker_uq" UNIQUE("user_id","ticker")
);
--> statement-breakpoint
CREATE TABLE "net_worth_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"account_id" uuid NOT NULL,
	"balance_cents" bigint NOT NULL,
	CONSTRAINT "nwe_user_account_month_uq" UNIQUE("user_id","account_id","month"),
	CONSTRAINT "nwe_month_fmt" CHECK ("net_worth_entries"."month" ~ '^\d{4}-\d{2}$')
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "oauth_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "payment_methods_user_name_uq" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"description" text NOT NULL,
	"category_id" uuid NOT NULL,
	"expected_cents" bigint,
	"payment_method_id" uuid,
	"day" integer,
	"tolerance" numeric(6, 4),
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "recurring_day_range" CHECK ("recurring_rules"."day" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sinking_funds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"annual_target_cents" bigint,
	"monthly_accrual_cents" bigint,
	"match_category_id" uuid,
	"opening_balance_cents" bigint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"portfolio_value_cents" bigint,
	"usd_myr_at_snap" numeric(24, 8),
	"notes" text,
	CONSTRAINT "snapshots_user_month_uq" UNIQUE("user_id","month"),
	CONSTRAINT "snapshots_month_fmt" CHECK ("snapshots"."month" ~ '^\d{4}-\d{2}$')
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"legacy_id" text,
	"date" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"description" text,
	"category_id" uuid NOT NULL,
	"payment_method_id" uuid,
	"type" "txn_type" NOT NULL,
	"bnpl_plan_id" uuid,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_nonneg" CHECK ("transactions"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"currency" text DEFAULT 'RM' NOT NULL,
	"gross_salary_cents" bigint,
	"statutory_cents" bigint,
	"net_salary_cents" bigint,
	"fx_usd_fallback" numeric(24, 8),
	"target_savings_rate" numeric(6, 4),
	"default_payment_method_id" uuid,
	"price_feed_url" text,
	"price_feed_token" text,
	"prices_updated_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bnpl_plans" ADD CONSTRAINT "bnpl_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bnpl_plans" ADD CONSTRAINT "bnpl_plans_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_entries" ADD CONSTRAINT "net_worth_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_entries" ADD CONSTRAINT "net_worth_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinking_funds" ADD CONSTRAINT "sinking_funds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinking_funds" ADD CONSTRAINT "sinking_funds_match_category_id_categories_id_fk" FOREIGN KEY ("match_category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bnpl_plan_id_bnpl_plans_id_fk" FOREIGN KEY ("bnpl_plan_id") REFERENCES "public"."bnpl_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_default_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("default_payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_nwe_user_month" ON "net_worth_entries" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "idx_txn_feed" ON "transactions" USING btree ("user_id","date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_txn_category" ON "transactions" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "txn_user_legacy_uq" ON "transactions" USING btree ("user_id","legacy_id") WHERE "transactions"."legacy_id" is not null;