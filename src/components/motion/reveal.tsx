"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import { fadeRise, staggerContainer } from "@/lib/motion";

/** Single reveal. When reduced-motion is requested, renders a plain div at full
 *  opacity — never a motion component that could stick at opacity 0 (V5). */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={fadeRise}
      initial="hidden"
      animate="show"
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger parent — children using `fadeRise` (or motion.* with variants)
 *  cascade in. Reduced-motion → static full-opacity div. */
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
      animate="show"
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
