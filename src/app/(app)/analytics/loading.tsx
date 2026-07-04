import { PageHeaderSkeleton, PanelSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Mirrors analytics/page.tsx: trends header → cashflow → savings+networth →
 *  "this month" row → donut+breakdown → cashflow detail. */
export default function AnalyticsLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-56" />
      </div>
      <PanelSkeleton bodyClassName="h-44" />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton bodyClassName="h-44" />
        <PanelSkeleton bodyClassName="h-44" />
      </div>
      <div className="flex items-center justify-between gap-2 pt-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton bodyClassName="h-36" />
        <PanelSkeleton bodyClassName="h-36" />
      </div>
      <PanelSkeleton bodyClassName="h-48" />
    </div>
  );
}
