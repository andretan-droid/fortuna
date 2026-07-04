"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { receivables, receivablePayments } from "@/db/schema";
import { requireUserId } from "@/server/auth-helpers";
import { ISO_DATE_RE } from "@/lib/dates";
import type { ActionResult } from "@/server/actions/transactions";

/* Receivables ("Owed to me") CRUD + repayment logging. Outstanding is DERIVED in
 * src/lib/receivables.ts from logged repayments — these actions only own the IOU's
 * static fields and append repayment rows. Deleting an IOU cascades its payments
 * (they're its own child data, not shared ledger history). */

const uuid = z.string().uuid();

const iouInput = z.object({
  person: z.string().trim().min(1, "Who owes you?").max(200),
  amountCents: z.number().int().nonnegative("Amount must be ≥ 0"),
  date: z.string().regex(ISO_DATE_RE, "Date must be YYYY-MM-DD"),
  note: z.string().trim().max(500).nullable(),
});

const paymentInput = z.object({
  amountCents: z.number().int().positive("Repayment must be > 0"),
  date: z.string().regex(ISO_DATE_RE, "Date must be YYYY-MM-DD"),
});

function revalidate() {
  revalidatePath("/debts");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

export async function createReceivable(raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = iouInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const id = crypto.randomUUID();
  await getDb().insert(receivables).values({ id, userId, ...parsed.data });
  revalidate();
  return { ok: true, id };
}

export async function updateReceivable(id: string, raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const parsed = iouInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const updated = await getDb()
    .update(receivables)
    .set(parsed.data)
    .where(and(eq(receivables.id, id), eq(receivables.userId, userId)))
    .returning({ id: receivables.id });
  if (!updated.length) return { ok: false, error: "Not found" };
  revalidate();
  return { ok: true, id };
}

/** Payments cascade via the FK (onDelete: cascade). */
export async function deleteReceivable(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };

  const deleted = await getDb()
    .delete(receivables)
    .where(and(eq(receivables.id, id), eq(receivables.userId, userId)))
    .returning({ id: receivables.id });
  if (!deleted.length) return { ok: false, error: "Not found" };
  revalidate();
  return { ok: true, id };
}

/** Append a repayment. Verifies the IOU belongs to THIS user (FK alone doesn't). */
export async function logReceivablePayment(
  receivableId: string,
  raw: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(receivableId).success) return { ok: false, error: "Bad id" };
  const parsed = paymentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const db = getDb();
  const [owned] = await db
    .select({ id: receivables.id })
    .from(receivables)
    .where(and(eq(receivables.id, receivableId), eq(receivables.userId, userId)));
  if (!owned) return { ok: false, error: "Not found" };

  const id = crypto.randomUUID();
  await db.insert(receivablePayments).values({ id, userId, receivableId, ...parsed.data });
  revalidate();
  return { ok: true, id };
}
