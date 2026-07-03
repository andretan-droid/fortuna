import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Shown when the ledger has no transactions yet — points at the importer. */
export function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
      <p className="font-display text-xl">No data yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Import your budget sheet or log your first transaction, and your month —
        cash flow, budgets, and net worth — appears here.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild>
          <Link href="/import">Import data</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/transactions">Add a transaction</Link>
        </Button>
      </div>
    </div>
  );
}
