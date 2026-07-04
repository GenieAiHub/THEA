import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { spring } from "./motion";

interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Unique id so multiple controls on a page animate independently. */
  layoutId?: string;
}

/** iOS-style segmented control with an animated selection pill. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
  layoutId = "segmented-active",
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("relative flex rounded-xl bg-secondary p-1", className)}>
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <button
            key={seg.value}
            type="button"
            onClick={() => {
              if (!active) {
                haptic("select");
                onChange(seg.value);
              }
            }}
            className={cn(
              "relative z-10 flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
            )}
            data-testid={`segment-${seg.value}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={spring}
                className="absolute inset-0 -z-10 rounded-lg bg-card shadow-sm ring-1 ring-border"
              />
            )}
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
