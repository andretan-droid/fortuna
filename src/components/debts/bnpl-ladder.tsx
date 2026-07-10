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

/** One plan row — clickable to edit. Shows payoff progress and what's owed. */
function PlanRow({
  p,
  currentMonth,
  onEdit,
  onPay,
}: {
  p: BnplPlanState;
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
        <div className="flex items-baseline justify-between gap-4">
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
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
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
            className={cn("h-full rounded-full", p.done ? "bg-income" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </li>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 mb-1 flex items-baseline justify-between text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground first:mt-0">
      {children}
    </p>
  );
}

/** BNPL plans in three tiers: due this month, active (grouped by platform), and
 *  a collapsed "paid off" section. Rows open the plan editor. */
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

  const { due, ongoingByPlatform, done, doneTotal } = useMemo(() => {
    const active = summary.active;
    const due = active
      .filter((p) => !p.paidThisMonth)
      .sort((a, b) => a.payoff.localeCompare(b.payoff));
    const ongoing = active
      .filter((p) => p.paidThisMonth)
      .sort((a, b) => a.payoff.localeCompare(b.payoff));

    const byPlatform = new Map<string, BnplPlanState[]>();
    for (const p of ongoing) {
      const key = p.platform ?? "Other";
      const list = byPlatform.get(key) ?? [];
      list.push(p);
      byPlatform.set(key, list);
    }
    const ongoingByPlatform = [...byPlatform.entries()]
      .map(([platform, plans]) => ({
        platform,
        plans,
        commit: plans.reduce((s, p) => s + p.instal, 0),
      }))
      .sort((a, b) => a.platform.localeCompare(b.platform));

    const done = summary.plans
      .filter((p) => p.done)
      .sort((a, b) => b.payoff.localeCompare(a.payoff));
    const doneTotal = done.reduce((s, p) => s + p.totalAmountCents, 0);
    return { due, ongoingByPlatform, done, doneTotal };
  }, [summary]);

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus className="size-4" /> Add plan
    </Button>
  );

  const hasActive = due.length > 0 || ongoingByPlatform.length > 0;

  return (
    <Panel title="BNPL plans" headerRight={addButton}>
      {!summary.plans.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No Buy-Now-Pay-Later plans yet. Add one to track payoff progress and what
          you still owe.
        </p>
      ) : (
        <>
          {due.length > 0 && (
            <div className="rounded-lg border-l-2 border-l-primary bg-primary/5 pl-3 pr-3">
              <SectionLabel>
                <span>Due this month</span>
                <span className="tabular normal-case tracking-normal">
                  {formatCents(due.reduce((s, p) => s + p.instal, 0))}
                </span>
              </SectionLabel>
              <ul className="divide-y divide-border">
                {due.map((p) => (
                  <PlanRow
                    key={p.id}
                    p={p}
                    currentMonth={summary.currentMonth}
                    onEdit={() => setEditing(p)}
                    onPay={() => setPaying(p)}
                  />
                ))}
              </ul>
            </div>
          )}

          {ongoingByPlatform.map((g) => (
            <div key={g.platform}>
              <SectionLabel>
                <span className="flex items-center gap-1.5">
                  <Chip label={g.platform} tone={providerColor(g.platform)} />
                </span>
                <span className="tabular normal-case tracking-normal">
                  {formatCents(g.commit)}/mo
                </span>
              </SectionLabel>
              <ul className="divide-y divide-border">
                {g.plans.map((p) => (
                  <PlanRow
                    key={p.id}
                    p={p}
                    currentMonth={summary.currentMonth}
                    onEdit={() => setEditing(p)}
                    onPay={() => setPaying(p)}
                  />
                ))}
              </ul>
            </div>
          ))}

          {!hasActive && done.length > 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              All plans paid off. 🎉
            </p>
          )}

          {done.length > 0 && (
            <details className="group mt-5 border-t pt-3">
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
                    currentMonth={summary.currentMonth}
                    onEdit={() => setEditing(p)}
                    onPay={() => setPaying(p)}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
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
