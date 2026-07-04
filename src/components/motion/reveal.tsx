"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { fadeRise, staggerContainer } from "@/lib/motion";

/** Fires once when scrolled into view (not on mount) so content below the fold
 *  animates as you reach it. `index` is the element's order down the page — it
 *  drives fadeRise's descending-duration cascade via `custom`. Reduced-motion →
 *  plain div at full opacity (never a motion component that could stick at
 *  opacity 0, V5). */
export function Reveal({
  children,
  className,
  index = 0,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={fadeRise}
      custom={index}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25, margin: "0px 0px -8% 0px" }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger parent — children using `fadeRise` (or motion.* with variants)
 *  cascade in when the group scrolls into view. Reduced-motion → static
 *  full-opacity div. Wrap STATIC zones only: with `once:true`, children mounted
 *  after the group first enters view stay hidden. */
export function StaggerGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
    >
      {children}
    </motion.div>
  );
}

/** Spring count-up for hero numerals. Reduced-motion → final value rendered
 *  immediately. Writes textContent via ref so the span keeps tabular width. */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString());
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 1 });

  useEffect(() => {
    if (reduce) return;
    mv.set(value);
    const unsub = spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = fmt(v);
    });
    return unsub;
    // fmt/mv/spring are stable enough; re-run only on value/reduce change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  return (
    <span ref={ref} className={className}>
      {fmt(reduce ? value : 0)}
    </span>
  );
}
