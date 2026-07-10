"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toCents, formatAmount, formatCents } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { providerColor } from "@/lib/colors";
import { Chip } from "@/components/ui/chip";
import { instalmentAtCents } from "@/lib/bnpl";
import { recordBnplPayment } from "@/server/actions/debts";
import type { BnplPlanState } from "@/lib/bnpl";

type Opt = { id: string; name: string };

/** Small dialog: log one BNPL instalment as a linked Expense transaction.
 *  Amount defaults to the next instalment (final absorbs rounding) but stays
 *  editable — partial or extra payments are still just a transaction. */
export function RecordPayment({
  plan,
  paymentMethods,
  onClose,
}: {
  plan: BnplPlanState | null;
  paymentMethods: Opt[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const nextIndex = (plan?.paid ?? 0) + 1;
  const defaultAmount = plan ? instalmentAtCents(plan, nextIndex) : 0;

  const [amount, setAmount] = useState(formatAmount(defaultAmount));
  const [date, setDate] = useState(todayISO());
  const [paymentMethodId, setPaymentMethodId] = useState(plan?.paymentMethodId ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan) return;
    const amountCents = toCents(amount);
    if (amountCents == null || amountCents < 0) return void toast.error("Enter a valid amount");

    startTransition(async () => {
      const res = await recordBnplPayment(plan.id, {
        date,
        amountCents,
        paymentMethodId: paymentMethodId || null,
      });
      if (res.ok) {
        toast.success(`Instalment ${nextIndex} of ${plan.n} recorded`);
        onClose();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={plan !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {plan && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-2xl">
                Record payment
                {plan.platform && <Chip label={plan.platform} tone={providerColor(plan.platform)} />}
              </DialogTitle>
              <DialogDescription>
                {plan.item} · Instalment {nextIndex} of {plan.n}
                {" · "}
                {formatCents(plan.outstanding)} outstanding
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rp-amount">Amount (RM)</Label>
                  <Input
                    id="rp-amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp-date">Date</Label>
                  <Input
                    id="rp-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-method">Payment method</Label>
                <select
                  id="rp-method"
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                  className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none"
                >
                  <option value="">Default</option>
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Recording…" : "Record payment"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
