import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useListTrends, useGetLatestAnalysis, useListAlerts, useListWatchlistKeywords, useListCategories } from "@workspace/api-client-react";
import { alertTitle, sovShiftText } from "@/lib/alertPresentation";
import { ShieldAlert, TrendingUp, Eye, Activity, RefreshCw, Flame, Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const REFRESH_INTERVAL_SECONDS = 120;

export default function DashboardPage() {
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: trendsData, isLoading: loadingTrends, refetch: refetchTrends } = useListTrends<any>({ limit: 50 });
  const { data: analysisData, isLoading: loadingAnalysis, refetch: refetchAnalysis } = useGetLatestAnalysis<any>();
  const { data: alertsData, isLoading: loadingAlerts, refetch: refetchAlerts } = useListAlerts<any>({ limit: 100 });
  const { data: watchlistData, isLoading: loadingWatchlist } = useListWatchlistKeywords<any>();
  const { data: categoriesData, isLoading: loadingCategories } = useListCategories<any>();

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setCountdown(REFRESH_INTERVAL_SECONDS);
    await Promise.all([refetchTrends(), refetchAnalysis(), refetchAlerts()]);
    setIsRefreshing(false);
  }, [refetchTrends, refetchAnalysis, refetchAlerts]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleManualRefresh();
          return REFRESH_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [handleManualRefresh]);

  const openAlerts = alertsData?.data?.filter((a: any) => a.status === "open") || [];
  const breakingAlerts = openAlerts
    .filter((a: any) => a.severity === "critical" || a.severity === "high")
    .slice(0, 3);
  const topTrends = trendsData?.data?.slice(0, 5) || [];

  const categoryGroups: Record<string, any[]> = {};
  (trendsData?.data || []).forEach((trend: any) => {
    const cat = trend.category || "Uncategorized";
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    categoryGroups[cat].push(trend);
  });
  const categoryEntries = Object.entries(categoryGroups)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 7);

  const formatCountdown = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <DashboardLayout title="Analytics Overview">
      <div className="flex flex-col gap-8">

        {/* Header row with refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-100">Global Overview</h1>
            <p className="text-sm text-slate-500 mt-1">Live narrative intelligence across all monitored channels</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Refreshes in {formatCountdown(countdown)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh Now
            </Button>
          </div>
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: <TrendingUp className="w-5 h-5 text-blue-400" />, color: "bg-blue-500/10", label: "Active Trends", value: trendsData?.data?.length, loading: loadingTrends },
            { icon: <ShieldAlert className="w-5 h-5 text-red-400" />, color: "bg-red-500/10", label: "Open Alerts", value: openAlerts.length, loading: loadingAlerts },
            { icon: <Eye className="w-5 h-5 text-emerald-400" />, color: "bg-emerald-500/10", label: "Watched Entities", value: watchlistData?.data?.length, loading: loadingWatchlist },
            { icon: <Activity className="w-5 h-5 text-purple-400" />, color: "bg-purple-500/10", label: "Categories", value: categoriesData?.data?.length, loading: loadingCategories },
          ].map((m, i) => (
            <Card key={i} className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className={`w-10 h-10 rounded-full ${m.color} flex items-center justify-center mb-4`}>
                  {m.icon}
                </div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">{m.label}</p>
                {m.loading ? (
                  <Skeleton className="h-8 w-16 bg-slate-800" />
                ) : (
                  <h3 className="text-3xl font-display font-bold text-slate-100">{m.value ?? 0}</h3>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Breaking Now Panel */}
        <Card className="bg-red-950/20 border-red-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 flex items-center gap-2 text-lg">
              <Flame className="w-5 h-5 text-red-400" />
              Breaking Now
            </CardTitle>
            <CardDescription className="text-slate-500">Highest-priority signals requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-red-400/80 mb-3 flex items-center gap-1.5">
                  <Bell className="w-3 h-3" /> Critical Incidents
                </p>
                {loadingAlerts ? (
                  <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 bg-slate-800/50 rounded-md" />)}</div>
                ) : breakingAlerts.length > 0 ? (
                  <div className="space-y-2">
                    {breakingAlerts.map((a: any) => (
                      <Link key={a.id} href="/alerts">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-950/50 border border-red-900/40 hover:border-red-700/50 cursor-pointer transition-colors">
                          <Badge className={a.severity === "critical"
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-orange-500/20 text-orange-400 border-orange-500/30"}>
                            {a.severity?.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-slate-200 truncate">
                            {alertTitle(a)}
                            {sovShiftText(a) && <span className="text-purple-400 ml-2">{sovShiftText(a)}</span>}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 italic py-2">No critical alerts at this time.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-400/80 mb-3 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" /> Top Momentum
                </p>
                {loadingTrends ? (
                  <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 bg-slate-800/50 rounded-md" />)}</div>
                ) : topTrends.length > 0 ? (
                  <div className="space-y-2">
                    {topTrends.slice(0, 3).map((trend: any, i: number) => (
                      <Link key={i} href={`/trends/${encodeURIComponent(trend.topic)}`}>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-950/30 border border-blue-900/30 hover:border-blue-700/50 cursor-pointer transition-colors">
                          <span className="text-xs font-mono text-blue-400 w-8 shrink-0">{trend.score?.toFixed(0)}</span>
                          <span className="text-sm text-slate-200 truncate flex-1">{trend.topic}</span>
                          <Badge variant="outline" className="ml-auto bg-slate-900 text-slate-400 border-slate-700 text-xs shrink-0">{trend.category}</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 italic py-2">No trending topics detected.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 7-Category Breakdown Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-slate-200">Trend Activity by Category</h2>
            <Link href="/trends">
              <span className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">View all →</span>
            </Link>
          </div>
          {loadingTrends ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-28 bg-slate-900 rounded-xl" />
              ))}
            </div>
          ) : categoryEntries.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {categoryEntries.map(([category, trends]) => {
                const topTrend = trends[0];
                const avgScore = trends.reduce((s: number, t: any) => s + (t.score || 0), 0) / trends.length;
                return (
                  <Link key={category} href={`/trends?category=${encodeURIComponent(category)}`}>
                    <Card className="bg-slate-900 border-slate-800 hover:border-blue-500/40 transition-all cursor-pointer h-full">
                      <CardContent className="p-3 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-semibold text-slate-200 text-xs leading-tight">{category}</h3>
                          <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700 text-xs shrink-0 px-1 py-0">{trends.length}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 truncate leading-tight">{topTrend?.topic}</p>
                        <div className="mt-auto pt-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-600">Score</span>
                            <span className="text-xs text-blue-400 font-mono">{avgScore.toFixed(0)}</span>
                          </div>
                          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${Math.min(avgScore, 100)}%` }} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
              No trend data available yet.
            </div>
          )}
        </div>

        {/* Latest Analysis */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Latest Narrative Analysis</CardTitle>
            <CardDescription className="text-slate-400">Most recent automated summaries from the intelligence engine.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAnalysis ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full bg-slate-800" />)}
              </div>
            ) : analysisData?.data?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analysisData.data.slice(0, 3).map((analysis: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">{analysis.category}</Badge>
                      <span className="text-xs text-slate-600">{new Date(analysis.runAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-3 flex-1">{analysis.narrativeSummary}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Activity className="w-3 h-3" />
                      <span>{analysis.itemsAnalyzed || 0} items analyzed</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 text-slate-500">No analysis data available yet.</div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
