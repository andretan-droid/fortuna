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
import {
  createCategory,
  updateCategory,
  type CategoryInput,
} from "@/server/actions/categories";
import type { CategoryRow } from "@/server/queries/categories";

const TYPES = ["Income", "Expense", "Deduction", "Transfer"] as const;
const EXPENSE_FRAMEWORKS = ["Needs", "Wants", "Savings"] as const;

/** Create/edit dialog. Legacy rule enforced in the UI too: framework mirrors
 *  type unless type is Expense, which splits into Needs/Wants/Savings. */
const NEW_GROUP = "__new_group__";

export function CategoryEditor({
  row, // null = closed, "new" = create, CategoryRow = edit
  groups,
  onClose,
}: {
  row: CategoryRow | "new" | null;
  groups: string[];
  onClose: () => void;
}) {
  const editing = row !== null && row !== "new" ? row : null;
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(editing?.name ?? "");
  const [mainCategory, setMainCategory] = useState(editing?.mainCategory ?? "");
  const [type, setType] = useState<CategoryInput["type"]>(editing?.type ?? "Expense");
  const [framework, setFramework] = useState(editing?.framework ?? "Needs");
  const [budget, setBudget] = useState(
    editing && editing.monthlyBudgetCents > 0 ? formatAmount(editing.monthlyBudgetCents) : "",
  );
  const [error, setError] = useState<string | null>(null);
  // "New group…" reveals a free-text input; otherwise pick an existing group.
  const [creatingGroup, setCreatingGroup] = useState(false);

  function handleType(t: CategoryInput["type"]) {
    setType(t);
    // ⚡ framework follows type; Expense keeps the current N/W/S pick.
    if (t !== "Expense") setFramework(t);
    else if (!EXPENSE_FRAMEWORKS.includes(framework as (typeof EXPENSE_FRAMEWORKS)[number]))
      setFramework("Needs");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const budgetCents = budget.trim() === "" ? 0 : toCents(budget);
    if (budgetCents == null || budgetCents < 0)
      return toast.error("Enter a valid budget amount");

    const input: CategoryInput = {
      name: name.trim(),
      mainCategory: mainCategory.trim(),
      type,
      framework: framework as CategoryInput["framework"],
      monthlyBudgetCents: budgetCents,
    };
    startTransition(async () => {
      const res = editing
        ? await updateCategory(editing.id, input)
        : await createCategory(input);
      if (res.ok) {
        toast.success(editing ? "Saved" : `"${input.name}" created`);
        onClose();
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editing ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription>
            Subcategory name, grouping, and the monthly budget it measures against.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name (subcategory)</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dinner, Petrol, EPF"
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-main">Main category (group)</Label>
            {creatingGroup ? (
              <div className="flex gap-2">
                <Input
                  id="cat-main"
                  value={mainCategory}
                  onChange={(e) => setMainCategory(e.target.value)}
                  placeholder="New group name"
                  autoFocus
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreatingGroup(false);
                    setMainCategory(editing?.mainCategory ?? "");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <select
                id="cat-main"
                value={mainCategory}
                onChange={(e) => {
                  if (e.target.value === NEW_GROUP) {
                    setCreatingGroup(true);
                    setMainCategory("");
                  } else setMainCategory(e.target.value);
                }}
                className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none"
              >
                <option value="">None</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value={NEW_GROUP}>+ New group…</option>
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-type">Type</Label>
              {/* ponytail: native select over a new shadcn primitive */}
              <select
                id="cat-type"
                value={type}
                onChange={(e) => handleType(e.target.value as CategoryInput["type"])}
                className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-framework">Framework ⚡</Label>
              <select
                id="cat-framework"
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                disabled={type !== "Expense"}
                className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none disabled:opacity-60"
              >
                {type === "Expense" ? (
                  EXPENSE_FRAMEWORKS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))
                ) : (
                  <option value={type}>{type}</option>
                )}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-budget">Monthly budget (RM)</Label>
            <Input
              id="cat-budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              inputMode="decimal"
              placeholder="0.00 — leave empty for no budget"
              autoComplete="off"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <Button type="submit" size="lg" disabled={pending} className="mt-1">
            {pending ? "Saving…" : editing ? "Save changes" : "Create category"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
