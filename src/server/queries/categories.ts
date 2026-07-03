import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories } from "@/db/schema";
import { monthKey, todayISO } from "@/lib/dates";

export type CategoryRow = {
  id: string;
  name: string;
  mainCategory: string | null;
  type: "Income" | "Expense" | "Deduction" | "Transfer";
  framework: string;
  monthlyBudgetCents: number;
  active: boolean;
  /** Live (non-deleted) spend this month — feeds the budget bar. */
  spentThisMonthCents: number;
};

/** All categories (incl. archived) + current-month spend in one query.
 *  The correlated subquery avoids a GROUP BY over the whole ledger. */
export async function getCategoriesWithSpend(
  userId: string,
): Promise<CategoryRow[]> {
  const db = getDb();
  const month = monthKey(todayISO()); // 'YYYY-MM'
  const first = `${month}-01`;
  const last = `${month}-31`; // date is ISO text-ordered; '-31' bounds any month

  // NB: columns inside sql`` render UNQUALIFIED — a correlated ${categories.id}
  // becomes bare "id" and PG binds it to the inner table (both tables have id).
  // So: alias the inner table and write the outer reference as literal text.
  const spent = sql<number>`coalesce((
    select sum(t.amount_cents)
    from transactions t
    where t.user_id = ${userId}
      and t.category_id = categories.id
      and t.deleted = false
      and t.date >= ${first}
      and t.date <= ${last}
  ), 0)`;

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      mainCategory: categories.mainCategory,
      type: categories.type,
      framework: categories.framework,
      monthlyBudgetCents: categories.monthlyBudgetCents,
      active: categories.active,
      spentThisMonthCents: spent,
    })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.framework), asc(categories.name));

  return rows.map((r) => ({ ...r, spentThisMonthCents: Number(r.spentThisMonthCents) }));
}
