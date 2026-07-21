import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Scale } from "lucide-react";
import { api, fmtUsd, fmtPct, type BenchmarkReport, type MmpApp } from "./api";

export const APP_CATEGORIES = [
  { value: "gaming", label: "Gaming" },
  { value: "social", label: "Social" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "finance", label: "Finance" },
  { value: "utility", label: "Utility" },
  { value: "health", label: "Health & Fitness" },
  { value: "education", label: "Education" },
  { value: "travel", label: "Travel" },
  { value: "other", label: "Other" },
];

function fmtMetric(value: number | null, unit: "usd" | "pct" | "ratio"): string {
  if (value === null || value === undefined) return "—";
  if (unit === "usd") return fmtUsd(value);
  if (unit === "pct") return fmtPct(value);
  return value.toFixed(2);
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "better") {
    return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" variant="outline">Better</Badge>;
  }
  if (verdict === "worse") {
    return <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" variant="outline">Worse</Badge>;
  }
  if (verdict === "inline") {
    return <Badge variant="secondary">In line</Badge>;
  }
  return <Badge variant="outline" className="text-muted-foreground">No data</Badge>;
}

export function BenchmarksTab({ apps, selectedAppId }: { apps: MmpApp[]; selectedAppId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const appId = selectedAppId !== "all" ? selectedAppId : apps[0]?.id;
  const app = apps.find((a) => a.id === appId);

  const benchQ = useQuery({
    queryKey: ["mmp", "benchmarks", appId, app?.category],
    queryFn: () => api<BenchmarkReport>(`/benchmarks?appId=${appId}`),
    enabled: Boolean(appId),
  });

  const setCategory = useMutation({
    mutationFn: (category: string) =>
      api<MmpApp>(`/apps/${appId}`, { method: "PATCH", body: JSON.stringify({ category }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mmp"] });
      toast({ title: "Category updated", description: "Benchmarks now compare against the new category." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  if (!appId) {
    return (
      <Card data-testid="tab-benchmarks">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Register an app first — benchmarks compare a single app against its industry category.
        </CardContent>
      </Card>
    );
  }

  const report = benchQ.data;

  return (
    <div className="space-y-4" data-testid="tab-benchmarks">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="w-4 h-4" /> Industry benchmarks — {app?.name}
              </CardTitle>
              <CardDescription className="mt-1">
                Your last-{report?.windows.performanceDays ?? 30}-day performance vs. standard industry medians
                for your app category. Retention uses installs old enough to measure
                (last {report?.windows.retentionInstallWindowDays ?? 90} days).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Category</span>
              <Select
                value={app?.category ?? "other"}
                onValueChange={(v) => setCategory.mutate(v)}
                disabled={setCategory.isPending}
              >
                <SelectTrigger className="w-44" data-testid="select-benchmark-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {benchQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !report ? (
            <p className="text-sm text-muted-foreground">Could not load benchmarks.</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Metric</th>
                      <th className="py-2 pr-4 font-medium text-right">You</th>
                      <th className="py-2 pr-4 font-medium text-right">Industry median</th>
                      <th className="py-2 pr-4 font-medium text-center">Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.metrics.map((m) => (
                      <tr key={m.key} className="border-b last:border-0" data-testid={`row-benchmark-${m.key}`}>
                        <td className="py-2 pr-4 font-medium">
                          {m.label}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({m.direction === "higher" ? "higher is better" : "lower is better"})
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right font-medium">{fmtMetric(m.yours, m.unit)}</td>
                        <td className="py-2 pr-4 text-right text-muted-foreground">{fmtMetric(m.benchmark, m.unit)}</td>
                        <td className="py-2 pr-4 text-center"><VerdictBadge verdict={m.verdict} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground border-t pt-3" data-testid="text-benchmark-source">
                Benchmarks v{report.benchmarksVersion} — {report.source}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
