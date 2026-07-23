import { useQuery } from "@tanstack/react-query";
import { BellOff } from "lucide-react";
import { motion } from "framer-motion";
import { listAlerts } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeHeader } from "@/components/native/NativeHeader";
import { PullToRefresh } from "@/components/native/PullToRefresh";
import { staggerContainer, staggerItem } from "@/components/native/motion";
import {
  alertDescription,
  alertTitle,
  alertTypeInfo,
  isSovAlert,
  sovOvertakenText,
  sovShiftText,
  type OrgAlert,
} from "@/lib/alertPresentation";

function severityClass(severity: string): string {
  if (severity === "critical") return "bg-destructive/15 text-destructive border-destructive/25";
  if (severity === "high") return "bg-warning/15 text-warning border-warning/25";
  return "bg-secondary text-muted-foreground border-border";
}

export default function Alerts() {
  const alerts = useQuery({
    queryKey: ["org-alerts", 100],
    queryFn: () =>
      (listAlerts({ limit: 100 }) as unknown as Promise<{ data: OrgAlert[] }>).then(
        (r) => r?.data ?? [],
      ),
  });

  const list = alerts.data ?? [];

  return (
    <PullToRefresh onRefresh={() => alerts.refetch()}>
      <div className="space-y-5">
        <NativeHeader
          title="Alerts"
          subtitle="Intelligence alerts for your organisation"
        />

        {alerts.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : list.length > 0 ? (
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {list.map((alert) => {
              const info = alertTypeInfo(alert);
              const description = alertDescription(alert);
              const sov = isSovAlert(alert);
              const shift = sov ? sovShiftText(alert) : null;
              const overtaken = sov ? sovOvertakenText(alert) : null;
              return (
                <motion.div
                  key={alert.id}
                  variants={staggerItem}
                  className="rounded-xl border border-border bg-card p-3"
                  data-testid={`alert-${alert.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        info.badgeClass,
                      )}
                    >
                      {info.icon}
                      {info.label}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        severityClass(alert.severity),
                      )}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-snug">
                    {alertTitle(alert)}
                  </p>
                  {sov && (shift || overtaken) ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {shift && (
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
                          {shift}
                        </span>
                      )}
                      {overtaken && (
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
                          {overtaken}
                        </span>
                      )}
                    </div>
                  ) : description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                  ) : null}
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    {alert.status !== "open" && alert.status !== "new"
                      ? ` · ${alert.status}`
                      : ""}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <BellOff className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No alerts yet — spike, AI narrative and share-of-voice alerts will
              appear here.
            </p>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
