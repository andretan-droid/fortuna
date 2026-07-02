import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Charts"
        title="Analytics"
        description="Cash flow, category breakdowns, and net-worth trend over time."
      />
      <ComingSoon phase="Phase 10" />
    </div>
  );
}
