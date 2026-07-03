"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/server/auth-helpers";
import { getDb } from "@/db/client";
import { transactions } from "@/db/schema";
import { parseWorkbook, bundleCounts } from "@/lib/import-parse";
import { buildGraph, importLegacyBundle, type ImportResult } from "@/lib/legacy-import";

/* The wizard's two server-side steps. Both requireUserId (user scoping never
 * comes from the upload); the file rides in via FormData (next.config 4mb limit).
 * All validation is delegated to lib/legacy-import — no import logic here. */

export type PreviewResult =
  | {
      ok: true;
      counts: Record<string, number>;
      errors: string[]; // parse + validation issues (blocking if non-empty)
      hasExistingData: boolean;
    }
  | { ok: false; error: string };

async function fileToBuffer(formData: FormData): Promise<ArrayBuffer | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  try {
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}

export async function previewImport(formData: FormData): Promise<PreviewResult> {
  const userId = await requireUserId();
  const buf = await fileToBuffer(formData);
  if (!buf) return { ok: false, error: "No file uploaded, or it could not be read." };

  let parsed;
  try {
    parsed = parseWorkbook(buf);
  } catch {
    return { ok: false, error: "Could not read that file — is it a valid .xlsx or .csv?" };
  }

  // buildGraph validates enums (zod) + resolves refs; both surface as blocking errors.
  const errors = [...parsed.errors];
  try {
    const graph = buildGraph(userId, parsed.bundle);
    errors.push(...graph.errors);
  } catch (err) {
    if (err instanceof z.ZodError) {
      errors.push(...err.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`));
    } else {
      return { ok: false, error: "The file's structure could not be validated." };
    }
  }

  const db = getDb();
  const existing = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.deleted, false)))
    .limit(1);

  return {
    ok: true,
    counts: bundleCounts(parsed.bundle),
    errors,
    hasExistingData: existing.length > 0,
  };
}

export type CommitResult = ImportResult | { ok: false; errors: string[] };

export async function commitImport(formData: FormData): Promise<CommitResult> {
  const userId = await requireUserId();
  const replace = formData.get("replace") === "1";
  const buf = await fileToBuffer(formData);
  if (!buf) return { ok: false, errors: ["No file uploaded, or it could not be read."] };

  let parsed;
  try {
    parsed = parseWorkbook(buf);
  } catch {
    return { ok: false, errors: ["Could not read that file — is it a valid .xlsx or .csv?"] };
  }
  if (parsed.errors.length) return { ok: false, errors: parsed.errors };

  const db = getDb();
  let result: ImportResult;
  try {
    // wipeFirst=replace: appending onto existing data would collide on UNIQUE
    // names, so an existing-data import must be an explicit replace-all.
    result = await importLegacyBundle(db, userId, parsed.bundle, { wipeFirst: replace });
  } catch (err) {
    // db.batch throwing (e.g. a UNIQUE violation) is caught here — actions never throw.
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [`Import failed: ${msg}`] };
  }

  if (result.ok) {
    for (const p of ["/dashboard", "/transactions", "/analytics", "/categories", "/settings"]) {
      revalidatePath(p);
    }
  }
  return result;
}
