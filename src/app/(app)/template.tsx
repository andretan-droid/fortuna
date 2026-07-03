"use client";

import { motion, useReducedMotion } from "motion/react";
import { DUR, EASE_REVEAL } from "@/lib/motion";

/** Next re-mounts a `template` on every navigation, so this gives each route a
 *  gentle fade-in as it enters. Deliberately opacity-only: in-page <Reveal>s do
 *  the top-to-bottom cascade, and a container translate on top of them would
 *  double the motion. Reduced-motion → children render statically (V5). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DUR.fast, ease: EASE_REVEAL }}
    >
      {children}
    </motion.div>
  );
}
