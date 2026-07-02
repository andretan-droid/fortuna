import { PageHeader } from "@/components/shell/page-header";

// Placeholder numerals — real widgets on real data land in Phase 9. The tabular
// serif figures here also serve as the on-screen subject for V7's width test.
const STATS = [
  { label: "Net worth", value: "128,940.00", delta: "+2.4% vs June", positive: true },
  { label: "Spent this month", value: "3,417.62", delta: "48% of budget", positive: false },
  { label: "Savings rate", value: "31.8%", delta: "Target 30%", positive: true },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="July 2026 · Overview"
        title="Dashboard"
        description="Your month at a glance — cash flow, budgets, and net worth."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="interactive rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-paper)]"
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {s.label}
            </p>
            <p className="tabular font-display mt-3 text-4xl leading-none">
              {s.label === "Savings rate" ? "" : <span className="text-muted-foreground">RM </span>}
              {s.value}
            </p>
            <p
              className={`mt-3 text-sm ${
                s.positive ? "text-income" : "text-muted-foreground"
              }`}
            >
              {s.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
        <p className="font-display text-lg text-muted-foreground">
          Widgets go live once your data lands
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground/70">
          Sign-in, database, and the migration of your 2,000+ transactions come in Phases 4–8.
        </p>
      </div>
    </div>
  );
}
