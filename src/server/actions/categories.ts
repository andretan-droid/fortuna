"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { categories, userSettings } from "@/db/schema";
import { requireUserId } from "@/server/auth-helpers";
import { formatCents } from "@/lib/money";
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
  revalidatePath("/analytics");
}

/** UNIQUE(user_id, name) violations surface as a friendly message. */
function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /unique|duplicate/i.test(err.message);
}

const SPEND_FRAMEWORKS = ["Needs", "Wants", "Savings"] as const;

/** Hard-block: total budgeted across active Needs/Wants/Savings categories may
 *  not exceed net salary. Returns an error string to block the save, or null to
 *  allow. Only gates spend categories; a no-op when net salary is unset (0/null),
 *  so the app stays usable before the user enters their salary. */
async function budgetOverflowError(
  userId: string,
  framework: string,
  budgetCents: number,
  excludeId?: string,
): Promise<string | null> {
  if (!(SPEND_FRAMEWORKS as readonly string[]).includes(framework)) return null;

  const db = getDb();
  const [settings] = await db
    .select({ netSalaryCents: userSettings.netSalaryCents })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  const net = settings?.netSalaryCents ?? null;
  if (net == null || net === 0) return null;

  const rows = await db
    .select({ id: categories.id, budget: categories.monthlyBudgetCents })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.active, true),
        inArray(categories.framework, [...SPEND_FRAMEWORKS]),
      ),
    );
  // ponytail: check-then-write race — two concurrent saves could each pass and
  // overshoot together. Single-user app on neon-http (no transactions) makes this
  // acceptable. Upgrade path: a per-user budget-sum DB trigger if this goes multi-user.
  const existing = rows
    .filter((r) => r.id !== excludeId)
    .reduce((n, r) => n + r.budget, 0);
  const total = existing + budgetCents;
  if (total > net) {
    return `Budget over net salary: ${formatCents(total)} allocated across Needs/Wants/Savings vs ${formatCents(
      net,
    )} net income (over by ${formatCents(total - net)}). Lower this or another budget.`;
  }
  return null;
}

export async function createCategory(raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = categoryInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const overflow = await budgetOverflowError(
    userId,
    parsed.data.framework,
    parsed.data.monthlyBudgetCents,
  );
  if (overflow) return { ok: false, error: overflow };

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

  const overflow = await budgetOverflowError(
    userId,
    parsed.data.framework,
    parsed.data.monthlyBudgetCents,
    id,
  );
  if (overflow) return { ok: false, error: overflow };

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

/** Rename a main-category group across all the user's categories at once —
 *  user-initiated from the group manager only. The rest of the app NEVER
 *  auto-rewrites grouping. An empty `to` ungroups (mainCategory → null). */
export async function renameMainCategory(from: string, to: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const fromTrim = from.trim();
  const toTrim = to.trim();
  if (!fromTrim) return { ok: false, error: "Pick a group to rename" };
  if (toTrim.length > 100) return { ok: false, error: "Group name too long (max 100)" };
  if (fromTrim === toTrim) return { ok: true, id: toTrim };

  await getDb()
    .update(categories)
    .set({ mainCategory: toTrim || null })
    .where(and(eq(categories.userId, userId), eq(categories.mainCategory, fromTrim)));
  revalidate();
  return { ok: true, id: toTrim || "ungrouped" };
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
