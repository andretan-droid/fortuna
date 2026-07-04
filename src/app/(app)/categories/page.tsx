import { PageHeader } from "@/components/shell/page-header";
import { Reveal } from "@/components/motion/reveal";
import { CategoryManager } from "@/components/categories/category-manager";
import { BudgetSummary } from "@/components/categories/budget-summary";
import { requireUserId } from "@/server/auth-helpers";
import { getCategoriesWithSpend } from "@/server/queries/categories";
import { getNetSalaryCents } from "@/server/queries/settings";

export default async function CategoriesPage() {
  const userId = await requireUserId();
  const [rows, netSalaryCents] = await Promise.all([
    getCategoriesWithSpend(userId),
    getNetSalaryCents(userId),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Budgets"
        title="Categories"
        description="Monthly budgets by category, grouped by Needs / Wants / Savings."
      />
      <Reveal>
        <BudgetSummary rows={rows} netSalaryCents={netSalaryCents} />
      </Reveal>
      <Reveal index={1}>
        <CategoryManager rows={rows} />
      </Reveal>
    </div>
  );
}
