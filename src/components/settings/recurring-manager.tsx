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
import { AMOUNT_KINDS } from "@/db/schema";
import { deleteRecurringRule, saveRecurringRule } from "@/server/actions/settings";
import type { RecurringRuleRow } from "@/server/queries/settings";
import type { RecurringStatusRow } from "@/server/queries/recurring";
import { SettingsSection } from "./section";

type Opt = { id: string; name: string };
const CADENCES = [
  { value: "1", label: "Monthly" },
  { value: "3", label: "Quarterly" },
  { value: "12", label: "Yearly" },
] as const;

const STATUS_CHIP: Record<RecurringStatusRow["status"], { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-income/15 text-income" },
  due: { label: "Due", className: "bg-muted text-muted-foreground" },
  missed: { label: "Missed", className: "bg-destructive/15 text-destructive" },
};

function RuleEditor({
  rule,
  categories,
  paymentMethods,
  onClose,
}: {
  rule: RecurringRuleRow | "new" | null;
  categories: Opt[];
  paymentMethods: Opt[];
  onClose: () => void;
}) {
  const editing = rule !== null && rule !== "new" ? rule : null;
  const [pending, startTransition] = useTransition();

  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [expected, setExpected] = useState(
    editing?.expectedCents != null ? formatAmount(editing.expectedCents) : "",
  );
  const [paymentMethodId, setPaymentMethodId] = useState(editing?.paymentMethodId ?? "");
  const [day, setDay] = useState(editing?.day != null ? String(editing.day) : "");
  // legacy tolerance values: 0.01 (strict) / 0.05 (loose)
  const [tolerance, setTolerance] = useState(editing?.tolerance ?? "0.05");
  const [amountKind, setAmountKind] = useState(editing?.amountKind ?? "fixed");
  const [cadence, setCadence] = useState(String(editing?.intervalMonths ?? 1));
  const [startMonth, setStartMonth] = useState((editing?.startMonth ?? "").slice(0, 7));
  const [endMonth, setEndMonth] = useState((editing?.endMonth ?? "").slice(0, 7));
  const [notes, setNotes] = useState(editing?.notes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) return void toast.error("Pick a category");
    let expectedC: number | null = null;
    if (expected.trim() !== "") {
      const c = toCents(expected);
      if (c == null || c < 0) return void toast.error("Enter a valid expected amount");
      expectedC = c;
    }
    let dayN: number | null = null;
    if (day.trim() !== "") {
      dayN = Number(day);
      if (!Number.isInteger(dayN) || dayN < 1 || dayN > 31)
        return void toast.error("Day must be 1–31");
    }

    startTransition(async () => {
      const res = await saveRecurringRule(editing?.id ?? null, {
        description: description.trim(),
        categoryId,
        expectedCents: expectedC,
        paymentMethodId: paymentMethodId || null,
        day: dayN,
        tolerance: tolerance ? Number(tolerance) : null,
        active: editing?.active ?? true,
        amountKind,
        intervalMonths: Number(cadence),
        startMonth: startMonth || null,
        endMonth: endMonth || null,
        notes: notes.trim() || null,
      });
      if (res.ok) {
        toast.success(editing ? "Saved" : "Rule created");
        onClose();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={rule !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editing ? "Edit recurring rule" : "New recurring rule"}
          </DialogTitle>
          <DialogDescription>
            Expected monthly bills, checked against this month&apos;s ledger. Missed or
            still-due bills are flagged on the dashboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="rr-desc">Description</Label>
            <Input id="rr-desc" value={description} onChange={(e) => setDescription(e.target.value)} required autoComplete="off" placeholder="e.g. Netflix, TNB bill" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rr-cat">Category</Label>
              <select
                id="rr-cat"
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
            <div className="space-y-1.5">
              <Label htmlFor="rr-method">Payment method</Label>
              <select
                id="rr-method"
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none"
              >
                <option value="">Any</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rr-expected">Expected (RM)</Label>
              <Input id="rr-expected" value={expected} onChange={(e) => setExpected(e.target.value)} inputMode="decimal" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-day">Day of month</Label>
              <Input id="rr-day" value={day} onChange={(e) => setDay(e.target.value)} inputMode="numeric" placeholder="1–31" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-tolerance">Tolerance</Label>
              <select
                id="rr-tolerance"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none"
              >
                <option value="0.01">±1%</option>
                <option value="0.05">±5%</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rr-kind">Amount</Label>
              <select
                id="rr-kind"
                value={amountKind}
                onChange={(e) => setAmountKind(e.target.value as (typeof AMOUNT_KINDS)[number])}
                className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none"
              >
                {AMOUNT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k === "fixed" ? "Fixed" : k === "estimated" ? "Estimated" : "Variable"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-cadence">Cadence</Label>
              <select
                id="rr-cadence"
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
                className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none"
              >
                {CADENCES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rr-start">Start month</Label>
              {/* ponytail: native month input over a picker lib — value is YYYY-MM */}
              <Input
                id="rr-start"
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-end">End month</Label>
              <Input
                id="rr-end"
                type="month"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rr-notes">Notes</Label>
            <Input
              id="rr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoComplete="off"
              placeholder="Optional"
            />
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create rule"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecurringManager({
  rows,
  categories,
  paymentMethods,
  statuses = [],
}: {
  rows: RecurringRuleRow[];
  categories: Opt[];
  paymentMethods: Opt[];
  statuses?: RecurringStatusRow[];
}) {
  const [editing, setEditing] = useState<RecurringRuleRow | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "?";
  const statusById = new Map(statuses.map((s) => [s.id, s.status]));

  return (
    <SettingsSection
      title="Recurring rules"
      description="Known monthly bills, checked against this month's ledger."
    >
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> New rule
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No recurring rules yet.
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className={cn("flex items-center gap-2 px-4 py-2.5", !r.active && "opacity-50")}
          >
            <button type="button" onClick={() => setEditing(r)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium underline-offset-4 hover:underline">
                {r.description}
              </span>
              <span className="tabular block text-xs text-muted-foreground">
                {catName(r.categoryId)}
                {r.expectedCents != null && ` · ${formatCents(r.expectedCents, "RM")}`}
                {r.day != null && ` · day ${r.day}`}
              </span>
            </button>
            {r.active &&
              statusById.has(r.id) &&
              (() => {
                const chip = STATUS_CHIP[statusById.get(r.id)!];
                return (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      chip.className,
                    )}
                  >
                    {chip.label}
                  </span>
                );
              })()}
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              className="text-destructive hover:text-destructive"
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteRecurringRule(r.id);
                  if (res.ok) toast.success(`"${r.description}" deleted`);
                  else toast.error(res.error);
                })
              }
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
      <RuleEditor
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        rule={editing}
        categories={categories}
        paymentMethods={paymentMethods}
        onClose={() => setEditing(null)}
      />
    </SettingsSection>
  );
}
