import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function TransactionsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description="Day-grouped feed with quick-log, filters, and BNPL tracking."
      />
      <ComingSoon phase="Phase 6" />
    </div>
  );
}
