"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toCents, formatAmount } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import type { TxnInput } from "@/server/actions/transactions";

export type CategoryOption = {
  id: string;
  name: string;
  mainCategory: string | null;
  type: "Income" | "Expense" | "Deduction" | "Transfer";
  framework: string;
};
export type SimpleOption = { id: string; name: string; kind?: string };
export type BnplOption = {
  id: string;
  item: string;
  platform: string | null;
  nInstalments: number;
  instalmentCents: number;
};

/* Generic searchable combobox: Popover + Command (the plan's pattern; no new
   select primitive needed). */
function OptionCombobox({
  value,
  onChange,
  options,
  placeholder,
  allowClear,
  id,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string; hint?: string; group?: string }[];
  placeholder: string;
  allowClear?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  // Partition into labelled groups, preserving first-seen order. When no option
  // carries a group, this collapses to a single unlabelled group (prior behaviour).
  const grouped = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, typeof options>();
    for (const o of options) {
      const g = o.group ?? "";
      if (!byGroup.has(g)) {
        byGroup.set(g, []);
        order.push(g);
      }
      byGroup.get(g)!.push(o);
    }
    return order.map((g) => ({ heading: g, items: byGroup.get(g)! }));
  }, [options]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            {allowClear && selected && (
              <CommandGroup>
                <CommandItem
                  value="__clear"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Clear selection
                </CommandItem>
              </CommandGroup>
            )}
            {grouped.map((grp) => (
              <CommandGroup key={grp.heading || "_"} heading={grp.heading || undefined}>
                {grp.items.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        o.value === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{o.label}</span>
                    {o.hint && (
                      <span className="ml-auto text-xs text-muted-foreground">{o.hint}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Shared transaction form — quick-log Sheet and editor Dialog both render
 *  this, so field logic and the ⚡ derivation preview live once. */
export function TxnForm({
  categories,
  paymentMethods,
  bnplPlans,
  initial,
  submitLabel,
  pending,
  onSubmit,
}: {
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
  bnplPlans: BnplOption[];
  initial?: Partial<TxnInput>;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: TxnInput) => void;
}) {
  const [amount, setAmount] = useState(
    initial?.amountCents != null ? formatAmount(initial.amountCents) : "",
  );
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(
    initial?.paymentMethodId ?? null,
  );
  const [bnplPlanId, setBnplPlanId] = useState<string | null>(initial?.bnplPlanId ?? null);
  const [error, setError] = useState<string | null>(null);

  const category = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = toCents(amount);
    if (cents == null || cents < 0) return setError("Enter a valid amount");
    if (!categoryId) return setError("Pick a category");
    setError(null);
    onSubmit({
      date,
      amountCents: cents,
      description: description.trim(),
      categoryId,
      paymentMethodId,
      bnplPlanId,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Amount first — the sheet's muscle memory. Oversized editorial serif. */}
      <div className="space-y-1.5">
        <Label htmlFor="txn-amount">Amount (RM)</Label>
        <div className="flex items-baseline gap-2 border-b pb-1">
          <span className="font-display text-xl text-muted-foreground">RM</span>
          <input
            id="txn-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? "txn-form-error" : undefined}
            className="tabular font-display w-full bg-transparent text-4xl outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="txn-date">Date</Label>
          {/* ponytail: native date input over a picker lib */}
          <Input
            id="txn-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="txn-method">Payment method</Label>
          <OptionCombobox
            id="txn-method"
            value={paymentMethodId}
            onChange={setPaymentMethodId}
            options={paymentMethods.map((m) => ({ value: m.id, label: m.name, group: m.kind }))}
            placeholder="Optional"
            allowClear
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="txn-category">Category</Label>
        <OptionCombobox
          id="txn-category"
          value={categoryId}
          onChange={setCategoryId}
          options={categories.map((c) => ({
            value: c.id,
            label: c.name,
            hint: c.mainCategory ?? undefined,
          }))}
          placeholder="Pick a subcategory"
        />
        {/* The sheet's ⚡ derived columns, previewed live. */}
        {category && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{category.type}</span>
            {" · "}
            {category.mainCategory ?? "—"}
            {" · "}
            {category.framework}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="txn-desc">Description</Label>
        <Input
          id="txn-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Nasi lemak, TNB bill…"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="txn-bnpl">BNPL plan</Label>
        <OptionCombobox
          id="txn-bnpl"
          value={bnplPlanId}
          onChange={setBnplPlanId}
          options={bnplPlans.map((p) => ({
            value: p.id,
            label: p.item,
            hint: `${p.nInstalments}×`,
          }))}
          placeholder={bnplPlans.length ? "Optional — link an instalment" : "No plans yet"}
          allowClear
        />
      </div>

      {error && (
        <p id="txn-form-error" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="mt-1">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
