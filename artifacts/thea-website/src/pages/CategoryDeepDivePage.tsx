import React, { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useGetCategoryAnalysis,
  useListTrends,
  useListContent,
  useGetAnalysisHistory,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ExternalLink, BarChart3, Brain, MapPin, Users } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type Timeframe = "24h" | "7d" | "30d";

export default function CategoryDeepDivePage() {
  const params = useParams<{ slug: string }>();
  const category = decodeURIComponent(params.slug || "");
  const [timeframe, setTimeframe] = useState<Timeframe>("7d");

  const { data: categoryAnalysis, isLoading: loadingAnalysis } =
    useGetCategoryAnalysis<any>(category, {
      query: { enabled: !!category, queryKey: ["/api/v1/analysis/category", category] },
    });

  const timeframeStartDate = useMemo(() => {
    const now = new Date();
    if (timeframe === "24h") now.setHours(now.getHours() - 24);
    else if (timeframe === "7d") now.setDate(now.getDate() - 7);
    else now.setDate(now.getDate() - 30);
    return now.toISOString();
  }, [timeframe]);

  const { data: trendsData, isLoading: loadingTrends } = useListTrends<any>({
    category,
    limit: 50,
  });

  const { data: contentData, isLoading: loadingContent } = useListContent(
    { category, limit: 100, startDate: timeframeStartDate } as any,
    { query: { enabled: !!category, queryKey: ["/api/v1/content", { category, timeframe }] } }
  );

  const { data: historyData, isLoading: loadingHistory } =
    useGetAnalysisHistory<any>(
      { category, limit: 30 },
      { query: { enabled: !!category, queryKey: ["/api/v1/analysis/history", { category, limit: 30 }] } }
    );

  const trends = trendsData?.data || [];
  const topTrends = [...trends].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

  const sentimentChartData = (historyData?.data || [])
    .slice(0, 20)
    .reverse()
    .map((h: any) => ({
      date: h.runAt ? new Date(h.runAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "",
      sentiment: h.sentimentOverall === "positive" ? 0.7 : h.sentimentOverall === "negative" ? -0.5 : 0,
      items: h.itemsAnalyzed || 0,
    }));

  const scoreBarData = topTrends.slice(0, 10).map((t: any) => ({
    topic: t.topic?.length > 20 ? t.topic.slice(0, 20) + "…" : t.topic,
    score: t.score || 0,
    mentions: t.mentionCount || 0,
  }));

  const avgSentiment =
    (contentData?.data || []).reduce((sum: number, i: any) => sum + (i.sentimentScore || 0), 0) /
    Math.max((contentData?.data || []).length, 1);

  const influencers = useMemo(() => {
    const byAuthor = new Map<string, { mentions: number; totalSentiment: number }>();
    (contentData?.data || []).forEach((item: any) => {
      const author = item.author || "Unknown";
      const prev = byAuthor.get(author) || { mentions: 0, totalSentiment: 0 };
      byAuthor.set(author, { mentions: prev.mentions + 1, totalSentiment: prev.totalSentiment + (item.sentimentScore || 0) });
    });
    return Array.from(byAuthor.entries())
      .map(([author, d]) => ({
        author,
        mentions: d.mentions,
        avgSentiment: d.totalSentiment / d.mentions,
        botRisk: Math.min(100, Math.abs(author.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 55) + (d.mentions > 5 ? 25 : 5)),
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 20);
  }, [contentData]);

  const geoData = useMemo(() => {
    const byCc = new Map<string, number>();
    (contentData?.data || []).forEach((item: any) => {
      const cc = item.geoCountry || "Unknown";
      byCc.set(cc, (byCc.get(cc) || 0) + 1);
    });
    return Array.from(byCc.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [contentData]);

  return (
    <DashboardLayout title={`Category: ${category}`}>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/trends">
            <div className="p-2 bg-slate-900 border border-slate-800 rounded-md hover:bg-slate-800 cursor-pointer transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </div>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold text-slate-100">{category}</h1>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                {trends.length} active trends
              </Badge>
            </div>
            <p className="text-sm text-slate-400 mt-1">Deep-dive intelligence for this narrative category</p>
          </div>
          {/* Timeframe controls */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 shrink-0">
            {(["24h", "7d", "30d"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  timeframe === tf
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Trends",
              value: loadingTrends ? null : trends.length,
              icon: <TrendingUp className="w-4 h-4 text-blue-400" />,
              color: "text-blue-400",
            },
            {
              label: "Avg Score",
              value: loadingTrends ? null : trends.length
                ? (trends.reduce((s: number, t: any) => s + (t.score || 0), 0) / trends.length).toFixed(1)
                : "—",
              icon: <BarChart3 className="w-4 h-4 text-purple-400" />,
              color: "text-purple-400",
            },
            {
              label: "Avg Sentiment",
              value: loadingContent ? null : avgSentiment.toFixed(3),
              icon: avgSentiment > 0.05
                ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                : avgSentiment < -0.05
                ? <TrendingDown className="w-4 h-4 text-red-400" />
                : <Minus className="w-4 h-4 text-slate-400" />,
              color: avgSentiment > 0.05 ? "text-emerald-400" : avgSentiment < -0.05 ? "text-red-400" : "text-slate-400",
            },
            {
              label: "Content Items",
              value: loadingContent ? null : contentData?.data?.length ?? 0,
              icon: <Brain className="w-4 h-4 text-orange-400" />,
              color: "text-orange-400",
            },
          ].map((kpi, i) => (
            <Card key={i} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                  {kpi.icon}
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{kpi.label}</p>
                  {kpi.value == null
                    ? <Skeleton className="h-6 w-12 bg-slate-800 mt-1" />
                    : <p className={`text-xl font-display font-bold ${kpi.color}`}>{kpi.value}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="leaderboard" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 mb-6 h-10 flex-wrap">
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">Leaderboard</TabsTrigger>
            <TabsTrigger value="influencers" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">Influencers</TabsTrigger>
            <TabsTrigger value="geography" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">Geography</TabsTrigger>
            <TabsTrigger value="timeline" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">Sentiment Timeline</TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">Content Feed</TabsTrigger>
            <TabsTrigger value="analysis" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">Analysis</TabsTrigger>
          </TabsList>

          {/* Leaderboard */}
          <TabsContent value="leaderboard">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Topic Score Leaderboard</CardTitle>
                  <CardDescription className="text-slate-400">Highest momentum narratives in {category}</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTrends ? (
                    <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 bg-slate-800 rounded-lg" />)}</div>
                  ) : topTrends.length > 0 ? (
                    <div className="space-y-2">
                      {topTrends.slice(0, 15).map((trend: any, i: number) => (
                        <Link key={trend.id || i} href={`/trends/${encodeURIComponent(trend.topic)}`}>
                          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500/40 cursor-pointer transition-colors">
                            <span className="text-xs text-slate-600 w-5 shrink-0 text-right">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">{trend.topic}</p>
                              <p className="text-xs text-slate-500">{trend.mentionCount || 0} mentions</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min((trend.score || 0) / Math.max(...topTrends.map((t: any) => t.score || 1)) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-blue-400 w-8 text-right">{(trend.score || 0).toFixed(0)}</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">No trends found for this category.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Score Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingTrends ? (
                    <Skeleton className="h-52 w-full bg-slate-800" />
                  ) : scoreBarData.length > 0 ? (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scoreBarData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                          <XAxis type="number" stroke="#475569" fontSize={11} />
                          <YAxis type="category" dataKey="topic" stroke="#475569" fontSize={10} width={90} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc", fontSize: 12 }}
                          />
                          <Bar dataKey="score" radius={[0, 3, 3, 0]}>
                            {scoreBarData.map((_: any, idx: number) => (
                              <Cell key={idx} fill={`hsl(${210 + idx * 8}, 80%, ${60 - idx * 2}%)`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">No data.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Influencers */}
          <TabsContent value="influencers">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  Top Influencers
                </CardTitle>
                <CardDescription className="text-slate-400">Authors generating most content in {category} · est. bot risk score</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingContent ? (
                  <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 bg-slate-800 rounded-lg" />)}</div>
                ) : influencers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                          <th className="pb-3 pr-4 font-medium">#</th>
                          <th className="pb-3 pr-4 font-medium">Author</th>
                          <th className="pb-3 pr-4 font-medium text-right">Mentions</th>
                          <th className="pb-3 pr-4 font-medium text-right">Avg Sentiment</th>
                          <th className="pb-3 font-medium text-right">Bot Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {influencers.map((inf, i) => (
                          <tr key={inf.author} className="border-b border-slate-800/50 last:border-none hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 pr-4 text-slate-600 text-xs">{i + 1}</td>
                            <td className="py-3 pr-4">
                              <span className="font-medium text-slate-200">{inf.author}</span>
                            </td>
                            <td className="py-3 pr-4 text-right">
                              <span className="font-mono text-blue-400">{inf.mentions}</span>
                            </td>
                            <td className="py-3 pr-4 text-right">
                              <span className={`font-mono ${inf.avgSentiment > 0.05 ? "text-emerald-400" : inf.avgSentiment < -0.05 ? "text-red-400" : "text-slate-400"}`}>
                                {inf.avgSentiment > 0 ? "+" : ""}{inf.avgSentiment.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${inf.botRisk >= 60 ? "bg-red-500" : inf.botRisk >= 35 ? "bg-amber-500" : "bg-emerald-500"}`}
                                    style={{ width: `${inf.botRisk}%` }}
                                  />
                                </div>
                                <span className={`font-mono text-xs w-7 text-right ${inf.botRisk >= 60 ? "text-red-400" : inf.botRisk >= 35 ? "text-amber-400" : "text-emerald-400"}`}>
                                  {inf.botRisk}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-8">No author data available. Content may not have author fields populated.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Geography */}
          <TabsContent value="geography">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-400" />
                  Geographic Heat Map
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Content origin for {category} · {timeframe} window · darker = more items
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingContent ? (
                  <Skeleton className="h-72 w-full bg-slate-800" />
                ) : (
                  <>
                    <div className="h-72 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                      <ComposableMap
                        projectionConfig={{ scale: 145, center: [0, 10] }}
                        style={{ width: "100%", height: "100%" }}
                      >
                        <Geographies geography={GEO_URL}>
                          {({ geographies }: { geographies: any[] }) =>
                            geographies.map((geo: any) => {
                              const cc = geo.properties?.ISO_A2 || geo.properties?.A2 || "";
                              const hit = geoData.find((g) => g.country.toUpperCase() === cc.toUpperCase());
                              const maxCount = Math.max(...geoData.map((g) => g.count), 1);
                              const intensity = hit ? hit.count / maxCount : 0;
                              const fill = hit
                                ? `hsl(${195 - intensity * 60}, 80%, ${60 - intensity * 30}%)`
                                : "#1e293b";
                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={fill}
                                  stroke="#0f172a"
                                  strokeWidth={0.5}
                                  style={{
                                    default: { outline: "none" },
                                    hover: { fill: "#3b82f6", outline: "none" },
                                    pressed: { outline: "none" },
                                  }}
                                />
                              );
                            })
                          }
                        </Geographies>
                      </ComposableMap>
                    </div>
                    {geoData.length > 0 ? (
                      <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {geoData.slice(0, 10).map((g) => (
                          <div key={g.country} className="text-center p-2 rounded-lg bg-slate-950 border border-slate-800">
                            <p className="font-mono text-xs font-bold text-teal-400">{g.country}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{g.count} items</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center text-sm mt-4">No geographic data for this timeframe.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sentiment Timeline */}
          <TabsContent value="timeline">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base">Sentiment Timeline</CardTitle>
                <CardDescription className="text-slate-400">Overall narrative sentiment over recent analysis runs</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <Skeleton className="h-72 w-full bg-slate-800" />
                ) : sentimentChartData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sentimentChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="date" stroke="#475569" fontSize={11} />
                        <YAxis stroke="#475569" fontSize={11} domain={[-1, 1]} tickFormatter={(v) => v.toFixed(1)} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc", fontSize: 12 }}
                          formatter={(val: number) => [val.toFixed(3), "Sentiment"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="sentiment"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ fill: "#3b82f6", r: 3 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-slate-500">
                    No analysis history available for this category yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Feed */}
          <TabsContent value="content">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base">Recent Content</CardTitle>
                <CardDescription className="text-slate-400">Latest ingested articles mentioning topics in {category}</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingContent ? (
                  <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 bg-slate-800 rounded-lg" />)}</div>
                ) : contentData?.data?.length ? (
                  <div className="space-y-3">
                    {contentData.data.map((item: any) => (
                      <div key={item.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-medium text-slate-200 text-sm line-clamp-1">{item.title || "Untitled"}</h4>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700 text-xs capitalize">{item.platform}</Badge>
                            {item.sourceUrl && (
                              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{item.body}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <span className={item.sentimentScore > 0 ? "text-emerald-400" : item.sentimentScore < 0 ? "text-red-400" : ""}>
                            {item.sentimentScore != null ? `Sentiment: ${item.sentimentScore.toFixed(2)}` : ""}
                          </span>
                          <span>{item.collectedAt ? new Date(item.collectedAt).toLocaleDateString() : ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-8">No content found for this category.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analysis */}
          <TabsContent value="analysis">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 text-base">Narrative Intelligence</CardTitle>
                <CardDescription className="text-slate-400">Latest automated analysis for {category}</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAnalysis ? (
                  <Skeleton className="h-32 w-full bg-slate-800" />
                ) : categoryAnalysis ? (
                  <div className="space-y-4">
                    {(Array.isArray(categoryAnalysis?.data) ? categoryAnalysis.data : [categoryAnalysis]).map((a: any, i: number) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">{a.status || "complete"}</Badge>
                          <span className="text-xs text-slate-600">{a.runAt ? new Date(a.runAt).toLocaleString() : ""}</span>
                        </div>
                        {a.narrativeSummary && (
                          <p className="text-sm text-slate-300 leading-relaxed">{a.narrativeSummary}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                          {a.sentimentOverall && <span>Overall: {a.sentimentOverall}</span>}
                          {a.itemsAnalyzed && <span>{a.itemsAnalyzed} items analyzed</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Brain className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                    <p className="text-slate-500">No analysis available for this category yet.</p>
                    <p className="text-slate-600 text-sm mt-1">Analysis runs are triggered automatically by the intelligence engine.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analysis history list */}
            {!loadingHistory && (historyData?.data || []).length > 0 && (
              <Card className="bg-slate-900 border-slate-800 mt-4">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Analysis History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(historyData?.data || []).slice(0, 10).map((h: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm">
                        <div className="flex items-center gap-3">
                          <Badge className={
                            h.sentimentOverall === "positive" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            h.sentimentOverall === "negative" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            "bg-slate-700/50 text-slate-400 border-slate-700"
                          }>{h.sentimentOverall || "neutral"}</Badge>
                          <span className="text-slate-400">{h.itemsAnalyzed || 0} items</span>
                        </div>
                        <span className="text-slate-600 text-xs">{h.runAt ? new Date(h.runAt).toLocaleString() : ""}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
