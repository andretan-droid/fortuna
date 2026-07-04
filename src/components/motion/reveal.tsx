"use client";

import { motion, useReducedMotion } from "motion/react";
import { fadeRise, staggerContainer, EASE_REVEAL } from "@/lib/motion";

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
      viewport={{ once: true, amount: "some", margin: "0px 0px -8% 0px" }}
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
      viewport={{ once: true, amount: "some", margin: "0px 0px -8% 0px" }}
    >
      {children}
    </motion.div>
  );
}

/** Hero numeral: renders the final value and gently fades in — no count-up.
 *  Reduced-motion → plain span, no animation. */
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
  if (reduce) return <span className={className}>{fmt(value)}</span>;
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE_REVEAL }}
    >
      {fmt(value)}
    </motion.span>
  );
}
