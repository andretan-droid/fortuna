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
import { todayISO, formatMonthLong } from "@/lib/dates";
import { providerColor } from "@/lib/colors";
import { Chip } from "@/components/ui/chip";
import { createBnplPlan, updateBnplPlan, deleteBnplPlan } from "@/server/actions/debts";
import { instalmentAtCents, dueInYearCents, type BnplPlanState, type BnplPlanInput } from "@/lib/bnpl";

type Opt = { id: string; name: string };

/** Add / edit a BNPL plan. Same Dialog shape as settings' RuleEditor. Progress
 *  (paid/outstanding) isn't editable here — it's derived from linked ledger
 *  transactions — so the form only owns the plan's static terms. */
export function PlanEditor({
  plan,
  categories,
  paymentMethods,
  onClose,
  onPay,
}: {
  plan: BnplPlanState | "new" | null;
  categories: Opt[];
  paymentMethods: Opt[];
  onClose: () => void;
  onPay?: (p: BnplPlanState) => void;
}) {
  const editing = plan !== null && plan !== "new" ? plan : null;
  const [pending, startTransition] = useTransition();

  const [item, setItem] = useState(editing?.item ?? "");
  const [platform, setPlatform] = useState(editing?.platform ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [total, setTotal] = useState(
    editing ? formatAmount(editing.totalAmountCents) : "",
  );
  const [n, setN] = useState(editing ? String(editing.nInstalments) : "3");
  const [instalment, setInstalment] = useState(
    editing?.instalmentCents ? formatAmount(editing.instalmentCents) : "",
  );
  const [firstDueMonth, setFirstDueMonth] = useState(
    (editing?.firstDueMonth ?? "").slice(0, 7),
  );
  const [paymentMethodId, setPaymentMethodId] = useState(editing?.paymentMethodId ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  // Live "N × RM.." preview from the form fields — works for new plans (no
  // BnplPlanState yet) and re-derives as the user retypes total/instalments.
  const totalPreviewCents = toCents(total) ?? 0;
  const nPreview = Number(n) || 1;
  const instalPreviewCents = instalment.trim() !== "" ? (toCents(instalment) ?? 0) : 0;
  const previewPlan: BnplPlanInput = {
    id: "preview",
    item: "",
    platform: null,
    totalAmountCents: totalPreviewCents,
    nInstalments: nPreview,
    instalmentCents: instalPreviewCents,
    firstDueMonth: null,
    status: "",
  };
  const firstInstal = instalmentAtCents(previewPlan, 1);
  const lastInstal = instalmentAtCents(previewPlan, nPreview);
  const schedulePreview =
    nPreview <= 1
      ? formatCents(totalPreviewCents)
      : firstInstal === lastInstal
        ? `${nPreview} × ${formatCents(firstInstal)}`
        : `${nPreview - 1} × ${formatCents(firstInstal)} + ${formatCents(lastInstal)}`;
  const yearTotal = editing ? dueInYearCents(editing, todayISO().slice(0, 4)) : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item.trim()) return void toast.error("Enter an item name");
    if (!categoryId) return void toast.error("Pick a category");
    const totalC = toCents(total);
    if (totalC == null || totalC < 0) return void toast.error("Enter a valid total");
    const nN = Number(n);
    if (!Number.isInteger(nN) || nN < 1) return void toast.error("Instalments must be ≥ 1");
    let instalC = 0;
    if (instalment.trim() !== "") {
      const c = toCents(instalment);
      if (c == null || c < 0) return void toast.error("Enter a valid instalment");
      instalC = c;
    }

    const payload = {
      item: item.trim(),
      platform: platform.trim() || null,
      categoryId,
      totalAmountCents: totalC,
      nInstalments: nN,
      instalmentCents: instalC,
      firstDueMonth: firstDueMonth || null,
      paymentMethodId: paymentMethodId || null,
      notes: notes.trim() || null,
    };
    startTransition(async () => {
      const res = editing
        ? await updateBnplPlan(editing.id, payload)
        : await createBnplPlan(payload);
      if (res.ok) {
        toast.success(editing ? "Plan saved" : "Plan added");
        onClose();
      } else toast.error(res.error);
    });
  }

  function handleDelete() {
    if (!editing) return;
    startTransition(async () => {
      const res = await deleteBnplPlan(editing.id);
      if (res.ok) {
        toast.success(`"${editing.item}" deleted`);
        onClose();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={plan !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            {editing ? "Edit plan" : "New BNPL plan"}
            {editing?.platform && <Chip label={editing.platform} tone={providerColor(editing.platform)} />}
          </DialogTitle>
          <DialogDescription>
            Buy-Now-Pay-Later terms. Payments are tracked automatically from linked
            transactions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bp-item">Item</Label>
            <Input
              id="bp-item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              required
              autoComplete="off"
              placeholder="e.g. Spigen Case"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bp-platform">Platform</Label>
              <Input
                id="bp-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                autoComplete="off"
                placeholder="Shopee, Atome…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-cat">Category</Label>
              <select
                id="bp-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none"
              >
                <option value="">Pick…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bp-total">Total (RM)</Label>
              <Input
                id="bp-total"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-n">Instalments</Label>
              <Input
                id="bp-n"
                value={n}
                onChange={(e) => setN(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-instal">Per month</Label>
              <Input
                id="bp-instal"
                value={instalment}
                onChange={(e) => setInstalment(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="Auto"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Schedule: {schedulePreview}
            {editing && editing.nextDue && (
              <>
                {" · "}
                <span
                  className={
                    editing.nextDue < todayISO().slice(0, 7) ? "font-medium text-destructive" : ""
                  }
                >
                  Next due {formatMonthLong(editing.nextDue)}
                </span>
              </>
            )}
            {editing && yearTotal > 0 && (
              <>
                {" · "}
                {formatCents(yearTotal)} payable this year
              </>
            )}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bp-firstdue">First due month</Label>
              {/* ponytail: native month input over a picker lib — value is YYYY-MM */}
              <Input
                id="bp-firstdue"
                type="month"
                value={firstDueMonth}
                onChange={(e) => setFirstDueMonth(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-method">Payment method</Label>
              <select
                id="bp-method"
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bp-notes">Notes</Label>
            <Input
              id="bp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoComplete="off"
              placeholder="Optional"
            />
          </div>
          {editing && !editing.done && onPay && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => {
                onPay(editing);
                onClose();
              }}
            >
              Record payment
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" size="lg" disabled={pending} className="flex-1">
              {pending ? "Saving…" : editing ? "Save changes" : "Add plan"}
            </Button>
            {editing && (
              <Button
                type="button"
                size="lg"
                variant="ghost"
                disabled={pending}
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
              >
                Delete
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
