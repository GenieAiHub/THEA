import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronRight,
  DoorOpen,
  ScanFace,
  ShieldCheck,
  ShieldX,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  listAccessEvents,
  listAccessPoints,
  listMembers,
} from "@workspace/api-client-react";
import { reasonLabel } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { PressableLink } from "@/components/native/Pressable";
import { PullToRefresh } from "@/components/native/PullToRefresh";
import { staggerContainer, staggerItem } from "@/components/native/motion";
import { formatDistanceToNow } from "date-fns";

export default function Home() {
  const { user } = useAuth();
  const members = useQuery({
    queryKey: ["members"],
    queryFn: () => listMembers().then((r) => r.data),
  });
  const points = useQuery({
    queryKey: ["points"],
    queryFn: () => listAccessPoints().then((r) => r.data),
  });
  const events = useQuery({
    queryKey: ["events", 8],
    queryFn: () => listAccessEvents({ limit: 8 }).then((r) => r.data),
  });

  const firstName = (user?.name ?? "").split(" ")[0] || "there";

  const refresh = () =>
    Promise.all([members.refetch(), points.refetch(), events.refetch()]);

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid="text-greeting"
          >
            {firstName}
          </h1>
        </div>

        {/* Primary action */}
        <PressableLink
          href="/scan"
          hapticPattern="select"
          className="flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/25"
          data-testid="link-scan-cta"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            <ScanFace className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold">Scan a face</p>
            <p className="text-sm text-primary-foreground/80">
              Verify access at an entry point
            </p>
          </div>
          <ChevronRight className="h-5 w-5 opacity-80" />
        </PressableLink>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-2 gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          <StatCard
            to="/members"
            icon={<Users className="h-5 w-5 text-primary" />}
            label="Members"
            value={members.data?.length}
            loading={members.isLoading}
            testid="stat-members"
          />
          <StatCard
            to="/access-points"
            icon={<DoorOpen className="h-5 w-5 text-accent-foreground" />}
            label="Access points"
            value={points.data?.length}
            loading={points.isLoading}
            testid="stat-points"
          />
        </motion.div>

        {/* Recent activity */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Recent activity
            </h2>
            <PressableLink
              href="/events"
              className="flex items-center text-xs font-medium text-primary"
              data-testid="link-all-events"
            >
              View all <ChevronRight className="h-3 w-3" />
            </PressableLink>
          </div>

          {events.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : events.data && events.data.length > 0 ? (
            <motion.div
              className="space-y-2"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {events.data.map((ev) => {
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
                        {formatDistanceToNow(new Date(ev.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
              <CalendarClock className="mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No activity yet</p>
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

function StatCard({
  to,
  icon,
  label,
  value,
  loading,
  testid,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  testid: string;
}) {
  return (
    <motion.div variants={staggerItem}>
      <PressableLink
        href={to}
        className="block rounded-2xl border border-border bg-card p-4"
        data-testid={testid}
      >
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-10" />
        ) : (
          <p className="text-2xl font-bold">{value ?? 0}</p>
        )}
        <p className="text-xs text-muted-foreground">{label}</p>
      </PressableLink>
    </motion.div>
  );
}
