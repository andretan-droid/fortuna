import { PageHeaderSkeleton, PanelSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Mirrors dashboard/page.tsx grid (hero → pulse+budgets → wealth → recent+
 *  portfolio → sinking+accounts) so the shell paints instantly, no layout shift. */
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
      <PanelSkeleton bodyClassName="h-24" />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
    </div>
  );
}
