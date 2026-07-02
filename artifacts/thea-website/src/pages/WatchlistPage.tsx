import React, { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListWatchlistKeywords,
  useCreateWatchlistKeyword,
  useDeleteWatchlistKeyword,
  getListWatchlistKeywordsQueryKey,
  useListContent,
  useListAlerts,
  useListTrends,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trash2, Plus, Loader2, Eye, TrendingUp, ShieldAlert, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export default function WatchlistPage() {
  const { data: keywordsData, isLoading } = useListWatchlistKeywords<any>();
  const createKeyword = useCreateWatchlistKeyword();
  const deleteKeyword = useDeleteWatchlistKeyword();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<"keyword" | "brand" | "person" | "competitor">("keyword");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const keywords = (keywordsData?.data || []) as any[];
  const selected = keywords.find((k) => k.id === selectedId);

  const { data: contentData, isLoading: loadingContent } = useListContent(
    { search: selected?.keyword || "", limit: 20 } as any,
    { query: { enabled: !!selected?.keyword, queryKey: ["/api/v1/content/watchlist", { kw: selected?.keyword }] } }
  );
  const { data: alertsData } = useListAlerts<any>({ limit: 100 });
  const { data: trendsData } = useListTrends<any>({ limit: 100 });

  const contentItems = (contentData?.data || []) as any[];

  const matchingAlerts = useMemo(() =>
    (alertsData?.data || []).filter((a: any) => {
      const kw = (selected?.keyword || "").toLowerCase();
      return kw && (
        a.title?.toLowerCase().includes(kw) ||
        a.message?.toLowerCase().includes(kw)
      );
    }), [alertsData, selected?.keyword]);

  const matchingTrends = useMemo(() =>
    ((trendsData?.data || []) as any[]).filter((t) => {
      const kw = (selected?.keyword || "").toLowerCase();
      return kw && t.topic?.toLowerCase().includes(kw);
    }).slice(0, 10), [trendsData, selected?.keyword]);

  const criticalCount = matchingAlerts.filter((a: any) => a.severity === "critical").length;
  const highCount = matchingAlerts.filter((a: any) => a.severity === "high").length;
  const crisisScore = Math.min(100, criticalCount * 25 + highCount * 10 + matchingAlerts.length * 3);

  const sparklineData = matchingTrends.map((t: any, i: number) => ({
    name: t.topic?.slice(0, 14) || `T${i + 1}`,
    score: t.score || 0,
    mentions: t.mentionCount || 0,
  }));

  const avgSentiment = contentItems.length
    ? contentItems.reduce((s, i: any) => s + (i.sentimentScore || 0), 0) / contentItems.length
    : null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    try {
      const result: any = await createKeyword.mutateAsync({ data: { keyword, type, category: "general" } });
      setKeyword("");
      queryClient.invalidateQueries({ queryKey: getListWatchlistKeywordsQueryKey() });
      toast({ title: "Keyword added to watchlist" });
      if (result?.data?.id) setSelectedId(result.data.id);
    } catch {
      toast({ title: "Failed to add keyword", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKeyword.mutateAsync({ id });
      if (selectedId === id) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: getListWatchlistKeywordsQueryKey() });
      toast({ title: "Keyword removed" });
    } catch {
      toast({ title: "Failed to remove keyword", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout title="Watchlist">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left column: add form + keyword list */}
          <div className="flex flex-col gap-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base">Add Keyword</CardTitle>
                <CardDescription className="text-slate-400 text-sm">Track entities, brands, or topics.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="flex flex-col gap-3">
                  <Input
                    placeholder="e.g. Acme Corp"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500"
                  />
                  <Select value={type} onValueChange={(v: any) => setType(v)}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="keyword">Keyword</SelectItem>
                      <SelectItem value="brand">Brand</SelectItem>
                      <SelectItem value="person">Person</SelectItem>
                      <SelectItem value="competitor">Competitor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-500 w-full" disabled={createKeyword.isPending || !keyword.trim()}>
                    {createKeyword.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Add to Watchlist
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-base">Active Keywords</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full bg-slate-800 rounded-lg" />)}
                  </div>
                ) : keywords.length > 0 ? (
                  <div className="space-y-2">
                    {keywords.map((item: any) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedId === item.id
                            ? "bg-blue-600/10 border-blue-600/40"
                            : "bg-slate-950 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Eye className={`w-3.5 h-3.5 shrink-0 ${selectedId === item.id ? "text-blue-400" : "text-slate-600"}`} />
                          <div className="min-w-0">
                            <p className={`font-medium text-sm truncate ${selectedId === item.id ? "text-blue-300" : "text-slate-200"}`}>{item.keyword}</p>
                            <p className="text-xs text-slate-500 capitalize">{item.type}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 shrink-0 text-slate-600 hover:text-red-400 hover:bg-red-400/10"
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        >
                          {deleteKeyword.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-sm">Your watchlist is empty.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: detail panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-display font-bold text-slate-100">{selected.keyword}</h2>
                    <p className="text-sm text-slate-500 capitalize mt-0.5">
                      {selected.type} · Added {selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : "recently"}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Open Alerts</span>
                    </div>
                    <span className="text-2xl font-display font-bold text-slate-100">
                      {matchingAlerts.filter((a: any) => a.status === "open").length}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2 mb-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Trend Hits</span>
                    </div>
                    <span className="text-2xl font-display font-bold text-blue-400">{matchingTrends.length}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Eye className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Content Items</span>
                    </div>
                    <span className="text-2xl font-display font-bold text-purple-400">{contentItems.length}</span>
                  </div>
                </div>

                {/* Crisis Score Gauge */}
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">Crisis Score</p>
                        <p className="text-xs text-slate-500 mt-0.5">Weighted by alert severity and signal density</p>
                      </div>
                      <span className={`text-4xl font-display font-bold ${
                        crisisScore >= 70 ? "text-red-400" :
                        crisisScore >= 40 ? "text-amber-400" : "text-emerald-400"
                      }`}>{crisisScore}</span>
                    </div>
                    <Progress
                      value={crisisScore}
                      className={`h-3 bg-slate-800 [&>div]:transition-all ${
                        crisisScore >= 70 ? "[&>div]:bg-red-500" :
                        crisisScore >= 40 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"
                      }`}
                    />
                    <div className="flex justify-between text-xs mt-2">
                      <span className="text-slate-600">Low risk</span>
                      <span className={`font-semibold ${
                        crisisScore >= 70 ? "text-red-400" :
                        crisisScore >= 40 ? "text-amber-400" : "text-emerald-400"
                      }`}>
                        {crisisScore >= 70 ? "HIGH RISK" : crisisScore >= 40 ? "ELEVATED" : "NORMAL"}
                      </span>
                      <span className="text-slate-600">Critical</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabs: Trend Activity / Content Feed / Alert History */}
                <Tabs defaultValue="trends">
                  <TabsList className="bg-slate-900 border border-slate-800 h-9">
                    <TabsTrigger value="trends" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">Trend Activity</TabsTrigger>
                    <TabsTrigger value="content" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">Content Feed</TabsTrigger>
                    <TabsTrigger value="alerts" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">Alert History</TabsTrigger>
                  </TabsList>

                  <TabsContent value="trends" className="mt-4">
                    {sparklineData.length > 0 ? (
                      <Card className="bg-slate-900 border-slate-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-slate-100 text-sm">Trend Score Sparkline</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-36">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={sparklineData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="name" stroke="#475569" fontSize={10} tick={{ fontSize: 9 }} />
                                <YAxis stroke="#475569" fontSize={10} />
                                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc", fontSize: 11 }} />
                                <Area type="monotone" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-3 space-y-1.5">
                            {matchingTrends.slice(0, 5).map((t: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-slate-950 border border-slate-800">
                                <span className="text-slate-300 truncate">{t.topic}</span>
                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                  <span className="text-slate-500">{t.mentionCount || 0} mentions</span>
                                  <span className="text-blue-400 font-mono font-bold">{(t.score || 0).toFixed(0)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="py-12 text-center text-slate-500">
                        No trend signals matched "{selected.keyword}".
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="content" className="mt-4">
                    {loadingContent ? (
                      <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 bg-slate-800 rounded-lg" />)}</div>
                    ) : contentItems.length > 0 ? (
                      <div className="space-y-3">
                        {avgSentiment !== null && (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 text-sm">
                            <span className="text-slate-500">Avg sentiment:</span>
                            <span className={`font-mono font-bold ${avgSentiment > 0.05 ? "text-emerald-400" : avgSentiment < -0.05 ? "text-red-400" : "text-slate-400"}`}>
                              {avgSentiment > 0 ? "+" : ""}{avgSentiment.toFixed(3)}
                            </span>
                            <span className="text-slate-600">across {contentItems.length} items</span>
                          </div>
                        )}
                        {contentItems.map((item: any) => (
                          <div key={item.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-slate-200 line-clamp-1">{item.title || "Untitled"}</p>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700 text-xs capitalize">{item.platform}</Badge>
                                {item.sourceUrl && (
                                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.body}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
                              <span className={item.sentimentScore > 0 ? "text-emerald-400" : item.sentimentScore < 0 ? "text-red-400" : ""}>
                                {item.sentimentScore != null ? `${item.sentimentScore > 0 ? "+" : ""}${item.sentimentScore.toFixed(2)}` : ""}
                              </span>
                              <span>{item.collectedAt ? new Date(item.collectedAt).toLocaleDateString() : ""}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500">No content found for "{selected.keyword}".</div>
                    )}
                  </TabsContent>

                  <TabsContent value="alerts" className="mt-4">
                    {matchingAlerts.length > 0 ? (
                      <div className="space-y-3">
                        {matchingAlerts.map((alert: any, i: number) => (
                          <div key={alert.id || i} className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-slate-200">{alert.title}</p>
                              <Badge className={
                                alert.severity === "critical" ? "bg-red-500/10 text-red-400 border-red-500/20 shrink-0" :
                                alert.severity === "high" ? "bg-orange-500/10 text-orange-400 border-orange-500/20 shrink-0" :
                                "bg-slate-700/50 text-slate-400 border-slate-700 shrink-0"
                              }>{alert.severity || "medium"}</Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{alert.message}</p>
                            <p className="text-xs text-slate-600 mt-1.5">{alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : ""}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500">No alerts have been triggered by this keyword.</div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center min-h-72">
                <div className="text-center text-slate-600">
                  <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-slate-500">Select a keyword to view analytics</p>
                  <p className="text-sm mt-1">Crisis score · Trend sparkline · Content feed · Alert history</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
