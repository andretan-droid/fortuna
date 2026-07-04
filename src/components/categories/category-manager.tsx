"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import { setCategoryActive } from "@/server/actions/categories";
import type { CategoryRow } from "@/server/queries/categories";
import { CategoryEditor } from "./category-editor";
import { GroupManager } from "./group-manager";

/* Display order mirrors the legacy sheet's framework hierarchy. */
const FRAMEWORK_ORDER = ["Needs", "Wants", "Savings", "Income", "Deduction", "Transfer"];

/** Spend vs budget bar — Expense rows only; >100% shifts to destructive. */
function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  if (budget <= 0) return null;
  const pct = Math.min((spent / budget) * 100, 100);
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
      <div
        className={cn("h-full rounded-full", spent > budget ? "bg-destructive" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function CategoryManager({ rows }: { rows: CategoryRow[] }) {
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () => rows.filter((r) => showArchived || r.active),
    [rows, showArchived],
  );

  const groups = useMemo(() => {
    const byFramework = new Map<string, CategoryRow[]>();
    for (const r of visible) {
      const list = byFramework.get(r.framework) ?? [];
      list.push(r);
      byFramework.set(r.framework, list);
    }
    return FRAMEWORK_ORDER.filter((f) => byFramework.has(f)).map((f) => {
      const list = byFramework.get(f)!;
      return {
        framework: f,
        rows: list,
        budget: list.reduce((s, r) => s + r.monthlyBudgetCents, 0),
        spent: list.reduce((s, r) => s + r.spentThisMonthCents, 0),
      };
    });
  }, [visible]);

  const archivedCount = rows.length - rows.filter((r) => r.active).length;

  // Distinct main-category names across ALL rows (incl. archived) — the group
  // picker's option list. No new table; groups are just these values.
  const groupNames = useMemo(
    () =>
      [...new Set(rows.map((r) => r.mainCategory).filter((m): m is string => !!m))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [rows],
  );

  function toggleActive(row: CategoryRow) {
    startTransition(async () => {
      const res = await setCategoryActive(row.id, !row.active);
      if (res.ok) toast.success(row.active ? `"${row.name}" archived` : `"${row.name}" restored`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-8">
      {/* Framework summary strip — budget vs live spend this month. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {groups
          .filter((g) => ["Needs", "Wants", "Savings"].includes(g.framework))
          .map((g) => (
            <div key={g.framework} className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {g.framework}
              </p>
              <p className="tabular font-display mt-1 text-2xl">
                {formatCents(g.spent, "RM")}
                <span className="text-muted-foreground text-sm">
                  {" "}
                  / {formatCents(g.budget, "RM")}
                </span>
              </p>
              <div className="mt-3">
                <BudgetBar spent={g.spent} budget={g.budget} />
              </div>
            </div>
          ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className={cn(
            "text-sm underline-offset-4 hover:underline",
            showArchived ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
        </button>
        <div className="flex items-center gap-2">
          <GroupManager rows={rows} />
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" /> New category
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed py-20 text-center">
          <p className="font-display text-xl">No categories yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first subcategory to start budgeting.
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.framework}>
            <h2 className="glass font-display sticky top-16 z-10 mb-2 -mx-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground">
              {g.framework}
              <span className="tabular ml-2 text-xs">
                {g.budget > 0 &&
                  `${formatCents(g.spent, "RM")} of ${formatCents(g.budget, "RM")}`}
              </span>
            </h2>
            <div className="divide-y rounded-lg border">
              {g.rows.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_10rem_auto]",
                    !r.active && "opacity-50",
                  )}
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="truncate text-left text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {r.name}
                    </button>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.mainCategory ?? "—"} · {r.type}
                    </p>
                  </div>

                  <div className="tabular hidden text-right text-sm sm:block">
                    {r.monthlyBudgetCents > 0 ? (
                      <>
                        <span>{formatCents(r.spentThisMonthCents, "RM")}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          / {formatCents(r.monthlyBudgetCents, "RM")}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        {r.spentThisMonthCents > 0
                          ? formatCents(r.spentThisMonthCents, "RM")
                          : "—"}
                      </span>
                    )}
                  </div>

                  <div className="hidden sm:block">
                    <BudgetBar spent={r.spentThisMonthCents} budget={r.monthlyBudgetCents} />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => toggleActive(r)}
                    className="text-muted-foreground justify-self-end"
                  >
                    {r.active ? "Archive" : "Restore"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {/* key remounts the form per target → clean field state (txn-editor trick) */}
      <CategoryEditor
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        row={editing}
        groups={groupNames}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
