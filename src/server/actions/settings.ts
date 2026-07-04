"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  accounts,
  bnplPlans,
  categories,
  fxRates,
  holdings,
  netWorthEntries,
  paymentMethods,
  PAYMENT_METHOD_KINDS,
  recurringRules,
  sinkingFunds,
  snapshots,
  transactions,
  userSettings,
} from "@/db/schema";
import { requireUserId } from "@/server/auth-helpers";
import { monthKey, todayISO } from "@/lib/dates";
import type { ActionResult } from "@/server/actions/transactions";

const uuid = z.string().uuid();
const cents = z.number().int().nonnegative();

/** Refresh only the pages that render the changed domain — blanket-invalidating
 *  all five pages made every rename cost 3+ wasted full-page RSC refetches.
 *  "/settings" itself is always included. */
function revalidate(...paths: string[]) {
  for (const p of new Set(["/settings", ...paths])) revalidatePath(p);
}

/** Guard: a referenced id must belong to THIS user (FKs alone don't check). */
async function ownsRow(
  table: typeof paymentMethods | typeof categories | typeof accounts,
  id: string,
  userId: string,
): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId)));
  return !!row;
}

/* ---------------------------------------------------------------- profile */

const profileInput = z.object({
  currency: z.string().trim().min(1).max(8),
  grossSalaryCents: cents.nullable(),
  statutoryCents: cents.nullable(),
  netSalaryCents: cents.nullable(),
  targetSavingsRate: z.number().min(0).max(1).nullable(), // fraction 0–1
  defaultPaymentMethodId: uuid.nullable(),
});
export type ProfileInput = z.infer<typeof profileInput>;

export async function saveProfile(raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.defaultPaymentMethodId && !(await ownsRow(paymentMethods, d.defaultPaymentMethodId, userId)))
    return { ok: false, error: "Unknown payment method" };

  const values = {
    currency: d.currency,
    grossSalaryCents: d.grossSalaryCents,
    statutoryCents: d.statutoryCents,
    netSalaryCents: d.netSalaryCents,
    targetSavingsRate: d.targetSavingsRate?.toString() ?? null,
    defaultPaymentMethodId: d.defaultPaymentMethodId,
    updatedAt: new Date(),
  };
  await getDb()
    .insert(userSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userSettings.userId, set: values });
  revalidate("/dashboard", "/categories", "/analytics"); // salary + savings target feed budgets & rates
  return { ok: true, id: userId };
}

const priceFeedInput = z.object({
  priceFeedUrl: z.string().trim().url("Enter a valid URL").or(z.literal("")),
  priceFeedToken: z.string().trim().max(500),
});

export async function savePriceFeed(raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = priceFeedInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const values = {
    priceFeedUrl: parsed.data.priceFeedUrl || null,
    priceFeedToken: parsed.data.priceFeedToken || null,
    updatedAt: new Date(),
  };
  await getDb()
    .insert(userSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userSettings.userId, set: values });
  revalidate();
  return { ok: true, id: userId };
}

/* -------------------------------------------------------- payment methods */

const nameInput = z.object({ name: z.string().trim().min(1, "Name is required").max(100) });
const paymentKind = z.enum(PAYMENT_METHOD_KINDS);
const paymentMethodInput = nameInput.extend({ kind: paymentKind.default("Other") });

export async function createPaymentMethod(raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = paymentMethodInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const id = crypto.randomUUID();
  try {
    await getDb()
      .insert(paymentMethods)
      .values({ id, userId, name: parsed.data.name, kind: parsed.data.kind });
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message))
      return { ok: false, error: `"${parsed.data.name}" already exists` };
    throw err;
  }
  revalidate("/transactions", "/analytics");
  return { ok: true, id };
}

export async function setPaymentMethodKind(id: string, raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const parsed = paymentKind.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Unknown category" };
  const updated = await getDb()
    .update(paymentMethods)
    .set({ kind: parsed.data })
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
    .returning({ id: paymentMethods.id });
  if (!updated.length) return { ok: false, error: "Not found" };
  revalidate("/transactions", "/analytics");
  return { ok: true, id };
}

