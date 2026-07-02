import { PageHeader } from "@/components/shell/page-header";
import { CategoryManager } from "@/components/categories/category-manager";
import { requireUserId } from "@/server/auth-helpers";
import { getCategoriesWithSpend } from "@/server/queries/categories";

export default async function CategoriesPage() {
  const userId = await requireUserId();
  const rows = await getCategoriesWithSpend(userId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Budgets"
        title="Categories"
        description="Monthly budgets by category, grouped by Needs / Wants / Savings."
      />
      <CategoryManager rows={rows} />
    </div>
  );
}
