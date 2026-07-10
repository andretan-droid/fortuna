import "server-only";
import { and, eq, desc, ilike, inArray, isNotNull, sql, count } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  transactions,
  categories,
  paymentMethods,
  bnplPlans,
} from "@/db/schema";
import { instalmentAtCents } from "@/lib/bnpl";

export const FEED_PAGE_SIZE = 50;

/** Keyset cursor — mirrors idx_txn_feed (user_id, date DESC, created_at DESC, id DESC). */
export type FeedCursor = { date: string; createdAt: string; id: string };

export type FeedFilters = {
  q?: string;
  categoryId?: string;
  paymentMethodId?: string;
  type?: "Income" | "Expense" | "Deduction" | "Transfer";
  showDeleted?: boolean;
};

/** One feed row = the 8 legacy sheet columns (Type/Main Category/Framework
 *  derived from the category join, exactly like the sheet's ⚡ formulas)
 *  plus the ids the editor needs. */
export type FeedRow = {
  id: string;
  date: string;
  amountCents: number;
  description: string | null;
  type: "Income" | "Expense" | "Deduction" | "Transfer";
  categoryId: string;
  category: string; // = legacy Subcategory
  mainCategory: string | null;
  framework: string;
  paymentMethodId: string | null;
  paymentMethod: string | null;
  paymentMethodKind: string | null;
  bnplPlanId: string | null;
  bnpl: {
    item: string;
    nInstalments: number;
    instalmentCents: number;
    paidCount: number; // legacy calc.js: min(#linked live Expense txns, n)
  } | null;
  deleted: boolean;
  createdAt: string;
};

export type FeedPage = { rows: FeedRow[]; nextCursor: FeedCursor | null };

