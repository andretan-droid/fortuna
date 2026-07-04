"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { bnplPlans, categories, transactions } from "@/db/schema";
import { requireUserId } from "@/server/auth-helpers";
import type { ActionResult } from "@/server/actions/transactions";

/* BNPL plan CRUD. Progress (paid/left/outstanding) is DERIVED from linked
 * Expense transactions in src/lib/bnpl.ts — these actions only own the plan's
 * static fields. Deleting a plan with linked txns is refused, not cascaded. */

const uuid = z.string().uuid();
const cents = z.number().int().nonnegative();
const month = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Use YYYY-MM")
  .nullable();

const planInput = z.object({
  item: z.string().trim().min(1, "Item is required").max(200),
  platform: z.string().trim().max(100).nullable(),
  categoryId: uuid,
  totalAmountCents: cents,
  nInstalments: z.number().int().min(1, "At least 1 instalment"),
  instalmentCents: cents, // 0 → bnpl.ts falls back to round(total / n)
  firstDueMonth: month,
  notes: z.string().trim().max(500).nullable(),
});

function revalidate() {
  revalidatePath("/debts");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/transactions");
}

async function ownsCategory(id: string, userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return !!row;
}

export async function createBnplPlan(raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = planInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!(await ownsCategory(d.categoryId, userId)))
    return { ok: false, error: "Unknown category" };

  const id = crypto.randomUUID();
  await getDb().insert(bnplPlans).values({ id, userId, status: "auto", ...d });
  revalidate();
  return { ok: true, id };
}

export async function updateBnplPlan(id: string, raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const parsed = planInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!(await ownsCategory(d.categoryId, userId)))
    return { ok: false, error: "Unknown category" };

  const updated = await getDb()
    .update(bnplPlans)
    .set(d)
    .where(and(eq(bnplPlans.id, id), eq(bnplPlans.userId, userId)))
    .returning({ id: bnplPlans.id });
  if (!updated.length) return { ok: false, error: "Not found" };
  revalidate();
  return { ok: true, id };
}

/** Refuse if any live transaction links to the plan — unlink those first so the
 *  ledger never ends up pointing at a deleted plan. */
export async function deleteBnplPlan(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };

  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.bnplPlanId, id)));
  if (n > 0)
    return { ok: false, error: `Unlink ${n} transaction${n === 1 ? "" : "s"} first` };

  const deleted = await getDb()
    .delete(bnplPlans)
    .where(and(eq(bnplPlans.id, id), eq(bnplPlans.userId, userId)))
    .returning({ id: bnplPlans.id });
  if (!deleted.length) return { ok: false, error: "Not found" };
  revalidate();
  return { ok: true, id };
}
