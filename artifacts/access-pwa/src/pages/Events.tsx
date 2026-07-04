import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ShieldCheck, ShieldX } from "lucide-react";
import { motion } from "framer-motion";
import { listAccessEvents } from "@workspace/api-client-react";
import { reasonLabel } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeHeader } from "@/components/native/NativeHeader";
import { SegmentedControl } from "@/components/native/SegmentedControl";
import { PullToRefresh } from "@/components/native/PullToRefresh";
import { staggerContainer, staggerItem } from "@/components/native/motion";
import { format } from "date-fns";

type Filter = "all" | "granted" | "denied";

export default function Events() {
  const events = useQuery({
    queryKey: ["events", 100],
    queryFn: () => listAccessEvents({ limit: 100 }).then((r) => r.data),
  });
  const [filter, setFilter] = useState<Filter>("all");

  const list = useMemo(() => {
    const all = events.data ?? [];
    if (filter === "all") return all;
    return all.filter((ev) => ev.decision === filter);
  }, [events.data, filter]);

  return (
    <PullToRefresh onRefresh={() => events.refetch()}>
      <div className="space-y-5">
        <NativeHeader
          title="Access log"
          subtitle="Recent verification attempts"
        />

        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          layoutId="events-filter"
          segments={[
            { value: "all", label: "All" },
            { value: "granted", label: "Granted" },
            { value: "denied", label: "Denied" },
          ]}
        />

        {events.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : list.length > 0 ? (
          <motion.div
            key={filter}
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {list.map((ev) => {
              const granted = ev.decision === "granted";
              return (
                <motion.div
                  key={ev.id}
                  variants={staggerItem}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                  data-testid={`event-${ev.id}`}
                >
                  <div
                    className={
                      granted
                        ? "flex h-9 w-9 items-center justify-center rounded-lg bg-success/15 text-success"
                        : "flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive"
                    }
                  >
                    {granted ? (
                      <ShieldCheck className="h-[18px] w-[18px]" />
                    ) : (
                      <ShieldX className="h-[18px] w-[18px]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {ev.memberName ?? reasonLabel(ev.reason)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ev.accessPointName ?? "Unknown point"} ·{" "}
                      {reasonLabel(ev.reason)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
                    {format(new Date(ev.createdAt), "MMM d")}
                    <br />
                    {format(new Date(ev.createdAt), "h:mm a")}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <CalendarClock className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "No access events yet"
                : `No ${filter} events`}
            </p>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
