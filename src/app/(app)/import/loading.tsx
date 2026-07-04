import { PageHeaderSkeleton, PanelSkeleton } from "@/components/ui/skeleton";

/** Mirrors import/page.tsx: centered max-w-2xl header → wizard panel. */
export default function ImportLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeaderSkeleton />
      <PanelSkeleton bodyClassName="h-72" />
    </div>
  );
}
