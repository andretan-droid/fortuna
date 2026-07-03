/**
 * scripts/seed-legacy.ts — CLI wrapper around lib/legacy-import.
 *
 *   npm run seed:legacy -- [--file data/legacy/bundle.json] [--force] [--user <email>]
 *
 * Loads a LegacyBundle JSON (produced by the P8.3 Drive export) and imports it
 * for the target user. --force wipes that user's existing domain rows first, so
 * a reseed is idempotent (the P8.4 gate reruns until V2 reconciliation matches).
 *
 * The import core already fails on any reconciliation mismatch; this wrapper
 * just resolves the user, feeds the bundle, and prints the recon table.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { importLegacyBundle, type LegacyBundle } from "@/lib/legacy-import";

/** tsx doesn't auto-load .env.local (Next does) — read it before getDb().
 *  getDb() is a lazy singleton, so env just has to exist by the first call. */
function loadEnv() {
  try {
    const env = readFileSync(".env.local", "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    /* env may already be set in the environment — not fatal */
  }
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function resolveUserId(
  db: ReturnType<typeof getDb>,
  email: string | undefined,
): Promise<string> {
  if (email) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!u) throw new Error(`No user with email "${email}".`);
    return u.id;
  }
  const all = await db.select({ id: users.id, email: users.email }).from(users);
  if (all.length === 0) throw new Error("No users yet — sign in once, then reseed.");
  if (all.length > 1)
    throw new Error(
      `Multiple users found; disambiguate with --user <email>: ${all
        .map((u) => u.email)
        .join(", ")}`,
    );
  return all[0].id;
}

async function main() {
  loadEnv();
  const force = process.argv.includes("--force");
  const file = argValue("--file") ?? "data/legacy/bundle.json";
  const email = argValue("--user");

  const db = getDb();
  const userId = await resolveUserId(db, email);

  let bundle: LegacyBundle;
  try {
    bundle = JSON.parse(readFileSync(resolve(file), "utf8")) as LegacyBundle;
  } catch (err) {
    throw new Error(`Could not read bundle "${file}": ${(err as Error).message}`);
  }

  console.log(
    `Seeding user ${userId} from ${file}${force ? "  (--force: wipe first)" : ""} …`,
  );
  const result = await importLegacyBundle(db, userId, bundle, { wipeFirst: force });

  if (!result.ok) {
    console.error("\nImport FAILED — nothing was reconciled:");
    for (const e of result.errors) console.error("  · " + e);
    process.exit(1);
  }

  console.log("\nReconciliation (written / source):");
  for (const r of result.reconciliation) {
    const flag = r.match ? "  OK  " : " FAIL ";
    console.log(
      `  ${flag} ${r.table.padEnd(18)} rows ${r.writtenCount}/${r.sourceCount}` +
        `   sum ${r.writtenSumCents}/${r.sourceSumCents}c`,
    );
  }
  console.log("\nImport OK — V2 reconciliation clean.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
