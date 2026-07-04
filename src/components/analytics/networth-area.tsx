"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { ChartTipSurface, TipHead, TipRow, useChartTip } from "@/components/charts/tooltip";
import { seriesGeom, type ChartGeom } from "@/lib/chart";
import { formatCents } from "@/lib/money";
import { formatMonthShort } from "@/lib/dates";
import type { NetWorthPoint } from "@/server/queries/analytics";

const G: ChartGeom = { w: 640, h: 180, pad: 18 };

/** Net worth (assets − liabilities) over time — a single filled area. Portfolio
 *  is live-only and excluded upstream, so this is the recorded-balance trend.
 *  Hovering scrubs a crosshair; the tip breaks down assets/liabilities/BNPL. */
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
      <ChartTipSurface>
        <Plot data={data} pts={pts} line={line} area={area} last={last} />
      </ChartTipSurface>
      <div className="mt-1 flex items-baseline justify-between text-[10px] text-muted-foreground">
        <span>{formatMonthShort(data[0].month)}</span>
        <span className="tabular text-sm text-foreground">{formatCents(lastCents)}</span>
        <span>{formatMonthShort(data[data.length - 1].month)}</span>
      </div>
    </Panel>
  );
}

function Plot({
  data,
  pts,
  line,
  area,
  last,
}: {
  data: NetWorthPoint[];
  pts: readonly (readonly [number, number])[];
  line: string;
  area: string;
  last: readonly [number, number];
}) {
  const { show, hide } = useChartTip();
  const [active, setActive] = useState<number | null>(null);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = nearestIndex(e.clientX, rect.left, rect.width, data.length);
    setActive(i);
    const p = data[i];
    show(
      e.clientX,
      e.clientY,
      <>
        <TipHead>{formatMonthShort(p.month)}</TipHead>
        <TipRow label="Assets" value={formatCents(p.assetsCents)} />
        <TipRow label="Liabilities" value={formatCents(p.liabilitiesCents)} />
        {p.bnplCents > 0 && <TipRow label="incl. BNPL" value={formatCents(p.bnplCents)} />}
        <TipRow label="Net worth" value={formatCents(p.netCents)} dot="var(--color-brand)" />
      </>,
    );
  }

  const dot = active != null ? pts[active] : last;

  return (
    <svg
      viewBox={`0 0 ${G.w} ${G.h}`}
      className="w-full cursor-crosshair"
      role="img"
      aria-label="Net worth trend"
      onPointerMove={onMove}
      onPointerLeave={() => {
        setActive(null);
        hide();
      }}
    >
      <path d={area} className="fill-brand/10" />
      {active != null && (
        <line x1={pts[active][0]} x2={pts[active][0]} y1={G.pad} y2={G.h - G.pad} className="stroke-brand/40" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      )}
      <polyline points={line} fill="none" className="stroke-brand" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={dot[0]} cy={dot[1]} r={4} className="fill-brand" />
    </svg>
  );
}

/** Nearest data index for a client-x over an element of the given screen width,
 *  correcting for the viewBox padding so edges map to the first/last point. */
function nearestIndex(clientX: number, left: number, width: number, n: number): number {
  const vbX = ((clientX - left) / width) * G.w;
  const innerW = G.w - G.pad * 2;
  const i = Math.round(((vbX - G.pad) / innerW) * (n - 1));
  return Math.max(0, Math.min(n - 1, i));
}