export async function renamePaymentMethod(id: string, raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const parsed = nameInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const updated = await getDb()
      .update(paymentMethods)
      .set({ name: parsed.data.name })
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
      .returning({ id: paymentMethods.id });
    if (!updated.length) return { ok: false, error: "Not found" };
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message))
      return { ok: false, error: `"${parsed.data.name}" already exists` };
    throw err;
  }
  revalidate("/transactions", "/analytics");
  return { ok: true, id };
}

export async function setPaymentMethodActive(id: string, active: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const updated = await getDb()
    .update(paymentMethods)
    .set({ active })
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
    .returning({ id: paymentMethods.id });
  if (!updated.length) return { ok: false, error: "Not found" };
  revalidate("/transactions", "/analytics");
  return { ok: true, id };
}

/* ----------------------------------------------------------------- accounts */

const accountInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  kind: z.enum(["Asset", "Liability"]),
  sort: z.number().int().default(0),
});

export async function createAccount(raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = accountInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const id = crypto.randomUUID();
  try {
    await getDb().insert(accounts).values({ id, userId, ...parsed.data });
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message))
      return { ok: false, error: `"${parsed.data.name}" already exists` };
    throw err;
  }
  revalidate("/dashboard", "/debts", "/analytics");
  return { ok: true, id };
}

export async function updateAccount(id: string, raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const parsed = accountInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const updated = await getDb()
      .update(accounts)
      .set(parsed.data)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning({ id: accounts.id });
    if (!updated.length) return { ok: false, error: "Not found" };
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message))
      return { ok: false, error: `"${parsed.data.name}" already exists` };
    throw err;
  }
  revalidate("/dashboard", "/debts", "/analytics");
  return { ok: true, id };
}

export async function setAccountActive(id: string, active: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const updated = await getDb()
    .update(accounts)
    .set({ active })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning({ id: accounts.id });
  if (!updated.length) return { ok: false, error: "Not found" };
  revalidate("/dashboard", "/debts", "/analytics");
  return { ok: true, id };
}

/** Record/overwrite an account's balance for the CURRENT month (net-worth
 *  history). Upserts on the (user, account, month) unique key so re-editing the
 *  same month overwrites rather than stacking rows. */
export async function saveAccountBalance(raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = z
    .object({ accountId: uuid, balanceCents: z.number().int() })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { accountId, balanceCents } = parsed.data;
  if (!(await ownsRow(accounts, accountId, userId)))
    return { ok: false, error: "Unknown account" };

  const month = monthKey(todayISO());
  await getDb()
    .insert(netWorthEntries)
    .values({ id: crypto.randomUUID(), userId, accountId, month, balanceCents })
    .onConflictDoUpdate({
      target: [netWorthEntries.userId, netWorthEntries.accountId, netWorthEntries.month],
      set: { balanceCents },
    });
  revalidate("/dashboard", "/debts", "/analytics");
  return { ok: true, id: accountId };
}

/* ------------------------------------------------------------ sinking funds */

const sinkingInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  annualTargetCents: cents.nullable(),
  monthlyAccrualCents: cents.nullable(),
  matchCategoryId: uuid.nullable(),
  openingBalanceCents: z.number().int(), // may be negative? legacy: opening balance, keep int
  active: z.boolean().default(true),
});

export async function saveSinkingFund(id: string | null, raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const parsed = sinkingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.matchCategoryId && !(await ownsRow(categories, d.matchCategoryId, userId)))
    return { ok: false, error: "Unknown category" };

  if (id === null) {
    const newId = crypto.randomUUID();
    await getDb().insert(sinkingFunds).values({ id: newId, userId, ...d });
    revalidate("/dashboard");
    return { ok: true, id: newId };
  }
  const updated = await getDb()
    .update(sinkingFunds)
    .set(d)
    .where(and(eq(sinkingFunds.id, id), eq(sinkingFunds.userId, userId)))
    .returning({ id: sinkingFunds.id });
  if (!updated.length) return { ok: false, error: "Not found" };
  revalidate("/dashboard");
  return { ok: true, id };
}

