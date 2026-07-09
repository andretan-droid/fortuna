import { Button } from "@/components/ui/button";

/** Non-destructive counterpart to DangerZone — a plain navigation-triggered
 *  download, no client state needed since the browser handles the
 *  Content-Disposition response and auth flows via the existing session cookie. */
export function ExportData() {
  return (
    <section className="rounded-lg border p-5">
      <h2 className="font-display text-xl">Export data</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Download every transaction, category, account, and portfolio row you own as one
        spreadsheet — a portable copy in the same sheet format the app migrated from.
      </p>
      <Button asChild className="mt-4">
        <a href="/api/export" download>
          Export data (.xlsx)
        </a>
      </Button>
    </section>
  );
}
