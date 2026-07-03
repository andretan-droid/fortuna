import { Panel } from "@/components/dashboard/panel";
import { seriesGeom, type ChartGeom } from "@/lib/chart";
import { formatCents } from "@/lib/money";
import { formatMonthShort } from "@/lib/dates";
import type { NetWorthPoint } from "@/server/queries/analytics";

const G: ChartGeom = { w: 640, h: 180, pad: 18 };

/** Net worth (assets − liabilities) over time — a single filled area. Portfolio
 *  is live-only and excluded upstream, so this is the recorded-balance trend. */
export function NetWorthArea({ data }: { data: NetWorthPoint[] }) {
  if (data.length < 2) {
    return (
      <Panel title="Net worth trend">
        <p className="py-8 text-center text-sm text-muted-foreground">
          Record balances in at least two months to see the trend.
        </p>
      </Panel>
    );
  }

  const net = data.map((p) => p.netCents);
  const { pts, line, area } = seriesGeom(net, G);
  const last = pts[pts.length - 1];
  const lastCents = net[net.length - 1];

  return (
    <Panel title="Net worth trend">
      <svg viewBox={`0 0 ${G.w} ${G.h}`} className="w-full" role="img" aria-label="Net worth trend">
        <path d={area} className="fill-brand/10" />
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
        <span>{formatMonthShort(data[0].month)}</span>
        <span className="tabular text-sm text-foreground">{formatCents(lastCents)}</span>
        <span>{formatMonthShort(data[data.length - 1].month)}</span>
      </div>
    </Panel>
  );
}
