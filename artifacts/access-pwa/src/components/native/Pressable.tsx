import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { haptic, type HapticPattern } from "@/lib/haptics";
import { spring } from "./motion";

type PressableProps = HTMLMotionProps<"button"> & {
  /** Haptic fired on press; pass null to disable. */
  hapticPattern?: HapticPattern | null;
};

/** A button with a native-feeling tap-scale and haptic feedback. */
export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(
  ({ className, hapticPattern = "tap", onClick, disabled, ...props }, ref) => (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={spring}
      className={cn(
        "select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      onClick={(e) => {
        if (hapticPattern) haptic(hapticPattern);
        onClick?.(e);
      }}
      {...props}
    />
  ),
);
Pressable.displayName = "Pressable";

type PressableLinkProps = Omit<HTMLMotionProps<"a">, "href"> & {
  href: string;
  hapticPattern?: HapticPattern | null;
};

/** A wouter link with tap-scale + haptics; falls back to native behaviour for
 * modified clicks (open-in-new-tab etc). */
export function PressableLink({
  href,
  className,
  hapticPattern = "tap",
  onClick,
  children,
  ...props
}: PressableLinkProps) {
  const [, navigate] = useLocation();
  return (
    <motion.a
      href={href}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className={cn(
        "select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (hapticPattern) haptic(hapticPattern);
        onClick?.(e);
        navigate(href);
      }}
      {...props}
    >
      {children}
    </motion.a>
  );
}
