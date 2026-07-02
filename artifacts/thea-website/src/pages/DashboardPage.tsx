import React from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useListTrends, useGetLatestAnalysis, useListAlerts, useListWatchlistKeywords, useListCategories } from "@workspace/api-client-react";
import { ShieldAlert, TrendingUp, Eye, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { data: trendsData, isLoading: loadingTrends } = useListTrends<any>({ limit: 5 });
  const { data: analysisData, isLoading: loadingAnalysis } = useGetLatestAnalysis<any>();
  const { data: alertsData, isLoading: loadingAlerts } = useListAlerts<any>({ limit: 5 });
  const { data: watchlistData, isLoading: loadingWatchlist } = useListWatchlistKeywords<any>();
  const { data: categoriesData, isLoading: loadingCategories } = useListCategories<any>();

  return (
    <DashboardLayout title="Analytics Overview">
      <div className="flex flex-col gap-8">
        
        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">Active Trends</p>
              {loadingTrends ? (
                <Skeleton className="h-8 w-16 bg-slate-800" />
              ) : (
                <h3 className="text-3xl font-display font-bold text-slate-100">{trendsData?.data?.length || 0}</h3>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">Unresolved Alerts</p>
              {loadingAlerts ? (
                <Skeleton className="h-8 w-16 bg-slate-800" />
              ) : (
                <h3 className="text-3xl font-display font-bold text-slate-100">{alertsData?.data?.filter((a: any) => a.status === "open").length || 0}</h3>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">Watched Entities</p>
              {loadingWatchlist ? (
                <Skeleton className="h-8 w-16 bg-slate-800" />
              ) : (
                <h3 className="text-3xl font-display font-bold text-slate-100">{watchlistData?.data?.length || 0}</h3>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">Categories</p>
              {loadingCategories ? (
                <Skeleton className="h-8 w-16 bg-slate-800" />
              ) : (
                <h3 className="text-3xl font-display font-bold text-slate-100">{categoriesData?.data?.length || 0}</h3>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Content Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Top Trending Topics</CardTitle>
              <CardDescription className="text-slate-400">Highest momentum narratives currently tracked.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTrends ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full bg-slate-800" />)}
                </div>
              ) : trendsData?.data?.length ? (
                <div className="space-y-4">
                  {trendsData.data.slice(0, 5).map((trend: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">{trend.topic}</span>
                        <span className="text-xs text-slate-500">{trend.category}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{trend.score.toFixed(1)} score</span>
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${Math.min(trend.score, 100)}%` }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 text-slate-500">No active trends found.</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Latest Analysis</CardTitle>
              <CardDescription className="text-slate-400">Automated narrative summaries.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAnalysis ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full bg-slate-800" />
                  <Skeleton className="h-24 w-full bg-slate-800" />
                </div>
              ) : analysisData?.data?.length ? (
                <div className="space-y-4">
                  {analysisData.data.slice(0, 3).map((analysis: any, i: number) => (
                    <div key={i} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">{analysis.category}</Badge>
                        <span className="text-xs text-slate-500">{new Date(analysis.runAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-slate-300 line-clamp-3">{analysis.narrativeSummary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 text-slate-500">No recent analysis available.</div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}