"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCreateTransaction } from "@/hooks/use-transactions";
import type { FeedFilters } from "@/server/queries/transactions";
import { TxnForm, type BnplOption, type CategoryOption, type SimpleOption } from "./txn-form";

/** FAB + Sheet quick-log. Optimistic: the row lands in the feed the instant
 *  you hit Log; rollback + toast on failure. */
export function QuickLog({
  filters,
  categories,
  paymentMethods,
  bnplPlans,
}: {
  filters: FeedFilters;
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
  bnplPlans: BnplOption[];
}) {
  const [open, setOpen] = useState(false);
  const create = useCreateTransaction(filters, {
    category: (id) => categories.find((c) => c.id === id),
    paymentMethod: (id) =>
      id ? (paymentMethods.find((m) => m.id === id)?.name ?? null) : null,
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon-lg"
          aria-label="Log a transaction"
          className="interactive fixed bottom-24 right-5 z-40 size-14 rounded-full shadow-lg lg:bottom-10 lg:right-10"
        >
          <Plus className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Quick log</SheetTitle>
          <SheetDescription>Amount first — everything else is two taps.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8">
          <TxnForm
            categories={categories}
            paymentMethods={paymentMethods}
            bnplPlans={bnplPlans}
            submitLabel="Log transaction"
            pending={create.isPending}
            onSubmit={(input) => {
              setOpen(false); // optimistic row is already visible behind the sheet
              create.mutate(input, {
                onError: (err) => toast.error(err.message || "Could not log transaction"),
              });
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
