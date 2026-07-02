"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { formatCents, toCents, formatAmount } from "@/lib/money";
import { deleteSinkingFund, saveSinkingFund } from "@/server/actions/settings";
import type { SinkingFundRow } from "@/server/queries/settings";
import { SettingsSection } from "./section";

type CategoryOpt = { id: string; name: string };

function FundEditor({
  fund, // null = closed, "new" = create
  categories,
  onClose,
}: {
  fund: SinkingFundRow | "new" | null;
  categories: CategoryOpt[];
  onClose: () => void;
}) {
  const editing = fund !== null && fund !== "new" ? fund : null;
  const [pending, startTransition] = useTransition();

  const money = (c: number | null | undefined) => (c != null ? formatAmount(c) : "");
  const [name, setName] = useState(editing?.name ?? "");
  const [annual, setAnnual] = useState(money(editing?.annualTargetCents));
  const [monthly, setMonthly] = useState(money(editing?.monthlyAccrualCents));
  const [opening, setOpening] = useState(money(editing?.openingBalanceCents ?? 0));
  const [matchCategoryId, setMatchCategoryId] = useState(editing?.matchCategoryId ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parse = (v: string): number | null | undefined =>
      v.trim() === "" ? null : (toCents(v) ?? undefined);
    const annualC = parse(annual);
    const monthlyC = parse(monthly);
    const openingC = opening.trim() === "" ? 0 : toCents(opening);
    if (annualC === undefined || monthlyC === undefined || openingC == null)
      return void toast.error("Enter valid amounts");

    startTransition(async () => {
      const res = await saveSinkingFund(editing?.id ?? null, {
        name: name.trim(),
        annualTargetCents: annualC,
        monthlyAccrualCents: monthlyC,
        matchCategoryId: matchCategoryId || null,
        openingBalanceCents: openingC,
        active: editing?.active ?? true,
      });
      if (res.ok) {
        toast.success(editing ? "Saved" : "Fund created");
        onClose();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={fund !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editing ? "Edit sinking fund" : "New sinking fund"}
          </DialogTitle>
          <DialogDescription>
            Accrues monthly toward an annual target; matched spend draws it down.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sf-name">Name</Label>
            <Input id="sf-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" placeholder="e.g. Car insurance" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sf-annual">Annual target (RM)</Label>
              <Input id="sf-annual" value={annual} onChange={(e) => setAnnual(e.target.value)} inputMode="decimal" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sf-monthly">Monthly accrual (RM)</Label>
              <Input id="sf-monthly" value={monthly} onChange={(e) => setMonthly(e.target.value)} inputMode="decimal" autoComplete="off" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sf-opening">Opening balance (RM)</Label>
              <Input id="sf-opening" value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sf-match">Match category</Label>
              <select
                id="sf-match"
                value={matchCategoryId}
                onChange={(e) => setMatchCategoryId(e.target.value)}
                className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create fund"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SinkingManager({
  rows,
  categories,
}: {
  rows: SinkingFundRow[];
  categories: CategoryOpt[];
}) {
  const [editing, setEditing] = useState<SinkingFundRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;

  return (
    <SettingsSection
      title="Sinking funds"
      description="Set-aside pots that accrue monthly (insurance, road tax, travel)."
    >
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> New fund
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No sinking funds yet.
          </p>
        )}
        {rows.map((f) => (
          <div
            key={f.id}
            className={cn("flex items-center gap-2 px-4 py-2.5", !f.active && "opacity-50")}
          >
            <button
              type="button"
              onClick={() => setEditing(f)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-sm font-medium underline-offset-4 hover:underline">
                {f.name}
              </span>
              <span className="tabular block text-xs text-muted-foreground">
                {f.monthlyAccrualCents != null && `${formatCents(f.monthlyAccrualCents, "RM")}/mo`}
                {f.annualTargetCents != null &&
                  ` → ${formatCents(f.annualTargetCents, "RM")}/yr`}
                {catName(f.matchCategoryId) && ` · matches ${catName(f.matchCategoryId)}`}
              </span>
            </button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              className="text-destructive hover:text-destructive"
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteSinkingFund(f.id);
                  if (res.ok) toast.success(`"${f.name}" deleted`);
                  else toast.error(res.error);
                })
              }
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
      <FundEditor
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        fund={editing}
        categories={categories}
        onClose={() => setEditing(null)}
      />
    </SettingsSection>
  );
}
