import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Mirrors transactions/page.tsx: header + quick-log bar + day-grouped feed. */
export default function TransactionsLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
