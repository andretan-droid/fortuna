"use client";

import { useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { ChartTipSurface, TipHead, TipRow, useChartTip } from "@/components/charts/tooltip";
import { seriesGeom, type ChartGeom } from "@/lib/chart";
import { formatCents } from "@/lib/money";
import { formatMonthShort } from "@/lib/dates";
import type { MonthlyCashflow } from "@/server/queries/analytics";

const G: ChartGeom = { w: 640, h: 180, pad: 18 };

/** Savings rate over time — a single line pinned to a 0–100% scale. One series,
 *  so no legend (the title names it); last point is direct-labelled. Hovering
 *  scrubs a crosshair to the nearest month. */
export function SavingsTrend({ data }: { data: MonthlyCashflow[] }) {
  const months = data;
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
      <ChartTipSurface>
        <Plot months={months} pcts={pcts} pts={pts} line={line} last={last} />
      </ChartTipSurface>
      <div className="mt-1 flex items-baseline justify-between text-[10px] text-muted-foreground">
        <span>{formatMonthShort(months[0].month)}</span>
        <span className="tabular text-sm text-brand">{lastPct}%</span>
        <span>{formatMonthShort(months[months.length - 1].month)}</span>
      </div>
    </Panel>
  );
}

function Plot({
  months,
  pcts,
  pts,
  line,
  last,
}: {
  months: MonthlyCashflow[];
  pcts: number[];
  pts: readonly (readonly [number, number])[];
  line: string;
  last: readonly [number, number];
}) {
  const { show, hide } = useChartTip();
  const [active, setActive] = useState<number | null>(null);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = nearestIndex(e.clientX, rect.left, rect.width, months.length);
    setActive(i);
    const m = months[i];
    show(
      e.clientX,
      e.clientY,
      <>
        <TipHead>{formatMonthShort(m.month)}</TipHead>
        <TipRow label="Savings rate" value={`${Math.round(pcts[i])}%`} dot="var(--color-brand)" />
        <TipRow label="Net" value={formatCents(m.netCents)} />
      </>,
    );
  }

  const dot = active != null ? pts[active] : last;

  return (
    <svg
      viewBox={`0 0 ${G.w} ${G.h}`}
      className="w-full cursor-crosshair"
      role="img"
      aria-label="Savings rate trend"
      onPointerMove={onMove}
      onPointerLeave={() => {
        setActive(null);
        hide();
      }}
    >
      {/* recessive 0/50/100% gridlines */}
      {[0, 50, 100].map((p) => {
        const y = G.pad + (1 - p / 100) * (G.h - G.pad * 2);
        return (
          <line key={p} x1={G.pad} x2={G.w - G.pad} y1={y} y2={y} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        );
      })}
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