/** Sinking funds are referenced by nothing — real delete is safe. */
export async function deleteSinkingFund(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const deleted = await getDb()
    .delete(sinkingFunds)
    .where(and(eq(sinkingFunds.id, id), eq(sinkingFunds.userId, userId)))
    .returning({ id: sinkingFunds.id });
  if (!deleted.length) return { ok: false, error: "Not found" };
  revalidate("/dashboard");
  return { ok: true, id };
}

/* ---------------------------------------------------------- recurring rules */

const recurringInput = z.object({
  description: z.string().trim().min(1, "Description is required").max(200),
  categoryId: uuid,
  expectedCents: cents.nullable(),
  paymentMethodId: uuid.nullable(),
  day: z.number().int().min(1).max(31).nullable(),
  tolerance: z.number().min(0).max(1).nullable(), // fraction, e.g. 0.05
  active: z.boolean().default(true),
});

export async function saveRecurringRule(id: string | null, raw: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const parsed = recurringInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!(await ownsRow(categories, d.categoryId, userId)))
    return { ok: false, error: "Unknown category" };
  if (d.paymentMethodId && !(await ownsRow(paymentMethods, d.paymentMethodId, userId)))
    return { ok: false, error: "Unknown payment method" };

  const values = { ...d, tolerance: d.tolerance?.toString() ?? null };
  if (id === null) {
    const newId = crypto.randomUUID();
    await getDb().insert(recurringRules).values({ id: newId, userId, ...values });
    revalidate("/dashboard");
    return { ok: true, id: newId };
  }
  const updated = await getDb()
    .update(recurringRules)
    .set(values)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, userId)))
    .returning({ id: recurringRules.id });
  if (!updated.length) return { ok: false, error: "Not found" };
  revalidate("/dashboard");
  return { ok: true, id };
}

export async function deleteRecurringRule(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Bad id" };
  const deleted = await getDb()
    .delete(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, userId)))
    .returning({ id: recurringRules.id });
  if (!deleted.length) return { ok: false, error: "Not found" };
  revalidate("/dashboard");
  return { ok: true, id };
}

/* ----------------------------------------------------------- danger zone */

/** Wipe ALL domain data for this user (auth rows survive). One db.batch =
 *  one implicit transaction on neon-http; children deleted before parents. */
export async function wipeAllData(confirmation: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (confirmation !== "WIPE EVERYTHING")
    return { ok: false, error: "Type the confirmation phrase exactly" };

  const db = getDb();
  try {
    await db.batch([
      db.delete(transactions).where(eq(transactions.userId, userId)),
      db.delete(netWorthEntries).where(eq(netWorthEntries.userId, userId)),
      db.delete(recurringRules).where(eq(recurringRules.userId, userId)),
      db.delete(sinkingFunds).where(eq(sinkingFunds.userId, userId)),
      db.delete(bnplPlans).where(eq(bnplPlans.userId, userId)),
      db.delete(holdings).where(eq(holdings.userId, userId)),
      db.delete(fxRates).where(eq(fxRates.userId, userId)),
      db.delete(snapshots).where(eq(snapshots.userId, userId)),
      db.delete(userSettings).where(eq(userSettings.userId, userId)),
      db.delete(accounts).where(eq(accounts.userId, userId)),
      db.delete(categories).where(eq(categories.userId, userId)),
      db.delete(paymentMethods).where(eq(paymentMethods.userId, userId)),
    ]);
  } catch (err) {
    // db.batch throwing must travel as data — actions never throw.
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Wipe failed: ${msg}` };
  }
  revalidate("/dashboard", "/transactions", "/categories", "/debts", "/analytics");
  return { ok: true, id: userId };
}
