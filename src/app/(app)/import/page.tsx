import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Import"
        title="Import data"
        description="Upload an .xlsx / .csv, map columns, preview, and commit."
      />
      <ComingSoon phase="Phase 11" />
    </div>
  );
}
