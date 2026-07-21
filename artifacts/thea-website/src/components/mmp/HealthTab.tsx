import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Info, ShieldAlert, HeartPulse } from "lucide-react";
import { api, type HealthReport } from "./api";

const SEVERITY_META = {
  critical: { icon: ShieldAlert, badge: "destructive" as const, ring: "text-red-500" },
  warning: { icon: AlertTriangle, badge: "default" as const, ring: "text-amber-500" },
  info: { icon: Info, badge: "secondary" as const, ring: "text-blue-500" },
};

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 90 ? "stroke-emerald-500" : score >= 70 ? "stroke-amber-500" : "stroke-red-500";
  return (
    <div className="relative w-32 h-32" data-testid="health-score-ring">
      <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          className={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export function HealthTab({ appId }: { appId: string | null }) {
  const healthQ = useQuery({
    queryKey: ["mmp", "health", appId],
    queryFn: () => api<HealthReport>(`/health?appId=${appId}`),
    enabled: Boolean(appId),
  });

  if (!appId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Select a specific app in the filter above to view its attribution health.
        </CardContent>
      </Card>
    );
  }

  if (healthQ.isLoading) return <Skeleton className="h-64 w-full" />;
  if (healthQ.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {(healthQ.error as Error).message}
        </CardContent>
      </Card>
    );
  }

  const h = healthQ.data!;
  return (
    <div className="space-y-4" data-testid="tab-health">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HeartPulse className="w-4 h-4" /> Attribution health — {h.appName}
          </CardTitle>
          <CardDescription>
            Automated data-quality checks over the last {h.windowDays} days
            ({h.sample.installs} installs · {h.sample.events} events in sample).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-8">
          <ScoreRing score={h.score} />
          <div>
            <Badge
              variant={h.score >= 90 ? "secondary" : h.score >= 70 ? "default" : "destructive"}
              className="capitalize mb-2"
              data-testid="badge-health-status"
            >
              {h.status}
            </Badge>
            <p className="text-sm text-muted-foreground max-w-md">
              Score starts at 100 and loses 25 points per critical issue, 10 per warning and 3 per
              informational finding. Checks only fire once there is enough data to be meaningful.
            </p>
          </div>
        </CardContent>
      </Card>

      {h.issues.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No issues detected — your attribution data looks clean.
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {h.issues.map((issue) => {
            const meta = SEVERITY_META[issue.severity] ?? SEVERITY_META.info;
            const Icon = meta.icon;
            return (
              <Card key={issue.id} data-testid={`health-issue-${issue.id}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${meta.ring}`} />
                    {issue.title}
                    <Badge variant={meta.badge} className="ml-auto capitalize">{issue.severity}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{issue.detail}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
