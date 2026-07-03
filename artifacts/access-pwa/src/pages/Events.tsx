import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ShieldCheck, ShieldX } from "lucide-react";
import { listAccessEvents } from "@workspace/api-client-react";
import { reasonLabel } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Events() {
  const events = useQuery({
    queryKey: ["events", 100],
    queryFn: () => listAccessEvents({ limit: 100 }).then((r) => r.data),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Access log</h1>
        <p className="text-sm text-muted-foreground">
          Recent verification attempts
        </p>
      </div>

      {events.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : events.data && events.data.length > 0 ? (
        <div className="space-y-2">
          {events.data.map((ev) => {
            const granted = ev.decision === "granted";
            return (
              <div
                key={ev.id}
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
                    <ShieldCheck className="h-4.5 w-4.5" />
                  ) : (
                    <ShieldX className="h-4.5 w-4.5" />
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
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <CalendarClock className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No access events yet</p>
        </div>
      )}
    </div>
  );
}
