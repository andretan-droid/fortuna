"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/** Shared hover-tooltip layer for the hand-rolled charts (no Recharts). A chart
 *  wraps its body in <ChartTipSurface> and calls useChartTip().show(clientX,
 *  clientY, node) from pointer handlers; the surface converts client coords to
 *  surface-relative, clamps the floating tip inside its own box, and keeps it
 *  pointer-events-none so it never eats the hover it's reacting to. */

type Tip = { x: number; y: number; content: ReactNode } | null;

const TipCtx = createContext<{
  /** Position args are client coords (e.clientX/Y) — converted here. */
  show: (clientX: number, clientY: number, content: ReactNode) => void;
  hide: () => void;
} | null>(null);

export function ChartTipSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);

  const show = useCallback((clientX: number, clientY: number, content: ReactNode) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ x: clientX - rect.left, y: clientY - rect.top, content });
  }, []);
  const hide = useCallback(() => setTip(null), []);

  return (
    <TipCtx.Provider value={{ show, hide }}>
      {/* pan-y: vertical page scroll still works over the chart; horizontal drag
          is ours for scrubbing line charts. */}
      <div ref={surfaceRef} className={cn("relative", className)} style={{ touchAction: "pan-y" }}>
        {children}
        {tip && <FloatingTip x={tip.x} y={tip.y} surfaceRef={surfaceRef}>{tip.content}</FloatingTip>}
      </div>
    </TipCtx.Provider>
  );
}

export function useChartTip() {
  const ctx = useContext(TipCtx);
  if (!ctx) throw new Error("useChartTip must be used inside <ChartTipSurface>");
  return ctx;
}

/** Centred above the point with an 8px gap; clamped horizontally into the
 *  surface and flipped below if there's no room above. Measured after paint so
 *  the clamp knows the tip's real size. */
function FloatingTip({
  x,
  y,
  surfaceRef,
  children,
}: {
  x: number;
  y: number;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y });

  useLayoutEffect(() => {
    const el = tipRef.current;
    const surf = surfaceRef.current;
    if (!el || !surf) return;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const sw = surf.clientWidth;
    const sh = surf.clientHeight;
    let left = x - tw / 2;
    let top = y - th - 8;
    left = Math.max(4, Math.min(left, sw - tw - 4));
    if (top < 4) top = Math.min(y + 12, sh - th - 4); // no room above → drop below
    setPos({ left, top });
  }, [x, y, surfaceRef]);

  return (
    <div
      ref={tipRef}
      role="tooltip"
      className="pointer-events-none absolute z-20 min-w-[7rem] rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-[var(--shadow-paper)]"
      style={{ left: pos.left, top: pos.top }}
    >
      {children}
    </div>
  );
}

/** One label/value line inside a tip — keeps every chart's tip content terse
 *  and visually aligned. `dot` draws the series swatch when a chart is colour-coded. */
export function TipRow({
  label,
  value,
  dot,
}: {
  label: string;
  value: string;
  dot?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {dot && <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} />}
        {label}
      </span>
      <span className="tabular font-medium text-foreground">{value}</span>
    </div>
  );
}

/** Bolder heading line for the top of a tip (e.g. the month). */
export function TipHead({ children }: { children: ReactNode }) {
  return <p className="mb-1 font-medium text-foreground">{children}</p>;
}
