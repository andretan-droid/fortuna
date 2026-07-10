"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useSetTransactionDeleted,
  useUpdateTransaction,
} from "@/hooks/use-transactions";
import type { FeedRow } from "@/server/queries/transactions";
import { TxnForm, type BnplOption, type CategoryOption, type SimpleOption } from "./txn-form";

/** Edit dialog — same TxnForm, prefilled, plus soft-delete / restore. */
export function TxnEditor({
  row,
  onClose,
  categories,
  paymentMethods,
  bnplPlans,
}: {
  row: FeedRow | null;
  onClose: () => void;
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
  bnplPlans: BnplOption[];
}) {
  const update = useUpdateTransaction();
  const setDeleted = useSetTransactionDeleted();

  // getBnplPlanOptions excludes completed plans, so an old transaction linked
  // to a now-finished plan needs its plan synthesized back in — otherwise the
  // combobox would show it blank and re-saving would silently drop the link.
  const effectiveBnplPlans = useMemo(() => {
    if (!row?.bnplPlanId || !row.bnpl) return bnplPlans;
    if (bnplPlans.some((p) => p.id === row.bnplPlanId)) return bnplPlans;
    return [
      ...bnplPlans,
      {
        id: row.bnplPlanId,
        item: row.bnpl.item,
        platform: null,
        nInstalments: row.bnpl.nInstalments,
        instalmentCents: row.bnpl.instalmentCents,
      },
    ];
  }, [bnplPlans, row]);

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {row.deleted ? "Deleted transaction" : "Edit transaction"}
              </DialogTitle>
              <DialogDescription>
                {row.date} · {row.category}
              </DialogDescription>
            </DialogHeader>
            <TxnForm
              key={row.id} // remount per row → clean field state
              categories={categories}
              paymentMethods={paymentMethods}
              bnplPlans={effectiveBnplPlans}
              initial={{
                date: row.date,
                amountCents: row.amountCents,
                description: row.description ?? "",
                categoryId: row.categoryId,
                paymentMethodId: row.paymentMethodId,
                bnplPlanId: row.bnplPlanId,
              }}
              submitLabel="Save changes"
              pending={update.isPending}
              onSubmit={(input) =>
                update.mutate(
                  { id: row.id, input },
                  {
                    onSuccess: () => {
                      toast.success("Saved");
                      onClose();
                    },
                    onError: (err) => toast.error(err.message || "Save failed"),
                  },
                )
              }
            />
            <Button
              variant={row.deleted ? "secondary" : "ghost"}
              className={row.deleted ? "" : "text-destructive hover:text-destructive"}
              disabled={setDeleted.isPending}
              onClick={() =>
                setDeleted.mutate(
                  { id: row.id, deleted: !row.deleted },
                  {
                    onSuccess: () => {
                      toast.success(row.deleted ? "Restored" : "Moved to deleted");
                      onClose();
                    },
                    onError: (err) => toast.error(err.message || "Failed"),
                  },
                )
              }
            >
              {row.deleted ? "Restore transaction" : "Delete transaction"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
