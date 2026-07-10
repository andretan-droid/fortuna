"use client";

import { formatCents } from "@/lib/money";
import { frameworkColor, kindColor } from "@/lib/colors";
import { Chip } from "@/components/ui/chip";
import { BnplBadge } from "./bnpl-badge";
import type { FeedRow } from "@/server/queries/transactions";

/** One ledger line. All eight sheet columns are present: Date lives in the
 *  group header; Amount / Description / Subcategory / Method / Type⚡ /
 *  Main Category⚡ / Framework⚡ render here. */
export function FeedRowItem({
  row,
  onEdit,
}: {
  row: FeedRow;
  onEdit: (row: FeedRow) => void;
}) {
  const isOptimistic = row.id.startsWith("optimistic-");
  const isIncome = row.type === "Income";

  return (
    <button
      type="button"
      onClick={() => !isOptimistic && onEdit(row)}
      className={`group flex w-full items-center gap-3 border-b px-1 py-3 text-left transition-colors hover:bg-accent/50 ${
        row.deleted ? "opacity-45" : ""
      } ${isOptimistic ? "animate-pulse" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${row.deleted ? "line-through" : ""}`}>
          {row.description || row.category}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Chip label={row.category} tone={frameworkColor(row.framework)} />
          {row.mainCategory && <span>· {row.mainCategory}</span>}
          {row.type !== "Expense" && (
            <span
              className={`rounded-full border px-1.5 py-px text-[10px] leading-4 ${
                isIncome ? "border-income/40 text-income" : "border-border"
              }`}
            >
              {row.type}
            </span>
          )}
          {row.deleted && (
            <span className="rounded-full border border-destructive/40 px-1.5 py-px text-[10px] leading-4 text-destructive">
              deleted
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {row.bnpl && <BnplBadge bnpl={row.bnpl} />}
        {row.paymentMethod && (
          <Chip label={row.paymentMethod} tone={kindColor(row.paymentMethodKind ?? "Other")} />
        )}
        <span
          className={`tabular text-sm font-medium ${
            isIncome ? "text-income" : ""
          }`}
        >
          {isIncome ? "+" : ""}
          {formatCents(row.amountCents)}
        </span>
      </div>
    </button>
  );
}
