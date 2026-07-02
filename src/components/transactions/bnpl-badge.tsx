import { formatCents } from "@/lib/money";
import type { FeedRow } from "@/server/queries/transactions";

/** `paid/n × RM instalment` — the legacy calc.js progress convention. */
export function BnplBadge({ bnpl }: { bnpl: NonNullable<FeedRow["bnpl"]> }) {
  const done = bnpl.paidCount >= bnpl.nInstalments;
  return (
    <span
      className={`tabular inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 ${
        done
          ? "border-income/40 text-income"
          : "border-brand/40 text-brand"
      }`}
      title={bnpl.item}
    >
      {bnpl.paidCount}/{bnpl.nInstalments} × {formatCents(bnpl.instalmentCents)}
    </span>
  );
}
