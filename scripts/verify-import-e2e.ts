/**
 * scripts/verify-import-e2e.ts — Phase 11.3 gate (V9), server side.
 *
 *   npx tsx scripts/verify-import-e2e.ts
 *
 * The real commit path for a SECOND account, minus the Google OAuth click:
 * creates a throwaway user, runs the wizard's exact server path (parseWorkbook →
 * importLegacyBundle) against live Neon, asserts reconciliation all-match, then
 * deletes the temp user (ON DELETE CASCADE wipes every imported row). Scoped to
 * its own user id — never touches Andre's data. Self-cleaning even on failure.
 */
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { parseWorkbook } from "@/lib/import-parse";
import { importLegacyBundle } from "@/lib/legacy-import";

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

  const buf = readFileSync("public/templates/fortuna-import.xlsx");
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const { bundle, errors } = parseWorkbook(ab);
  if (errors.length) {
    console.error("parse errors:", errors);
    process.exit(1);
  }

  const tempId = crypto.randomUUID();
  const email = `v9-e2e-${tempId}@fortuna.local`;
  console.log(`V9 import E2E · temp user ${email}`);

  let ok = false;
  try {
    await db.insert(users).values({ id: tempId, email });
    const result = await importLegacyBundle(db, tempId, bundle, {});
    if (!result.ok) {
      console.error("import failed:", result.errors);
    } else {
      const bad = result.reconciliation.filter((r) => !r.match);
      console.log("counts:", JSON.stringify(result.counts));
      for (const r of result.reconciliation.filter((r) => r.writtenCount > 0)) {
        console.log(`  ${r.table.padEnd(18)} src ${r.sourceCount} = db ${r.writtenCount}  ${r.match ? "✓" : "✗"}`);
      }
      ok = bad.length === 0;
      if (!ok) console.error("reconciliation mismatch:", bad);
    }
  } finally {
    await db.delete(users).where(eq(users.id, tempId));
    console.log("temp user deleted (cascade wiped imported rows).");
  }

  console.log(ok ? "\n✓ V9: template round-trips through the real commit path for a fresh account." : "\n✗ V9 FAILED.");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
