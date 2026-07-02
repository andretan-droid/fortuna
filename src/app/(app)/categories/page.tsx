import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function CategoriesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Budgets"
        title="Categories"
        description="Monthly budgets by category, grouped by Needs / Wants / Savings."
      />
      <ComingSoon phase="Phase 7" />
    </div>
  );
}
