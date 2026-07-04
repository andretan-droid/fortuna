import { PageHeaderSkeleton, PanelSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Mirrors settings/page.tsx: header → 2-col grid of 6 setting panels → danger strip. */
export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <PanelSkeleton key={i} bodyClassName="h-40" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