export async function getTransactionsPage(
  userId: string,
  filters: FeedFilters = {},
  cursor?: FeedCursor,
): Promise<FeedPage> {
  const db = getDb();

  const where = and(
    eq(transactions.userId, userId),
    filters.showDeleted ? undefined : eq(transactions.deleted, false),
    filters.categoryId ? eq(transactions.categoryId, filters.categoryId) : undefined,
    filters.paymentMethodId
      ? eq(transactions.paymentMethodId, filters.paymentMethodId)
      : undefined,
    filters.type ? eq(transactions.type, filters.type) : undefined,
    filters.q ? ilike(transactions.description, `%${filters.q}%`) : undefined,
    cursor
      ? sql`(${transactions.date}, ${transactions.createdAt}, ${transactions.id})
            < (${cursor.date}::date, ${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
      : undefined,
  );

  const raw = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amountCents: transactions.amountCents,
      description: transactions.description,
      type: transactions.type,
      categoryId: transactions.categoryId,
      category: categories.name,
      mainCategory: categories.mainCategory,
      framework: categories.framework,
      paymentMethodId: transactions.paymentMethodId,
      paymentMethod: paymentMethods.name,
      paymentMethodKind: paymentMethods.kind,
      bnplPlanId: transactions.bnplPlanId,
      deleted: transactions.deleted,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(paymentMethods, eq(transactions.paymentMethodId, paymentMethods.id))
    .where(where)
    .orderBy(
      desc(transactions.date),
      desc(transactions.createdAt),
      desc(transactions.id),
    )
    .limit(FEED_PAGE_SIZE + 1); // +1 = "has next page" probe

  const hasMore = raw.length > FEED_PAGE_SIZE;
  const page = hasMore ? raw.slice(0, FEED_PAGE_SIZE) : raw;

  // BNPL badge data: one grouped-count + one plans query, only when needed.
  const planIds = [...new Set(page.map((r) => r.bnplPlanId).filter((x): x is string => !!x))];
  const bnplById = new Map<
    string,
    { item: string; nInstalments: number; instalmentCents: number; paidCount: number }
  >();
  if (planIds.length) {
    const [plans, counts] = await Promise.all([
      db
        .select({
          id: bnplPlans.id,
          item: bnplPlans.item,
          nInstalments: bnplPlans.nInstalments,
          instalmentCents: bnplPlans.instalmentCents,
          totalAmountCents: bnplPlans.totalAmountCents,
        })
        .from(bnplPlans)
        .where(and(eq(bnplPlans.userId, userId), inArray(bnplPlans.id, planIds))),
      db
        .select({ planId: transactions.bnplPlanId, n: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            inArray(transactions.bnplPlanId, planIds),
            eq(transactions.type, "Expense"),
            eq(transactions.deleted, false),
          ),
        )
        .groupBy(transactions.bnplPlanId),
    ]);
    const countById = new Map(counts.map((c) => [c.planId, c.n]));
    for (const p of plans) {
      const instal =
        p.instalmentCents || Math.round(p.totalAmountCents / (p.nInstalments || 1));
      bnplById.set(p.id, {
        item: p.item,
        nInstalments: p.nInstalments,
        instalmentCents: instal,
        paidCount: Math.min(countById.get(p.id) ?? 0, p.nInstalments),
      });
    }
  }

  const rows: FeedRow[] = page.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    bnpl: r.bnplPlanId ? (bnplById.get(r.bnplPlanId) ?? null) : null,
  }));

  const last = rows[rows.length - 1];
  return {
    rows,
    nextCursor: hasMore && last
      ? { date: last.date, createdAt: last.createdAt, id: last.id }
      : null,
  };
}

/** Active categories for the quick-log combobox — includes the derived-column
 *  sources (type / mainCategory / framework) so picking a Subcategory shows
 *  its ⚡ derivations instantly. */
export async function getCategoryOptions(userId: string) {
  const db = getDb();
  return db
    .select({
      id: categories.id,
      name: categories.name,
      mainCategory: categories.mainCategory,
      type: categories.type,
      framework: categories.framework,
    })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.active, true)))
    .orderBy(categories.name);
}

export async function getPaymentMethodOptions(userId: string) {
  const db = getDb();
  return db
    .select({ id: paymentMethods.id, name: paymentMethods.name, kind: paymentMethods.kind })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.active, true)))
    .orderBy(paymentMethods.kind, paymentMethods.name);
}

/** Plans still owed on (paid < n) — completed plans stay linkable on their
 *  OWN past transactions (TxnEditor merges those back in) but drop out of the
 *  "pick a plan" combobox so you can't log a 4th instalment on a 3× plan. */
export async function getBnplPlanOptions(userId: string) {
  const db = getDb();
  const [plans, counts] = await Promise.all([
    db
      .select({
        id: bnplPlans.id,
        item: bnplPlans.item,
        platform: bnplPlans.platform,
        categoryId: bnplPlans.categoryId,
        paymentMethodId: bnplPlans.paymentMethodId,
        totalAmountCents: bnplPlans.totalAmountCents,
        nInstalments: bnplPlans.nInstalments,
        instalmentCents: bnplPlans.instalmentCents,
      })
      .from(bnplPlans)
      .where(eq(bnplPlans.userId, userId))
      .orderBy(bnplPlans.item),
    db
      .select({ planId: transactions.bnplPlanId, n: count() })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "Expense"),
          eq(transactions.deleted, false),
          isNotNull(transactions.bnplPlanId),
        ),
      )
      .groupBy(transactions.bnplPlanId),
  ]);
  const paidById = new Map(counts.map((c) => [c.planId, c.n]));

  return plans
    .filter((p) => (paidById.get(p.id) ?? 0) < (p.nInstalments || 1))
    .map((p) => {
      const paid = Math.min(paidById.get(p.id) ?? 0, p.nInstalments || 1);
      return {
        id: p.id,
        item: p.item,
        platform: p.platform,
        categoryId: p.categoryId,
        paymentMethodId: p.paymentMethodId,
        nInstalments: p.nInstalments,
        instalmentCents: p.instalmentCents,
        nextInstalmentCents: instalmentAtCents(p, paid + 1),
      };
    });
}

export type RecentDescription = {
  description: string;
  categoryId: string;
  paymentMethodId: string | null;
};

/** Top ~30 distinct recent descriptions (most-recent use first), each with
 *  the category/method it was last logged under — feeds the quick-log
 *  description datalist and its "pick a recent merchant → prefill" shortcut. */
export async function getRecentDescriptions(userId: string): Promise<RecentDescription[]> {
  const db = getDb();
  const rows = await db
    .select({
      description: transactions.description,
      categoryId: transactions.categoryId,
      paymentMethodId: transactions.paymentMethodId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.deleted, false),
        isNotNull(transactions.description),
      ),
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(150);

  const seen = new Set<string>();
  const out: RecentDescription[] = [];
  for (const r of rows) {
    const description = r.description?.trim();
    if (!description || seen.has(description)) continue;
    seen.add(description);
    out.push({ description, categoryId: r.categoryId, paymentMethodId: r.paymentMethodId });
    if (out.length >= 30) break;
  }
  return out;
}
