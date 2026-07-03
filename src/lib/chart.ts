/** Pure SVG-series geometry — the shared math behind the line/area charts
 *  (savings-trend, networth-area). No React, no DOM: given a numeric series and
 *  a viewBox, return the polyline points + a closed area path. Kept out of the
 *  components so the two callers can't drift, and so the mapping is testable. */

export type ChartGeom = { w: number; h: number; pad: number };

export type SeriesGeom = {
  pts: readonly (readonly [number, number])[];
  /** polyline `points` string */
  line: string;
  /** closed path from baseline up through the series and back — area fill */
  area: string;
};

/** Map values → coords in the [pad, w−pad] × [pad, h−pad] box. yMin/yMax pin the
 *  vertical scale (e.g. 0..100 for a percentage); default to the data range. */
export function seriesGeom(
  values: number[],
  g: ChartGeom,
  yMin?: number,
  yMax?: number,
): SeriesGeom {
  if (values.length === 0) return { pts: [], line: "", area: "" };
  const lo = yMin ?? Math.min(...values);
  const hi = yMax ?? Math.max(...values);
  const span = hi - lo || 1; // flat series → single mid line, never /0
  const innerW = g.w - g.pad * 2;
  const innerH = g.h - g.pad * 2;
  const n = values.length;

  const pts = values.map((v, i) => {
    const x = n === 1 ? g.w / 2 : g.pad + (i / (n - 1)) * innerW;
    const y = g.pad + (1 - (v - lo) / span) * innerH;
    return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const;
  });

  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const base = g.h - g.pad;
  const area =
    `M ${pts[0][0]},${base} ` +
    pts.map(([x, y]) => `L ${x},${y}`).join(" ") +
    ` L ${pts[pts.length - 1][0]},${base} Z`;

  return { pts, line, area };
}

// ponytail: one runnable check — `npx tsx src/lib/chart.ts`
if (process.argv[1]?.endsWith("chart.ts")) {
  const g: ChartGeom = { w: 100, h: 100, pad: 10 };
  const { pts } = seriesGeom([0, 10], g, 0, 10);
  // 2 pts span full inner width; v=0 sits on the baseline (y=90), v=10 at top (y=10)
  console.assert(pts[0][0] === 10 && pts[1][0] === 90, "x endpoints span inner box");
  console.assert(pts[0][1] === 90 && pts[1][1] === 10, "y maps lo→baseline, hi→top");
  const one = seriesGeom([5], g, 0, 10);
  console.assert(one.pts[0][0] === 50, "single point centers on x");
  console.log("chart.ts self-check OK");
}
