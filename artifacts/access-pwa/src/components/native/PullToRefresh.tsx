import { useRef, useState, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { ArrowDown, Loader2 } from "lucide-react";
import { spring } from "./motion";
import { haptic } from "@/lib/haptics";

const THRESHOLD = 72;
const MAX_PULL = 120;

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  children: ReactNode;
  disabled?: boolean;
}

/** Wraps scrollable content with a touch pull-to-refresh gesture. Only arms at
 * the top of the page; degrades to a plain container on non-touch devices. */
export function PullToRefresh({
  onRefresh,
  children,
  disabled,
}: PullToRefreshProps) {
  const y = useMotionValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const armed = useRef(false);

  const indicatorY = useTransform(y, (v) => v - 40);
  const indicatorOpacity = useTransform(y, [0, THRESHOLD], [0, 1]);
  const indicatorRotate = useTransform(y, [0, THRESHOLD], [0, 180]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled || refreshing || window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
    armed.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || startY.current == null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      y.set(0);
      return;
    }
    const val = Math.min(delta * 0.5, MAX_PULL);
    y.set(val);
    if (val >= THRESHOLD && !armed.current) {
      armed.current = true;
      haptic("tap");
    } else if (val < THRESHOLD) {
      armed.current = false;
    }
  };

  const onTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    startY.current = null;
    if (y.get() >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      animate(y, 44, spring);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        animate(y, 0, spring);
      }
    } else {
      animate(y, 0, spring);
    }
  };

  // If the OS interrupts the gesture (notification shade, incoming call), reset
  // so the content doesn't stay stuck mid-pull until the next touch.
  const onTouchCancel = () => {
    if (!pulling.current) return;
    pulling.current = false;
    startY.current = null;
    armed.current = false;
    if (!refreshing) animate(y, 0, spring);
  };

  return (
    <div
      className="relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <motion.div
        style={{ y: indicatorY, opacity: indicatorOpacity }}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-sm">
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <motion.div style={{ rotate: indicatorRotate }}>
              <ArrowDown className="h-4 w-4 text-primary" />
            </motion.div>
          )}
        </div>
      </motion.div>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
