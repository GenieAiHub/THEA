import React, { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListTrends, useListContent } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sword, TrendingUp, TrendingDown, Minus, Plus, X, ExternalLink, BarChart3, DollarSign, Newspaper } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";

interface Competitor {
  id: string;
  name: string;
  keywords: string[];
  color: string;
}

const COLORS = [
  { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", dot: "bg-blue-500" },
  { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", dot: "bg-rose-500" },
  { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", dot: "bg-purple-500" },
  { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500" },
];

export default function CompetitorIntelligencePage() {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([
    { id: "1", name: "Acme Corp", keywords: ["Acme", "acme corp"], color: "0" },
    { id: "2", name: "Rival Inc", keywords: ["Rival Inc", "rival"], color: "1" },
  ]);
  const [newName, setNewName] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywords, setNewKeywords] = useState<string[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>(competitors[0]?.id || "");

  const { data: trendsData, isLoading: loadingTrends } = useListTrends<any>({ limit: 100 });

  const allKeywords = competitors.flatMap((c) => c.keywords);
  const { data: contentData, isLoading: loadingContent } = useListContent(
    { search: competitors.find((c) => c.id === selectedCompetitor)?.name || "", limit: 20 } as any,
    { query: { enabled: !!selectedCompetitor, queryKey: ["/api/v1/content", { competitor: selectedCompetitor }] } }
  );

  const getCompetitorTrends = (competitor: Competitor) =>
    (trendsData?.data || []).filter((t: any) =>
      competitor.keywords.some((kw) => t.topic?.toLowerCase().includes(kw.toLowerCase()))
    );

  const getCompetitorSentiment = (competitor: Competitor) => {
    const items = (contentData?.data || []).filter((item: any) =>
      competitor.keywords.some(
        (kw) =>
          item.title?.toLowerCase().includes(kw.toLowerCase()) ||
          item.body?.toLowerCase().includes(kw.toLowerCase())
      )
    );
    if (!items.length) return null;
    const avg = items.reduce((s: number, i: any) => s + (i.sentimentScore || 0), 0) / items.length;
    return avg;
  };

  const EMV_CPM = 15;
  const IMPRESSIONS_PER_TREND = 1200;

  const sovData = useMemo(() =>
    competitors.map((c) => {
      const trends = getCompetitorTrends(c);
      const emv = trends.length * IMPRESSIONS_PER_TREND * (EMV_CPM / 1000);
      const cs = COLORS[parseInt(c.color) % COLORS.length];
      return { name: c.name, trends: trends.length, emv: Math.round(emv), color: cs.dot };
    }), [competitors, trendsData]);

  const totalTrends = sovData.reduce((s, d) => s + d.trends, 0);

  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newKeyword.trim()) {
      e.preventDefault();
      if (!newKeywords.includes(newKeyword.trim())) setNewKeywords([...newKeywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const handleAddCompetitor = () => {
    if (!newName.trim()) return;
    const c: Competitor = {
      id: Date.now().toString(),
      name: newName.trim(),
      keywords: newKeywords.length ? newKeywords : [newName.trim().toLowerCase()],
      color: String(competitors.length % COLORS.length),
    };
    setCompetitors([...competitors, c]);
    setNewName("");
    setNewKeywords([]);
    toast({ title: `${c.name} added to competitor tracking` });
  };

  const handleRemove = (id: string) => {
    setCompetitors(competitors.filter((c) => c.id !== id));
    if (selectedCompetitor === id) setSelectedCompetitor(competitors[0]?.id || "");
  };

  const selected = competitors.find((c) => c.id === selectedCompetitor);
  const selectedTrends = selected ? getCompetitorTrends(selected) : [];
  const selectedSentiment = selected ? getCompetitorSentiment(selected) : null;
  const colorScheme = selected ? COLORS[parseInt(selected.color) % COLORS.length] : COLORS[0];

  return (
    <DashboardLayout title="Competitor Intelligence">
      <div className="flex flex-col gap-6 max-w-6xl">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-100">Competitor Intelligence</h1>
            <p className="text-sm text-slate-500 mt-1">Track narrative signals, trends, and sentiment around your competitors</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: competitor list + add form */}
          <div className="flex flex-col gap-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base">Tracked Competitors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {competitors.map((c) => {
                  const cs = COLORS[parseInt(c.color) % COLORS.length];
                  const trends = getCompetitorTrends(c);
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCompetitor(c.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedCompetitor === c.id
                          ? `${cs.bg} ${cs.border}`
                          : "bg-slate-950 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${cs.dot} shrink-0`} />
                        <div>
                          <p className={`font-medium text-sm ${selectedCompetitor === c.id ? cs.text : "text-slate-200"}`}>
                            {c.name}
                          </p>
                          <p className="text-xs text-slate-500">{trends.length} matching trends</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(c.id); }}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                {competitors.length === 0 && (
                  <p className="text-sm text-slate-600 text-center py-4">No competitors tracked yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-base">Add Competitor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Company Name *</Label>
                  <Input
                    placeholder="e.g. GlobalMedia Inc"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
                    className="bg-slate-950 border-slate-800 text-slate-200 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Additional Keywords (Enter to add)</Label>
                  <Input
                    placeholder="Brand alias, product name..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={handleAddKeyword}
                    className="bg-slate-950 border-slate-800 text-slate-200 text-sm"
                  />
                  {newKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {newKeywords.map((kw) => (
                        <Badge
                          key={kw}
                          variant="outline"
                          className="bg-slate-800 text-slate-300 border-slate-700 text-xs cursor-pointer hover:border-red-500/40"
                          onClick={() => setNewKeywords(newKeywords.filter((k) => k !== kw))}
                        >
                          {kw} <X className="w-2.5 h-2.5 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleAddCompetitor}
                  disabled={!newName.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-500"
                  size="sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Competitor
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: detail panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <Tabs defaultValue="overview" className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${colorScheme.dot}`} />
                    <h2 className={`text-xl font-display font-bold ${colorScheme.text}`}>{selected.name}</h2>
                  </div>
                  <TabsList className="bg-slate-900 border border-slate-800 h-9">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">Overview</TabsTrigger>
                    <TabsTrigger value="sov" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">Share of Voice</TabsTrigger>
                    <TabsTrigger value="trends" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">Trends</TabsTrigger>
                    <TabsTrigger value="content" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">Content</TabsTrigger>
                    <TabsTrigger value="brief" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 text-xs">Brief</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overview">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Card className={`border ${colorScheme.border} ${colorScheme.bg}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className={`w-4 h-4 ${colorScheme.text}`} />
                          <span className="text-xs text-slate-500 uppercase tracking-wide">Matched Trends</span>
                        </div>
                        {loadingTrends
                          ? <Skeleton className="h-8 w-12 bg-slate-800" />
                          : <span className={`text-3xl font-display font-bold ${colorScheme.text}`}>{selectedTrends.length}</span>}
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-900 border-slate-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="w-4 h-4 text-slate-400" />
                          <span className="text-xs text-slate-500 uppercase tracking-wide">Avg Sentiment</span>
                        </div>
                        {selectedSentiment != null ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-3xl font-display font-bold ${
                              selectedSentiment > 0.05 ? "text-emerald-400" :
                              selectedSentiment < -0.05 ? "text-red-400" : "text-slate-400"
                            }`}>
                              {selectedSentiment > 0 ? "+" : ""}{selectedSentiment.toFixed(3)}
                            </span>
                            {selectedSentiment > 0.05
                              ? <TrendingUp className="w-5 h-5 text-emerald-400" />
                              : selectedSentiment < -0.05
                              ? <TrendingDown className="w-5 h-5 text-red-400" />
                              : <Minus className="w-5 h-5 text-slate-400" />}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">Insufficient data</span>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-slate-100 text-sm">Keyword Signals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selected.keywords.map((kw) => {
                        const kwTrends = (trendsData?.data || []).filter((t: any) =>
                          t.topic?.toLowerCase().includes(kw.toLowerCase())
                        );
                        const topScore = kwTrends.length
                          ? Math.max(...kwTrends.map((t: any) => t.score || 0))
                          : 0;
                        return (
                          <div key={kw} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-none">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`${colorScheme.bg} ${colorScheme.text} ${colorScheme.border} text-xs`}>{kw}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span>{kwTrends.length} trends</span>
                              {topScore > 0 && <span className={`font-mono ${colorScheme.text}`}>peak {topScore.toFixed(0)}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="sov">
                  <div className="flex flex-col gap-4">
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-slate-100 text-sm">Share of Voice — All Competitors</CardTitle>
                        <CardDescription className="text-slate-400">Trend hits comparison across tracked competitors</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {loadingTrends ? (
                          <Skeleton className="h-44 w-full bg-slate-800" />
                        ) : (
                          <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={sovData} barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="name" stroke="#475569" fontSize={11} />
                                <YAxis stroke="#475569" fontSize={11} allowDecimals={false} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc", fontSize: 12 }}
                                  formatter={(v: number, name: string) => [v, name === "trends" ? "Matched Trends" : name]}
                                />
                                <Bar dataKey="trends" radius={[3, 3, 0, 0]}>
                                  {sovData.map((d, idx) => (
                                    <Cell key={idx} fill={["#3b82f6", "#f43f5e", "#a855f7", "#f59e0b"][idx % 4]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                          Estimated Earned Media Value
                        </CardTitle>
                        <CardDescription className="text-slate-400">$15 CPM × 1,200 avg impressions per matched trend</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2.5">
                          {sovData.map((d, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${d.color}`} />
                                <span className="text-sm text-slate-300">{d.name}</span>
                                <span className="text-xs text-slate-500">{d.trends} trends</span>
                              </div>
                              <span className="font-mono font-bold text-emerald-400">${d.emv.toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-semibold">
                            <span className="text-slate-400 text-sm">Total estimated EMV</span>
                            <span className="font-mono text-emerald-300">
                              ${sovData.reduce((s, d) => s + d.emv, 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {totalTrends === 0 && (
                          <p className="text-slate-500 text-sm text-center py-4">No trend matches found for any competitor.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="trends">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-slate-100 text-sm">Matched Trends</CardTitle>
                      <CardDescription className="text-slate-400">Trending topics mentioning {selected.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingTrends ? (
                        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 bg-slate-800 rounded-lg" />)}</div>
                      ) : selectedTrends.length > 0 ? (
                        <div className="space-y-2">
                          {selectedTrends.map((t: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                              <div>
                                <p className="text-sm font-medium text-slate-200">{t.topic}</p>
                                <p className="text-xs text-slate-500">{t.category} · {t.mentionCount || 0} mentions</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full ${colorScheme.dot} rounded-full`} style={{ width: `${Math.min(t.score || 0, 100)}%` }} />
                                </div>
                                <span className={`text-sm font-mono font-bold ${colorScheme.text}`}>{t.score?.toFixed(0)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-10 text-center text-slate-500">
                          No trends matching "{selected.name}" found.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="content">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-slate-100 text-sm">Recent Mentions</CardTitle>
                      <CardDescription className="text-slate-400">Latest ingested content referencing {selected.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingContent ? (
                        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 bg-slate-800 rounded-lg" />)}</div>
                      ) : contentData?.data?.length ? (
                        <div className="space-y-3">
                          {contentData.data.slice(0, 10).map((item: any) => (
                            <div key={item.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-200 truncate">{item.title || "Untitled"}</p>
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.body}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700 text-xs">{item.platform}</Badge>
                                  {item.sourceUrl && (
                                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                <span className={item.sentimentScore > 0 ? "text-emerald-400" : item.sentimentScore < 0 ? "text-red-400" : ""}>
                                  {item.sentimentScore != null ? `Sentiment: ${item.sentimentScore.toFixed(2)}` : ""}
                                </span>
                                <span>{item.collectedAt ? new Date(item.collectedAt).toLocaleDateString() : ""}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-10 text-center text-slate-500">
                          No recent content found for {selected.name}.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="brief">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                        <Newspaper className="w-4 h-4 text-amber-400" />
                        Weekly Narrative Brief
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        Synthesized intelligence summary for {selected.name} · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {/* Narrative overview */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                        <p className="text-xs text-amber-400 uppercase tracking-wider font-medium mb-2">Narrative Overview</p>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {selectedTrends.length > 0
                            ? `${selected.name} is currently generating signals across ${selectedTrends.length} active trends. The dominant narratives center on "${selectedTrends[0]?.topic || "unknown"}"${selectedTrends[1] ? ` and "${selectedTrends[1]?.topic}"` : ""}, indicating ${selectedSentiment != null && selectedSentiment < -0.1 ? "a negative press cycle requiring proactive counter-messaging" : "generally stable or positive positioning in the media landscape"}.`
                            : `No significant trend signals detected for ${selected.name} in the current monitoring window. This may indicate limited media presence or a gap in keyword coverage.`
                          }
                        </p>
                      </div>

                      {/* Key themes */}
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Key Themes This Week</p>
                        {selectedTrends.length > 0 ? (
                          <div className="space-y-2">
                            {selectedTrends.slice(0, 5).map((t: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${colorScheme.dot}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-200 truncate">{t.topic}</p>
                                  <p className="text-xs text-slate-500">{t.mentionCount || 0} mentions · score {(t.score || 0).toFixed(0)}</p>
                                </div>
                                <Badge variant="outline" className={`text-xs shrink-0 ${
                                  (t.score || 0) > 70 ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                  (t.score || 0) > 40 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                  "bg-slate-700/50 text-slate-400 border-slate-700"
                                }`}>
                                  {(t.score || 0) > 70 ? "High" : (t.score || 0) > 40 ? "Medium" : "Low"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-sm">No themes detected this week.</p>
                        )}
                      </div>

                      {/* Sentiment summary */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Sentiment Signal</p>
                          <p className={`text-lg font-display font-bold ${
                            selectedSentiment != null && selectedSentiment > 0.05 ? "text-emerald-400" :
                            selectedSentiment != null && selectedSentiment < -0.05 ? "text-red-400" : "text-slate-400"
                          }`}>
                            {selectedSentiment != null
                              ? `${selectedSentiment > 0 ? "+" : ""}${selectedSentiment.toFixed(3)}`
                              : "Insufficient data"}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Est. EMV</p>
                          <p className="text-lg font-display font-bold text-emerald-400">
                            ${(selectedTrends.length * 1200 * (15 / 1000)).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Recommended action */}
                      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                        <p className="text-xs text-blue-400 uppercase tracking-wider font-medium mb-1.5">Recommended Action</p>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {selectedSentiment != null && selectedSentiment < -0.15
                            ? `Escalate monitoring for ${selected.name}. Negative sentiment exceeds threshold. Consider preparing counter-narrative content and briefing communications teams.`
                            : selectedTrends.length > 5
                            ? `${selected.name} shows elevated trend activity. Review matched keywords and assess whether current messaging adequately addresses their narrative positioning.`
                            : `Maintain current monitoring cadence for ${selected.name}. No immediate action required.`
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600">
                <div className="text-center">
                  <Sword className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Select a competitor to view their intelligence profile</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
