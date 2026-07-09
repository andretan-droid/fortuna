"use client";

import { type ReactNode, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { createTransactionsBatch } from "@/server/actions/transactions";
import { txnKeys } from "@/hooks/use-transactions";
import {
  buildLookups,
  parsePaste,
  validateRow,
  emptyDraft,
  type DraftRow,
} from "@/lib/batch-parse";
import type { CategoryOption, SimpleOption } from "./txn-form";

const selectClass =
  // text-base on mobile (≥16px) stops iOS Safari auto-zooming the page on tap;
  // md:text-sm keeps the compact desktop size (mirrors ui/input.tsx).
  "border-input bg-transparent h-8 w-full min-w-28 rounded-md border px-2 text-base md:text-sm outline-none focus:ring-2 focus:ring-ring";

/** "Batch add" button + full-height sheet: paste rows from Excel/Notes into the
 *  box, or type straight into the grid. Every row validates live; bad rows are
 *  flagged but don't block the good ones. "Add N" commits the valid rows atomically. */
export function BatchAdd({
  categories,
  paymentMethods,
}: {
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([emptyDraft()]);
  const [paste, setPaste] = useState("");
  const [pending, startTransition] = useTransition();
  const qc = useQueryClient();

  const { catByName, methodByName } = useMemo(
    () => buildLookups(categories, paymentMethods),
    [categories, paymentMethods],
  );
  const validated = useMemo(
    () => rows.map((r) => validateRow(r, catByName, methodByName)),
    [rows, catByName, methodByName],
  );
  const validCount = validated.filter((v) => v.errors.length === 0).length;

  const setCell = (i: number, field: keyof DraftRow, value: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyDraft()]);
  const removeRow = (i: number) =>
    setRows((rs) => (rs.length === 1 ? [emptyDraft()] : rs.filter((_, j) => j !== i)));

  function handleParse() {
    const parsed = parsePaste(paste);
    if (!parsed.length) return void toast.error("Nothing to parse — paste some rows first");
    // Drop a single pristine starter row so a fresh paste doesn't leave a blank on top.
    setRows((rs) => {
      const base = rs.length === 1 && isPristine(rs[0]) ? [] : rs;
      return [...base, ...parsed];
    });
    setPaste("");
    toast.success(`Added ${parsed.length} row${parsed.length === 1 ? "" : "s"} to the grid`);
  }

  function reset() {
    setRows([emptyDraft()]);
    setPaste("");
  }

  function commit() {
    const items = validated
      .filter((v) => v.errors.length === 0)
      .map((v) => ({
        date: v.date,
        amountCents: v.amountCents!,
        description: v.draft.description.trim(),
        categoryId: v.categoryId!,
        paymentMethodId: v.paymentMethodId,
      }));
    if (!items.length) return void toast.error("No valid rows to add");

    startTransition(async () => {
      const res = await createTransactionsBatch(items);
      if (res.ok) {
        toast.success(`Added ${res.count} transaction${res.count === 1 ? "" : "s"}`);
        qc.invalidateQueries({ queryKey: txnKeys.all });
        reset();
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardPaste className="size-4" /> Batch add
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="pr-10">
          <SheetTitle className="font-display text-2xl">Batch add transactions</SheetTitle>
          <SheetDescription>
            Paste rows (date ⇥ amount ⇥ description ⇥ category ⇥ method) or type into the
            grid. Category and method match by name, case-insensitive.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-8">
          {/* Paste box */}
          <div className="space-y-2">
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              aria-label="Paste transactions"
              rows={4}
              placeholder={"2026-07-01\t12.50\tNasi lemak\tFood\tCash\n2026-07-01\t6.00\tKopi\tFood\tCash"}
              // text-base on mobile stops iOS auto-zoom on focus; md:text-xs keeps the compact paste look on desktop.
              className="w-full resize-y rounded-md border border-input bg-transparent p-3 font-mono text-base outline-none focus:ring-2 focus:ring-ring md:text-xs"
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleParse}>
              <ClipboardPaste className="size-4" /> Parse into grid
            </Button>
          </div>

          {/* Editable grid — a fixed-width table overflowed the phone sheet, hiding
           *  Category/Method off-screen. So: stacked labelled cards on mobile (every
           *  field full-width and reachable), and the horizontal table-style row on
           *  ≥sm where the sheet (and landscape) are wide enough. */}
          <div className="rounded-lg border border-border">
            {/* Column headers only apply to the ≥sm horizontal row layout. */}
            <div className="hidden border-b border-border px-1.5 py-2 text-xs uppercase tracking-wider text-muted-foreground sm:flex sm:gap-2">
              <div className="w-36 px-1">Date</div>
              <div className="w-24 px-1">Amount</div>
              <div className="flex-1 px-1">Description</div>
              <div className="w-36 px-1">Category</div>
              <div className="w-32 px-1">Method</div>
              <div className="w-6" />
            </div>
            {rows.map((r, i) => {
              const v = validated[i];
              const bad = v.errors.length > 0 && !isPristine(r);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-2 border-b border-border/60 p-3 last:border-b-0",
                    "sm:flex-row sm:items-start sm:gap-2 sm:p-1.5",
                    bad && "bg-destructive/5",
                  )}
                >
                  <GridField label="Date" className="sm:w-36">
                    <Input
                      type="date"
                      value={r.date}
                      onChange={(e) => setCell(i, "date", e.target.value)}
                      className="h-9 w-full sm:h-8"
                      aria-label={`Row ${i + 1} date`}
                    />
                  </GridField>
                  <GridField label="Amount" className="sm:w-24">
                    <Input
                      value={r.amount}
                      onChange={(e) => setCell(i, "amount", e.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="tabular h-9 w-full text-right sm:h-8"
                      aria-label={`Row ${i + 1} amount`}
                    />
                  </GridField>
                  <GridField label="Description" className="sm:flex-1">
                    <Input
                      value={r.description}
                      onChange={(e) => setCell(i, "description", e.target.value)}
                      placeholder="Optional"
                      className="h-9 w-full sm:h-8"
                      aria-label={`Row ${i + 1} description`}
                    />
                  </GridField>
                  <GridField label="Category" className="sm:w-36">
                    <select
                      value={v.categoryId ?? ""}
                      onChange={(e) => {
                        const cat = categories.find((c) => c.id === e.target.value);
                        setCell(i, "category", cat?.name ?? "");
                      }}
                      className={cn(selectClass, !v.categoryId && "text-muted-foreground")}
                      aria-label={`Row ${i + 1} category`}
                    >
                      <option value="">
                        {r.category && !v.categoryId ? `? ${r.category}` : "Pick…"}
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </GridField>
                  <GridField label="Method" className="sm:w-32">
                    <select
                      value={v.paymentMethodId ?? ""}
                      onChange={(e) => {
                        const m = paymentMethods.find((p) => p.id === e.target.value);
                        setCell(i, "method", m?.name ?? "");
                      }}
                      className={cn(selectClass, !v.paymentMethodId && "text-muted-foreground")}
                      aria-label={`Row ${i + 1} payment method`}
                    >
                      <option value="">
                        {r.method && !v.paymentMethodId ? `? ${r.method}` : "None"}
                      </option>
                      {paymentMethods.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </GridField>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label={`Remove row ${i + 1}`}
                    className="flex items-center gap-1 self-end text-sm text-muted-foreground hover:text-destructive sm:w-6 sm:self-auto sm:pt-2"
                  >
                    <Trash2 className="size-4" />
                    <span className="sm:hidden">Remove row</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Row-level error reasons (only for non-pristine rows) */}
          {validated.some((v, i) => v.errors.length && !isPristine(rows[i])) && (
            <ul className="space-y-1 text-xs text-destructive">
              {validated.map((v, i) =>
                v.errors.length && !isPristine(rows[i]) ? (
                  <li key={i}>
                    Row {i + 1}: {v.errors.join(" · ")}
                  </li>
                ) : null,
              )}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={addRow}>
              <Plus className="size-4" /> Add row
            </Button>
            <Button type="button" size="lg" disabled={pending || validCount === 0} onClick={commit}>
              {pending ? "Adding…" : `Add ${validCount} transaction${validCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** One field of a batch row. On mobile the row is a stacked card, so each field
 *  shows its own label above a full-width control; on ≥sm the label is hidden and
 *  the header row labels the columns instead. */
function GridField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground sm:hidden">
        {label}
      </span>
      {children}
    </label>
  );
}

/** A row the user hasn't touched yet — today's date, everything else blank. Kept
 *  out of the error list and dropped on the first paste so it never blocks commit. */
function isPristine(r: DraftRow): boolean {
  return !r.amount.trim() && !r.description.trim() && !r.category.trim() && !r.method.trim();
}
