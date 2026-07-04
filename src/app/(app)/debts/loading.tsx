import { PageHeaderSkeleton, PanelSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Mirrors debts/page.tsx: header → 4 stat tiles → BNPL ladder → liabilities. */
export default function DebtsLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <PanelSkeleton bodyClassName="h-48" />
      <PanelSkeleton bodyClassName="h-24" />
    </div>
  );
}
