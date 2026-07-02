import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Profile, price feed, payment methods, accounts, and danger zone."
      />
      <ComingSoon phase="Phase 7" />
    </div>
  );
}
