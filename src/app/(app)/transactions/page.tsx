import { PageHeader } from "@/components/shell/page-header";
import { TransactionsView } from "@/components/transactions/feed";
import { requireUserId } from "@/server/auth-helpers";
import {
  getBnplPlanOptions,
  getCategoryOptions,
  getPaymentMethodOptions,
  getTransactionsPage,
  type FeedFilters,
} from "@/server/queries/transactions";

const TYPES = ["Income", "Expense", "Deduction", "Transfer"] as const;

/** RSC: parses URL filters, server-renders page 0 (instant paint — TanStack
 *  hydrates from it without a duplicate fetch), and MRU-orders categories. */
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" && v ? v : undefined;

  const typeParam = one(sp.type);
  const filters: FeedFilters = {
    q: one(sp.q),
    categoryId: one(sp.categoryId),
    paymentMethodId: one(sp.paymentMethodId),
    type: TYPES.includes(typeParam as (typeof TYPES)[number])
      ? (typeParam as FeedFilters["type"])
      : undefined,
    showDeleted: one(sp.showDeleted) === "1",
  };

  const [initialPage, categories, paymentMethods, bnplPlans] = await Promise.all([
    getTransactionsPage(userId, filters),
    getCategoryOptions(userId),
    getPaymentMethodOptions(userId),
    getBnplPlanOptions(userId),
  ]);

  // MRU ordering for the quick-log combobox: categories seen in page 0
  // (already recency-ordered) float to the top; the rest stay alphabetical.
  const seen = new Map<string, number>();
  initialPage.rows.forEach((r, i) => {
    if (!seen.has(r.categoryId)) seen.set(r.categoryId, i);
  });
  const mruCategories = [...categories].sort(
    (a, b) => (seen.get(a.id) ?? Infinity) - (seen.get(b.id) ?? Infinity),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description="Day-grouped feed with quick-log, filters, and BNPL tracking."
      />
      <TransactionsView
        filters={filters}
        initialPage={initialPage}
        categories={mruCategories}
        paymentMethods={paymentMethods}
        bnplPlans={bnplPlans}
      />
    </div>
  );
}
