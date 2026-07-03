import { Panel } from "@/components/dashboard/panel";
import { seriesGeom, type ChartGeom } from "@/lib/chart";
import { formatMonthShort } from "@/lib/dates";
import type { MonthlyCashflow } from "@/server/queries/analytics";

const G: ChartGeom = { w: 640, h: 180, pad: 18 };

/** Savings rate over time — a single line pinned to a 0–100% scale. One series,
 *  so no legend (the title names it); last point is direct-labelled. */
export function SavingsTrend({ data }: { data: MonthlyCashflow[] }) {
  const months = data.slice(-12);
  if (months.length < 2) {
    return (
      <Panel title="Savings rate">
        <p className="py-8 text-center text-sm text-muted-foreground">
          Needs at least two months of data.
        </p>
      </Panel>
    );
  }

  const pcts = months.map((m) => Math.max(0, Math.min(100, m.savingsRate * 100)));
  const { pts, line } = seriesGeom(pcts, G, 0, 100);
  const last = pts[pts.length - 1];
  const lastPct = Math.round(pcts[pcts.length - 1]);

  return (
    <Panel title="Savings rate">
      <svg viewBox={`0 0 ${G.w} ${G.h}`} className="w-full" role="img" aria-label="Savings rate trend">
        {/* recessive 0/50/100% gridlines */}
        {[0, 50, 100].map((p) => {
          const y = G.pad + (1 - p / 100) * (G.h - G.pad * 2);
          return (
            <line
              key={p}
              x1={G.pad}
              x2={G.w - G.pad}
              y1={y}
              y2={y}
              className="stroke-border"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        <polyline
          points={line}
          fill="none"
          className="stroke-brand"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last[0]} cy={last[1]} r={4} className="fill-brand" />
      </svg>
      <div className="mt-1 flex items-baseline justify-between text-[10px] text-muted-foreground">
        <span>{formatMonthShort(months[0].month)}</span>
        <span className="tabular text-sm text-brand">{lastPct}%</span>
        <span>{formatMonthShort(months[months.length - 1].month)}</span>
      </div>
    </Panel>
  );
}
