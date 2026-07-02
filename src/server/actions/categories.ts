"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { categories } from "@/db/schema";
import { requireUserId } from "@/server/auth-helpers";
import type { ActionResult } from "@/server/actions/transactions";

const TYPES = ["Income", "Expense", "Deduction", "Transfer"] as const;
const FRAMEWORKS = ["Needs", "Wants", "Savings", "Income", "Deduction", "Transfer"] as const;

/* Legacy sheet rule: framework mirrors type for non-Expense types; only
   Expense splits into Needs/Wants/Savings. Enforced server-side. */
const categoryInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    mainCategory: z.string().trim().max(100).optional().default(""),
    type: z.enum(TYPES),
    framework: z.enum(FRAMEWORKS),
    monthlyBudgetCents: z.number().int().nonnegative("Budget must be ≥ 0"),
  })
  .refine(
    (c) =>
      c.type === "Expense"
        ? ["Needs", "Wants", "Savings"].includes(c.framework)
        : c.framework === c.type,
    { message: "Framework doesn't match type" },
  );
export type CategoryInput = z.infer<typeof categoryInput>;

function revalidate() {
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

/** UNIQUE(user_id, name) violations surface as a friendly message. */
function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /unique|duplicate/i.test(err.message);
}

export async function createCategory(raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = categoryInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const id = crypto.randomUUID();
  try {
    await getDb().insert(categories).values({
      id,
      userId,
      name: parsed.data.name,
      mainCategory: parsed.data.mainCategory || null,
      type: parsed.data.type,
      framework: parsed.data.framework,
      monthlyBudgetCents: parsed.data.monthlyBudgetCents,
    });
  } catch (err) {
    if (isUniqueViolation(err))
      return { ok: false, error: `"${parsed.data.name}" already exists` };
    throw err;
  }
  revalidate();
  return { ok: true, id };
}

export async function updateCategory(id: string, raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!z.string().uuid().safeParse(id).success)
    return { ok: false, error: "Bad category id" };
  const parsed = categoryInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const updated = await getDb()
      .update(categories)
      .set({
        name: parsed.data.name,
        mainCategory: parsed.data.mainCategory || null,
        type: parsed.data.type,
        framework: parsed.data.framework,
        monthlyBudgetCents: parsed.data.monthlyBudgetCents,
      })
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning({ id: categories.id });
    if (!updated.length) return { ok: false, error: "Category not found" };
  } catch (err) {
    if (isUniqueViolation(err))
      return { ok: false, error: `"${parsed.data.name}" already exists` };
    throw err;
  }
  revalidate();
  return { ok: true, id };
}

/** Archive/unarchive — categories are RESTRICT-referenced by the ledger, so
 *  they are never hard-deleted; inactive ones just leave the pickers. */
export async function setCategoryActive(id: string, active: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!z.string().uuid().safeParse(id).success)
    return { ok: false, error: "Bad category id" };

  const updated = await getDb()
    .update(categories)
    .set({ active })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning({ id: categories.id });
  if (!updated.length) return { ok: false, error: "Category not found" };
  revalidate();
  return { ok: true, id };
}
