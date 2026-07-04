import { PageHeaderSkeleton, PanelSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Mirrors categories/page.tsx: header → budget-summary panel → framework strip
 *  (3 cards) → category list. */
export default function CategoriesLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <PanelSkeleton bodyClassName="h-16" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
