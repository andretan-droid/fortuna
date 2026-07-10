"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Panel } from "./panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCents } from "@/lib/money";
import { formatMonthLong, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/colors";
import { Chip } from "@/components/ui/chip";
import { createTransaction, type TxnInput } from "@/server/actions/transactions";
import { TxnForm, type BnplOption, type CategoryOption, type SimpleOption } from "@/components/transactions/txn-form";
import type { UpcomingRow } from "@/server/queries/recurring";

const STATUS_CHIP: Record<UpcomingRow["status"], { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: { bg: "bg-income/15", text: "text-income" } },
  due: { label: "Due", tone: { bg: "bg-warning/15", text: "text-warning" } },
  missed: { label: "Missed", tone: { bg: "bg-destructive/15", text: "text-destructive" } },
  upcoming: { label: "Upcoming", tone: { bg: "bg-muted", text: "text-muted-foreground" } },
};
const ORDER: Record<UpcomingRow["status"], number> = { missed: 0, due: 1, upcoming: 2, paid: 3 };

/** Recurring rules projected onto the ledger: this month's paid/due/missed
 *  bills plus a preview of non-monthly rules before they're actually due.
 *  Confirm/Log opens the real transaction form prefilled from the rule — the
 *  "type the actual amount when it's known" step for estimated/variable rules. */
export function UpcomingBills({
  rows,
  categories,
  paymentMethods,
  bnplPlans,
}: {
  rows: UpcomingRow[];
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
  bnplPlans: BnplOption[];
}) {
  const [confirming, setConfirming] = useState<UpcomingRow | null>(null);
  const [pending, startTransition] = useTransition();

  if (!rows.length) return null;
  const sorted = [...rows].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.month.localeCompare(b.month),
  );
  const outstanding = rows.filter((r) => r.status === "due" || r.status === "missed").length;

  function handleConfirm(input: TxnInput) {
    startTransition(async () => {
      const res = await createTransaction(input);
      if (res.ok) {
        toast.success("Logged");
        setConfirming(null);
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Panel
        title="Upcoming"
        headerRight={
          outstanding > 0 ? (
            <span className="text-xs text-muted-foreground">{outstanding} outstanding</span>
          ) : (
            <span className="text-xs text-income">All paid</span>
          )
        }
      >
        <ul className="divide-y divide-border">
          {sorted.map((r) => {
            const chip = STATUS_CHIP[r.status];
            const amountCents = r.status === "paid" ? r.matchedAmountCents : r.expectedCents;
            const sign = r.txnType === "Income" ? "+" : r.txnType === "Transfer" ? "" : "-";
            return (
              <li
                key={r.id}
                className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.category}
                    {r.status === "upcoming" && ` · ${formatMonthLong(r.month)}`}
                    {r.status !== "upcoming" && r.day != null && ` · day ${r.day}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {amountCents != null && (
                    <span
                      className={cn(
                        "tabular text-sm",
                        r.txnType === "Income" ? "text-income" : "text-muted-foreground",
                      )}
                    >
                      {sign}
                      {formatCents(amountCents)}
                    </span>
                  )}
                  <Chip label={chip.label} tone={chip.tone} />
                  {(r.status === "due" || r.status === "missed") && (
                    <Button size="xs" variant="outline" onClick={() => setConfirming(r)}>
                      Confirm
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Sheet open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="pr-10">
            <SheetTitle className="font-display text-2xl">Log {confirming?.description}</SheetTitle>
            <SheetDescription>
              Confirm the actual amount — it doesn&apos;t have to match the estimate.
            </SheetDescription>
          </SheetHeader>
          {confirming && (
            <div className="px-4 pb-8">
              <TxnForm
                key={confirming.id}
                categories={categories}
                paymentMethods={paymentMethods}
                bnplPlans={bnplPlans}
                initial={{
                  date: todayISO(),
                  amountCents: confirming.expectedCents ?? undefined,
                  description: confirming.description,
                  categoryId: confirming.categoryId,
                  paymentMethodId: confirming.paymentMethodId,
                }}
                submitLabel="Log transaction"
                pending={pending}
                onSubmit={handleConfirm}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
