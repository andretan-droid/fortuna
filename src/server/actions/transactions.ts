"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
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
  revalidatePath("/analytics");
  revalidatePath("/categories");
  revalidatePath("/debts");
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

export type BatchResult = { ok: true; count: number } | { ok: false; error: string };

/** Commit many transactions in ONE atomic db.batch (all-or-nothing, same neon-http
 *  guarantee as the import wizard). Refs are verified in bulk — one categories +
 *  one payment-methods read for the whole set — and `type` is derived server-side
 *  from each row's category, exactly like createTransaction. Any bad row aborts
 *  the whole commit (the grid pre-filters to valid rows, so this is a backstop). */
export async function createTransactionsBatch(raw: unknown): Promise<BatchResult> {
  const userId = await requireUserId();
  const parsed = z.array(txnInput).min(1, "No rows to add").max(500, "Max 500 at once").safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const items = parsed.data;

  const db = getDb();
  const catIds = [...new Set(items.map((i) => i.categoryId))];
  const pmIds = [...new Set(items.map((i) => i.paymentMethodId).filter((x): x is string => !!x))];

  const [cats, pms] = await Promise.all([
    db
      .select({ id: categories.id, type: categories.type })
      .from(categories)
      .where(and(eq(categories.userId, userId), inArray(categories.id, catIds))),
    pmIds.length
      ? db
          .select({ id: paymentMethods.id })
          .from(paymentMethods)
          .where(and(eq(paymentMethods.userId, userId), inArray(paymentMethods.id, pmIds)))
      : Promise.resolve([] as { id: string }[]),
  ]);
  const typeByCat = new Map(cats.map((c) => [c.id, c.type]));
  const pmSet = new Set(pms.map((p) => p.id));

  const rows: (typeof transactions.$inferInsert)[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const type = typeByCat.get(it.categoryId);
    if (!type) return { ok: false, error: `Row ${i + 1}: unknown category` };
    if (it.paymentMethodId && !pmSet.has(it.paymentMethodId))
      return { ok: false, error: `Row ${i + 1}: unknown payment method` };
    rows.push({
      id: crypto.randomUUID(),
      userId,
      date: it.date,
      amountCents: it.amountCents,
      description: it.description || null,
      categoryId: it.categoryId,
      paymentMethodId: it.paymentMethodId ?? null,
      bnplPlanId: it.bnplPlanId ?? null,
      type,
    });
  }

  try {
    // Chunk under the PG bind-parameter ceiling, one implicit txn on neon-http.
    const stmts: BatchItem<"pg">[] = [];
    for (let i = 0; i < rows.length; i += 500)
      stmts.push(db.insert(transactions).values(rows.slice(i, i + 500)));
    await db.batch(stmts as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Batch add failed: ${msg}` };
  }

  revalidate();
  return { ok: true, count: rows.length };
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
