import type { Variants } from "motion/react";

// Curves mirror the CSS twins in globals.css (--ease-reveal / --ease-hover).
export const EASE_REVEAL: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_HOVER: [number, number, number, number] = [0.4, 0, 0.6, 1];

export const DUR = {
  fast: 0.35,
  reveal: 0.9,
  slow: 1.5,
  hover: 0.24,
} as const;

/** Signature entrance: opacity fades over .9s while y travels 24→0 over 1.5s,
 *  both expo-out. Slower position than opacity gives the "settling" feel.
 *  `custom` = the element's index down the page: each successive reveal is
 *  delayed 60ms more and settles a touch faster (Apple descending-duration
 *  cascade), so a scrolled-into-view stack arrives as one gesture, not N equal
 *  pops. Floors keep late items from becoming instant. */
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      opacity: { duration: Math.max(DUR.reveal - i * 0.06, 0.45), ease: EASE_REVEAL },
      y: { duration: Math.max(DUR.slow - i * 0.1, 0.7), ease: EASE_REVEAL },
    },
  }),
};

/** Parent that cascades its children's `show` state 80ms apart. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
