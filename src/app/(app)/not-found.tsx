import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** App-segment 404 — branded card with a way back, not Next's bare default. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-paper)]">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          404
        </p>
        <h1 className="font-display mt-2 text-2xl">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page doesn&apos;t exist or has moved.
        </p>
        <Link href="/dashboard" className={buttonVariants({ size: "lg", className: "mt-6" })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
