"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { formatMonthLong } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { providerColor, type Tone } from "@/lib/colors";
import { Chip } from "@/components/ui/chip";
import type { BnplPlanState } from "@/lib/bnpl";
import type { DebtsSummary } from "@/server/queries/debts";
import type { AccountBalance } from "@/server/queries/wealth";
import { PlanEditor } from "./plan-editor";
import { RecordPayment } from "./record-payment";

type Opt = { id: string; name: string };

const OVERDUE_TONE: Tone = { bg: "bg-destructive/15", text: "text-destructive" };
const DUE_SOON_TONE: Tone = { bg: "bg-warning/15", text: "text-warning" };
const ACTIVE_TONE: Tone = { bg: "bg-muted", text: "text-muted-foreground" };
const COMPLETED_TONE: Tone = { bg: "bg-income/15", text: "text-income" };

function planStatus(p: BnplPlanState, currentMonth: string): { label: string; tone: Tone } {
  if (p.done) return { label: "Completed", tone: COMPLETED_TONE };
  if (!p.paidThisMonth && p.nextDue && p.nextDue < currentMonth)
    return { label: "Overdue", tone: OVERDUE_TONE };
  if (!p.paidThisMonth && p.nextDue === currentMonth)
    return { label: "Due soon", tone: DUE_SOON_TONE };
  return { label: "Active", tone: ACTIVE_TONE };
}

/** A Tone's `text-*` class → its CSS custom property, e.g. `text-chart-2` →
 *  `var(--chart-2)`. Lets us drive an inline border/background color off the
 *  same palette without a runtime-built Tailwind class (which the static
 *  scanner would never generate). */
function toneVar(tone: Tone): string {
  return `var(--${tone.text.slice("text-".length)})`;
}

/** One plan row — clickable to edit. Shows payoff progress and what's owed.
 *  `tone` colors the payoff bar to match the plan's platform card. */
