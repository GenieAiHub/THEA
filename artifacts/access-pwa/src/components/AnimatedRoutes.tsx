import { useEffect, useRef } from "react";
import { Route, Switch, useLocation } from "wouter";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import Home from "@/pages/Home";
import Scan from "@/pages/Scan";
import Members from "@/pages/Members";
import MemberDetail from "@/pages/MemberDetail";
import AccessPoints from "@/pages/AccessPoints";
import Events from "@/pages/Events";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

const TAB_ORDER: Record<string, number> = {
  "/": 0,
  "/members": 1,
  "/scan": 2,
  "/access-points": 3,
  "/events": 4,
  "/settings": 5,
};

function isTab(path: string): boolean {
  return path in TAB_ORDER;
}

function rank(path: string): number {
  if (path in TAB_ORDER) return TAB_ORDER[path];
  // Detail routes sit "deeper" than their parent tab.
  if (path.startsWith("/members/")) return 1.5;
  return 99;
}

/**
 * Animated route outlet. Tab-to-tab navigation cross-fades; drilling into (or
 * out of) a detail screen slides directionally, matching native stack nav.
 * The inner <Switch> receives an explicit `location` so the exiting page stays
 * frozen on its own route during the exit animation.
 */
export function AnimatedRoutes() {
  const [location] = useLocation();
  const prev = useRef(location);
  const reduce = useReducedMotion();

  let direction = 0;
  if (prev.current !== location) {
    direction =
      isTab(prev.current) && isTab(location)
        ? 0
        : rank(location) >= rank(prev.current)
          ? 1
          : -1;
  }

  useEffect(() => {
    prev.current = location;
    window.scrollTo(0, 0);
  }, [location]);

  // Variants are functions of `custom` so both the entering AND the exiting
  // page resolve the *current* navigation direction (AnimatePresence forwards
  // `custom` to exiting children, avoiding a stale-direction exit animation).
  const variants: Variants = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: (d: number) =>
          d === 0 ? { opacity: 0, scale: 0.98 } : { opacity: 0, x: d * 32 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: (d: number) =>
          d === 0 ? { opacity: 0, scale: 1.015 } : { opacity: 0, x: d * -32 },
      };

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={location}
        custom={direction}
        className="w-full"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{ type: "spring", stiffness: 460, damping: 38, mass: 0.8 }}
      >
        <Switch location={location}>
          <Route path="/" component={Home} />
          <Route path="/scan" component={Scan} />
          <Route path="/members" component={Members} />
          <Route path="/members/:id" component={MemberDetail} />
          <Route path="/access-points" component={AccessPoints} />
          <Route path="/events" component={Events} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}
