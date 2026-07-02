"use client";

import { formatCents } from "@/lib/money";
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
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">{row.category}</span>
          {row.mainCategory && <span>· {row.mainCategory}</span>}
          <span>· {row.framework}</span>
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
          <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[11px] leading-4 text-secondary-foreground sm:inline-flex">
            {row.paymentMethod}
          </span>
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
