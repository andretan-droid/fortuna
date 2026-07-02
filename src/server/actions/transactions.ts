"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { transactions, categories, paymentMethods, bnplPlans } from "@/db/schema";
import { requireUserId } from "@/server/auth-helpers";
import { ISO_DATE_RE } from "@/lib/dates";

/* Actions return typed results (never throw): Next.js masks thrown error
   messages in production, so errors travel as data. */
export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const txnInput = z.object({
  date: z.string().regex(ISO_DATE_RE, "Date must be YYYY-MM-DD"),
  amountCents: z.number().int().nonnegative("Amount must be ≥ 0"),
  description: z.string().trim().max(500).optional().default(""),
  categoryId: z.string().uuid("Pick a category"),
  paymentMethodId: z.string().uuid().nullable().optional(),
  bnplPlanId: z.string().uuid().nullable().optional(),
});
export type TxnInput = z.infer<typeof txnInput>;

/** FKs only prove rows exist — not that they belong to THIS user. Verify all
 *  referenced ids are user-scoped, and return the category's type so the
 *  stored `type` is derived server-side (the sheet's ⚡ formula, trusted). */
async function verifyRefs(
  userId: string,
  input: Pick<TxnInput, "categoryId" | "paymentMethodId" | "bnplPlanId">,
): Promise<{ type: "Income" | "Expense" | "Deduction" | "Transfer" } | { error: string }> {
  const db = getDb();
  const [cat] = await db
    .select({ type: categories.type })
    .from(categories)
    .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)));
  if (!cat) return { error: "Unknown category" };

  if (input.paymentMethodId) {
    const [pm] = await db
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(
        and(eq(paymentMethods.id, input.paymentMethodId), eq(paymentMethods.userId, userId)),
      );
    if (!pm) return { error: "Unknown payment method" };
  }
  if (input.bnplPlanId) {
    const [plan] = await db
      .select({ id: bnplPlans.id })
      .from(bnplPlans)
      .where(and(eq(bnplPlans.id, input.bnplPlanId), eq(bnplPlans.userId, userId)));
    if (!plan) return { error: "Unknown BNPL plan" };
  }
  return { type: cat.type };
}

function revalidate() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function createTransaction(raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = txnInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const refs = await verifyRefs(userId, parsed.data);
  if ("error" in refs) return { ok: false, error: refs.error };

  const id = crypto.randomUUID(); // app-side uuid (schema convention)
  await getDb()
    .insert(transactions)
    .values({
      id,
      userId,
      date: parsed.data.date,
      amountCents: parsed.data.amountCents,
      description: parsed.data.description || null,
      categoryId: parsed.data.categoryId,
      paymentMethodId: parsed.data.paymentMethodId ?? null,
      bnplPlanId: parsed.data.bnplPlanId ?? null,
      type: refs.type,
    });
  revalidate();
  return { ok: true, id };
}

export async function updateTransaction(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!z.string().uuid().safeParse(id).success)
    return { ok: false, error: "Bad transaction id" };
  const parsed = txnInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const refs = await verifyRefs(userId, parsed.data);
  if ("error" in refs) return { ok: false, error: refs.error };

  const updated = await getDb()
    .update(transactions)
    .set({
      date: parsed.data.date,
      amountCents: parsed.data.amountCents,
      description: parsed.data.description || null,
      categoryId: parsed.data.categoryId,
      paymentMethodId: parsed.data.paymentMethodId ?? null,
      bnplPlanId: parsed.data.bnplPlanId ?? null,
      type: refs.type, // re-derived: category change re-runs the ⚡ formula
      updatedAt: new Date(),
    })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning({ id: transactions.id });
  if (!updated.length) return { ok: false, error: "Transaction not found" };
  revalidate();
  return { ok: true, id };
}

/** Soft delete / restore — ledger history is never hard-deleted. */
export async function setTransactionDeleted(
  id: string,
  deleted: boolean,
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!z.string().uuid().safeParse(id).success)
    return { ok: false, error: "Bad transaction id" };

  const updated = await getDb()
    .update(transactions)
    .set({ deleted, updatedAt: new Date() })
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        eq(transactions.deleted, !deleted), // no-op guard
      ),
    )
    .returning({ id: transactions.id });
  if (!updated.length) return { ok: false, error: "Transaction not found" };
  revalidate();
  return { ok: true, id };
}
