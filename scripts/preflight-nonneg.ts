/**
 * scripts/preflight-nonneg.ts — run BEFORE `npm run db:push` (WS8).
 *
 *   npx tsx scripts/preflight-nonneg.ts
 *
 * The migration adds CHECK (… >= 0) to several money columns. Postgres refuses
 * to add a CHECK if an existing row already violates it, so this read-only probe
 * counts offenders first. All zeros → safe to push. Any non-zero → clean that
 * row before pushing. SELECTs only; changes nothing.
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

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

async function main() {
  loadEnv();
  const db = getDb();
  const res = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM bnpl_plans     WHERE total_amount_cents < 0 OR n_instalments < 0 OR instalment_cents < 0) AS bad_bnpl,
      (SELECT count(*) FROM snapshots      WHERE portfolio_value_cents < 0)                                          AS bad_snapshots,
      (SELECT count(*) FROM sinking_funds  WHERE annual_target_cents < 0 OR monthly_accrual_cents < 0)               AS bad_sinking,
      (SELECT count(*) FROM user_settings  WHERE gross_salary_cents < 0 OR statutory_cents < 0 OR net_salary_cents < 0) AS bad_settings
  `)) as unknown as { rows?: Record<string, unknown>[] } | Record<string, unknown>[];

  // neon-http returns { rows }, some drivers return the array directly.
  const row = (Array.isArray(res) ? res[0] : res.rows?.[0]) ?? {};
  const counts = row as Record<string, number>;
  const total = Object.values(counts).reduce((a, b) => a + Number(b), 0);

  console.log("Pre-flight negative-row check:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(16)} ${v}`);
  if (total === 0) {
    console.log("\n✓ SAFE — no negative rows. db:push will succeed.");
  } else {
    console.log(`\n✗ STOP — ${total} offending row(s). Fix these before db:push.`);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
