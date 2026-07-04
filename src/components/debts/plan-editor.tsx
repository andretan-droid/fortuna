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
import { toCents, formatAmount } from "@/lib/money";
import { createBnplPlan, updateBnplPlan, deleteBnplPlan } from "@/server/actions/debts";
import type { BnplPlanState } from "@/lib/bnpl";

type Opt = { id: string; name: string };

/** Add / edit a BNPL plan. Same Dialog shape as settings' RuleEditor. Progress
 *  (paid/outstanding) isn't editable here — it's derived from linked ledger
 *  transactions — so the form only owns the plan's static terms. */
export function PlanEditor({
  plan,
  categories,
  onClose,
}: {
  plan: BnplPlanState | "new" | null;
  categories: Opt[];
  onClose: () => void;
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
  const [notes, setNotes] = useState(editing?.notes ?? "");

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
          <DialogTitle className="font-display text-2xl">
            {editing ? "Edit plan" : "New BNPL plan"}
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
            <Label htmlFor="bp-notes">Notes</Label>
            <Input
              id="bp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoComplete="off"
              placeholder="Optional"
            />
          </div>
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
