import type { Transition, Variants } from "framer-motion";

/** Shared spring used across native interactions for a consistent feel. */
export const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 36,
  mass: 0.8,
};

/** Parent variant that staggers children into view (lists, grids). */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

/** Child variant for a single row/card fading + rising into place. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 520, damping: 40 },
  },
};
