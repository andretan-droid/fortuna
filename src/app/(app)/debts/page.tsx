import { PageHeader } from "@/components/shell/page-header";
import { Reveal } from "@/components/motion/reveal";
import { requireUserId } from "@/server/auth-helpers";
import { getDebtsSummary } from "@/server/queries/debts";
import { getWealthSummary } from "@/server/queries/wealth";
import { getCategoryOptions } from "@/server/queries/transactions";
import { BnplLadder, LiabilityAccounts } from "@/components/debts/bnpl-ladder";
import { formatCents } from "@/lib/money";
import { formatMonthLong } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** RSC: BNPL command center. Reads debts + wealth in parallel — the ladder and
 *  aggregate tiles come from getDebtsSummary; the liability-accounts panel reuses
 *  wealth's account list (no extra query). */
export default async function DebtsPage() {
  const userId = await requireUserId();
  const [debts, wealth, categories] = await Promise.all([
    getDebtsSummary(userId),
    getWealthSummary(userId),
    getCategoryOptions(userId),
  ]);

  const payoffRange =
    debts.earliestPayoff && debts.latestPayoff
      ? debts.earliestPayoff === debts.latestPayoff
        ? formatMonthLong(debts.earliestPayoff)
        : `${formatMonthLong(debts.earliestPayoff)} → ${formatMonthLong(debts.latestPayoff)}`
      : "—";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Debt"
        title="Debts"
        description="Buy-Now-Pay-Later plans and liability accounts — what you owe and when it clears."
      />

      <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="BNPL outstanding"
          value={formatCents(debts.totalOutstandingCents)}
          sub="Counted as a liability in net worth"
          tone={debts.totalOutstandingCents > 0 ? "warning" : "muted"}
        />
        <Stat
          label="Monthly commitment"
          value={formatCents(debts.monthlyCommitCents)}
          sub="Sum of active instalments"
          tone="muted"
        />
        <Stat
          label="Active plans"
          value={String(debts.activeCount)}
          sub={
            debts.dueThisMonthCount > 0
              ? `${debts.dueThisMonthCount} due this month`
              : "None due this month"
          }
          tone={debts.dueThisMonthCount > 0 ? "warning" : "muted"}
        />
        <Stat label="Payoff window" value={payoffRange} sub="Earliest → latest" tone="muted" small />
      </Reveal>

      <Reveal index={1}>
        <BnplLadder summary={debts} categories={categories} />
      </Reveal>

      <Reveal index={2}>
        <LiabilityAccounts accounts={wealth.accounts} />
      </Reveal>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  small,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "warning" | "muted";
  small?: boolean;
}) {
  return (
    <div className="interactive rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-paper)]">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("tabular font-display mt-3 leading-none", small ? "text-2xl" : "text-3xl")}>
        {value}
      </p>
      <p className={cn("mt-3 text-sm", tone === "warning" ? "text-warning" : "text-muted-foreground")}>
        {sub}
      </p>
    </div>
  );
}