function PlanRow({
  p,
  tone,
  currentMonth,
  onEdit,
  onPay,
}: {
  p: BnplPlanState;
  tone: Tone;
  currentMonth: string;
  onEdit: () => void;
  onPay: () => void;
}) {
  const pct = Math.round(p.pct * 100);
  const status = planStatus(p, currentMonth);
  return (
    <li>
      {/* div, not button — a "Pay" <button> lives inside this row, and
          <button> can't nest a <button> (invalid HTML, hydration error). */}
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit();
          }
        }}
        aria-label={`Edit ${p.item} plan`}
        className={cn(
          "group w-full cursor-pointer py-4 text-left outline-none",
          p.done && "opacity-60",
        )}
      >
        {/* Stacks on mobile (title block, then amount + Pay on their own row);
            side-by-side from sm up. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium underline-offset-4 group-hover:underline">
              {p.item}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {p.platform && <Chip label={p.platform} tone={providerColor(p.platform)} />}
              <Chip label={status.label} tone={status.tone} />
              <span>
                Paid {p.paid} of {p.n} · {formatCents(p.instal)}/mo
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
            <div className="text-left sm:text-right">
              <p className="tabular font-display text-lg leading-none">
                {formatCents(p.outstanding)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.done
                  ? `Paid off ${p.payoff ? formatMonthLong(p.payoff) : ""}`.trim()
                  : `Next ${p.nextDue ? formatMonthLong(p.nextDue) : "—"} · Ends ${
                      p.payoff ? formatMonthLong(p.payoff) : "—"
                    }`}
              </p>
            </div>
            {!p.done && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onPay();
                }}
              >
                Pay
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", p.done && "bg-income")}
            style={{ width: `${pct}%`, ...(p.done ? {} : { backgroundColor: toneVar(tone) }) }}
          />
        </div>
      </div>
    </li>
  );
}

type PlatformGroup = {
  platform: string;
  plans: BnplPlanState[];
  commit: number; // Σ monthly instalment
  dueCount: number; // plans not yet paid this month
};

/** BNPL plans grouped into one colored card per platform. Within a card, plans
 *  due this month sort to the top; cards with anything due sort to the top of
 *  the stack. A collapsed "paid off" section (pooled across platforms) sits
 *  below. Rows open the plan editor. */
export function BnplLadder({
  summary,
  categories,
  paymentMethods,
}: {
  summary: DebtsSummary;
  categories: Opt[];
  paymentMethods: Opt[];
}) {
  const [editing, setEditing] = useState<BnplPlanState | "new" | null>(null);
  const [paying, setPaying] = useState<BnplPlanState | null>(null);

  const { groups, done, doneTotal } = useMemo(() => {
    const byPlatform = new Map<string, BnplPlanState[]>();
    for (const p of summary.active) {
      const key = p.platform ?? "Other";
      const list = byPlatform.get(key) ?? [];
      list.push(p);
      byPlatform.set(key, list);
    }
    const groups: PlatformGroup[] = [...byPlatform.entries()].map(([platform, plans]) => ({
      platform,
      // Due (not paid this month) first, then by payoff date.
      plans: [...plans].sort((a, b) => {
        if (a.paidThisMonth !== b.paidThisMonth) return a.paidThisMonth ? 1 : -1;
        return a.payoff.localeCompare(b.payoff);
      }),
      commit: plans.reduce((s, p) => s + p.instal, 0),
      dueCount: plans.filter((p) => !p.paidThisMonth).length,
    }));
    // Cards with something due bubble to the top, then alphabetical.
    groups.sort((a, b) => {
      if ((a.dueCount > 0) !== (b.dueCount > 0)) return a.dueCount > 0 ? -1 : 1;
      return a.platform.localeCompare(b.platform);
    });

    const done = summary.plans
      .filter((p) => p.done)
      .sort((a, b) => b.payoff.localeCompare(a.payoff));
    const doneTotal = done.reduce((s, p) => s + p.totalAmountCents, 0);
    return { groups, done, doneTotal };
  }, [summary]);

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="size-4" /> Add plan
    </Button>
  );

  return (
    <Panel title="BNPL plans" headerRight={addButton}>
      {!summary.plans.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No Buy-Now-Pay-Later plans yet. Add one to track payoff progress and what
          you still owe.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const tone = providerColor(g.platform);
            return (
              <div
                key={g.platform}
                className={cn("rounded-xl border border-border/60 border-l-4 px-3 py-4 sm:px-5", tone.bg)}
                style={{ borderLeftColor: toneVar(tone) }}
              >
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("text-xs font-semibold uppercase tracking-[0.14em]", tone.text)}>
                      {g.platform}
                    </span>
                    {g.dueCount > 0 && (
                      <span className="text-xs font-medium text-warning">· {g.dueCount} due</span>
                    )}
                  </span>
                  <span className="tabular text-xs text-muted-foreground">
                    {formatCents(g.commit)}/mo
                  </span>
                </div>
                <ul className="divide-y divide-border/60">
                  {g.plans.map((p) => (
                    <PlanRow
                      key={p.id}
                      p={p}
                      tone={tone}
                      currentMonth={summary.currentMonth}
                      onEdit={() => setEditing(p)}
                      onPay={() => setPaying(p)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}

          {!groups.length && done.length > 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              All plans paid off. 🎉
            </p>
          )}

          {done.length > 0 && (
            <details className="group border-t pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                  Paid off ({done.length})
                </span>
                <span className="tabular normal-case tracking-normal">
                  {formatCents(doneTotal)} repaid
                </span>
              </summary>
              <ul className="mt-1 divide-y divide-border">
                {done.map((p) => (
                  <PlanRow
                    key={p.id}
                    p={p}
                    tone={providerColor(p.platform)}
                    currentMonth={summary.currentMonth}
                    onEdit={() => setEditing(p)}
                    onPay={() => setPaying(p)}
                  />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <PlanEditor
        key={editing === "new" ? "new" : (editing?.id ?? "editor-closed")}
        plan={editing}
        categories={categories}
        paymentMethods={paymentMethods}
        onClose={() => setEditing(null)}
        onPay={(p) => setPaying(p)}
      />
      <RecordPayment
        key={paying?.id ?? "payment-closed"}
        plan={paying}
        paymentMethods={paymentMethods}
        onClose={() => setPaying(null)}
      />
    </Panel>
  );
}

/** The liability accounts already tracked on the dashboard, surfaced here too so
 *  /debts is a complete debt picture. Reads wealth's accounts (no new query). */
export function LiabilityAccounts({ accounts }: { accounts: AccountBalance[] }) {
  const liabilities = accounts.filter((a) => a.kind === "Liability");
  if (!liabilities.length) return null;

  return (
    <Panel title="Liability accounts">
      <ul className="divide-y divide-border">
        {liabilities.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">
                {a.asOfMonth ? `As of ${a.asOfMonth}` : "No balance recorded"}
              </p>
            </div>
            <p className="tabular text-sm">
              {a.balanceCents != null ? formatCents(a.balanceCents) : "—"}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
