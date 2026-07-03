"use client";

import { AnimatedNumber } from "@/components/motion/reveal";
import { formatAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

/** The three hero figures. Count-up via AnimatedNumber (its intended use), which
 *  keeps tabular width and renders the final value under reduced-motion. */
export function HeroNumbers({
  netWorthCents,
  expenseCents,
  budgetCents,
  savingsRate,
  targetSavingsRate,
}: {
  netWorthCents: number;
  expenseCents: number;
  budgetCents: number;
  savingsRate: number; // fraction 0..1
  targetSavingsRate: number | null;
}) {
  const budgetPct = budgetCents > 0 ? Math.round((expenseCents / budgetCents) * 100) : null;
  const overBudget = budgetPct != null && budgetPct > 100;
  const savingsPct = savingsRate * 100;
  const targetPct = targetSavingsRate != null ? targetSavingsRate * 100 : null;
  const beatsTarget = targetPct != null && savingsPct >= targetPct;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Stat
        label="Net worth"
        prefix="RM "
        value={<AnimatedNumber value={netWorthCents} format={formatAmount} />}
        delta="Assets + portfolio − liabilities"
        tone="muted"
      />
      <Stat
        label="Spent this month"
        prefix="RM "
        value={<AnimatedNumber value={expenseCents} format={formatAmount} />}
        delta={budgetPct != null ? `${budgetPct}% of budget` : "No budget set"}
        tone={overBudget ? "warning" : "muted"}
      />
      <Stat
        label="Savings rate"
        value={<AnimatedNumber value={savingsPct} format={(n) => `${n.toFixed(1)}%`} />}
        delta={targetPct != null ? `Target ${targetPct.toFixed(0)}%` : "No target set"}
        tone={beatsTarget ? "income" : "muted"}
      />
    </div>
  );
}

function Stat({
  label,
  prefix,
  value,
  delta,
  tone,
}: {
  label: string;
  prefix?: string;
  value: React.ReactNode;
  delta: string;
  tone: "income" | "warning" | "muted";
}) {
  return (
    <div className="interactive rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-paper)]">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="tabular font-display mt-3 text-4xl leading-none">
        {prefix && <span className="text-muted-foreground">{prefix}</span>}
        {value}
      </p>
      <p
        className={cn(
          "mt-3 text-sm",
          tone === "income" && "text-income",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {delta}
      </p>
    </div>
  );
}
