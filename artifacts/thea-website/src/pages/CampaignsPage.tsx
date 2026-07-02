import React, { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListTrends, useListAlerts, useListWatchlistKeywords } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, ShieldAlert, Plus, X, BarChart2, Calendar, CheckCircle2, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Campaign {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  startDate: string;
  endDate: string;
  status: "active" | "paused" | "completed";
  color: string;
}

const COLORS = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];

export default function CampaignsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: "1",
      name: "Q3 Product Launch",
      description: "Monitor narrative around the upcoming product launch",
      keywords: ["product launch", "new feature", "innovation"],
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      status: "active",
      color: "bg-blue-500",
    },
    {
      id: "2",
      name: "Brand Reputation Watch",
      description: "Track mentions and sentiment for core brand terms",
      keywords: ["brand reputation", "customer trust", "service quality"],
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      color: "bg-emerald-500",
    },
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywords, setNewKeywords] = useState<string[]>([]);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const { data: trendsData, isLoading: loadingTrends } = useListTrends<any>({ limit: 50 });
  const { data: alertsData } = useListAlerts<any>({ limit: 100 });

  const getMatchingTrends = (campaign: Campaign) =>
    (trendsData?.data || []).filter((t: any) =>
      campaign.keywords.some((kw) =>
        t.topic?.toLowerCase().includes(kw.toLowerCase())
      )
    );

  const getMatchingAlerts = (campaign: Campaign) =>
    (alertsData?.data || []).filter((a: any) =>
      campaign.keywords.some(
        (kw) =>
          a.title?.toLowerCase().includes(kw.toLowerCase()) ||
          a.message?.toLowerCase().includes(kw.toLowerCase())
      )
    );

  const EMV_CPM = 15;
  const AVG_IMPRESSIONS_PER_TREND = 1200;

  const sovData = useMemo(() =>
    campaigns.map((c) => {
      const hits = getMatchingTrends(c).length;
      const emv = hits * AVG_IMPRESSIONS_PER_TREND * (EMV_CPM / 1000);
      return { name: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name, mentions: hits, emv: Math.round(emv) };
    }), [campaigns, trendsData]);

  const PIE_COLORS = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ec4899"];

  const beforeAfterData = useMemo(() => {
    const now = new Date();
    return campaigns.map((c) => {
      const startMs = new Date(c.startDate).getTime();
      const allTrends = (trendsData?.data || []) as any[];
      const before = allTrends.filter((t) =>
        c.keywords.some((kw) => t.topic?.toLowerCase().includes(kw.toLowerCase())) &&
        new Date(t.createdAt || c.startDate).getTime() < startMs
      ).length;
      const after = allTrends.filter((t) =>
        c.keywords.some((kw) => t.topic?.toLowerCase().includes(kw.toLowerCase())) &&
        new Date(t.createdAt || now).getTime() >= startMs
      ).length;
      return { name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name, "Pre-Launch": before, "Active": after };
    });
  }, [campaigns, trendsData]);

  const getDuration = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const now = Date.now();
    const total = e - s;
    const elapsed = Math.max(0, Math.min(now - s, total));
    return total > 0 ? Math.round((elapsed / total) * 100) : 0;
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const campaign: Campaign = {
      id: Date.now().toString(),
      name: newName,
      description: newDesc,
      keywords: newKeywords,
      startDate: newStart || new Date().toISOString().slice(0, 10),
      endDate: newEnd || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      status: "active",
      color: COLORS[campaigns.length % COLORS.length],
    };
    setCampaigns([...campaigns, campaign]);
    setShowCreate(false);
    setNewName("");
    setNewDesc("");
    setNewKeywords([]);
    setNewStart("");
    setNewEnd("");
    toast({ title: `Campaign "${campaign.name}" created` });
  };

  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newKeyword.trim()) {
      e.preventDefault();
      if (!newKeywords.includes(newKeyword.trim())) {
        setNewKeywords([...newKeywords, newKeyword.trim()]);
      }
      setNewKeyword("");
    }
  };

  const toggleStatus = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: c.status === "active" ? "paused" : "active" }
          : c
      )
    );
  };

  return (
    <DashboardLayout title="Campaign Tracker">
      <div className="flex flex-col gap-6 max-w-6xl">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-100">Campaign Intelligence</h1>
            <p className="text-sm text-slate-500 mt-1">Monitor how narratives align with your active campaigns</p>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-500"
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card className="bg-slate-900 border-blue-700/40">
            <CardHeader>
              <CardTitle className="text-slate-100">Create Campaign</CardTitle>
              <CardDescription className="text-slate-400">Set up keyword tracking and monitoring for a new campaign.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Campaign Name *</Label>
                  <Input
                    placeholder="e.g. Q4 Product Launch"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Description</Label>
                  <Input
                    placeholder="Brief description of this campaign..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Keywords (press Enter to add)</Label>
                <Input
                  placeholder="Add keyword..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={handleAddKeyword}
                  className="bg-slate-950 border-slate-800 text-slate-200"
                />
                {newKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newKeywords.map((kw) => (
                      <Badge
                        key={kw}
                        variant="outline"
                        className="bg-blue-500/10 text-blue-400 border-blue-500/20 cursor-pointer hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                        onClick={() => setNewKeywords(newKeywords.filter((k) => k !== kw))}
                      >
                        {kw} <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleCreate} disabled={!newName.trim()} className="bg-blue-600 hover:bg-blue-500">
                  Create Campaign
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)} className="border-slate-700 text-slate-400 hover:text-slate-200">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Analytics Overview */}
        {campaigns.length > 0 && !loadingTrends && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Share of Voice Pie */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-400" />
                  Share of Voice
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">Matched trends by campaign</CardDescription>
              </CardHeader>
              <CardContent>
                {sovData.every((d) => d.mentions === 0) ? (
                  <div className="h-36 flex items-center justify-center text-slate-500 text-sm">No matching trends yet</div>
                ) : (
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sovData}
                          dataKey="mentions"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={55}
                          innerRadius={25}
                        >
                          {sovData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc", fontSize: 11 }}
                          formatter={(v: number) => [v, "Trends"]}
                        />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Before / After Comparison */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  Pre-Launch vs. Active
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">Trend hits before and after campaign start</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={beforeAfterData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#475569" fontSize={9} />
                      <YAxis stroke="#475569" fontSize={9} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc", fontSize: 11 }}
                      />
                      <Bar dataKey="Pre-Launch" fill="#475569" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Active" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* EMV Table */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Est. Earned Media Value
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">Based on $15 CPM × estimated reach</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {sovData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300 truncate max-w-[60%]">{d.name}</span>
                    <span className="font-mono font-bold text-emerald-400">
                      ${d.emv.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="pt-2 mt-1 border-t border-slate-800 flex items-center justify-between text-sm font-semibold">
                  <span className="text-slate-400">Total EMV</span>
                  <span className="font-mono text-emerald-300">
                    ${sovData.reduce((s, d) => s + d.emv, 0).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Campaign cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {campaigns.map((campaign) => {
            const matchedTrends = getMatchingTrends(campaign);
            const matchedAlerts = getMatchingAlerts(campaign);
            const progress = getDuration(campaign.startDate, campaign.endDate);
            return (
              <Card key={campaign.id} className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${campaign.color} shrink-0 mt-1`} />
                      <div>
                        <CardTitle className="text-slate-100 text-base">{campaign.name}</CardTitle>
                        <CardDescription className="text-slate-500 text-sm mt-0.5">{campaign.description}</CardDescription>
                      </div>
                    </div>
                    <Badge
                      className={campaign.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0"
                        : "bg-slate-700/50 text-slate-400 border-slate-700 shrink-0"}
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Timeline progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {campaign.startDate}</span>
                      <span>{progress}% elapsed</span>
                      <span>{campaign.endDate}</span>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-slate-800" />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs text-slate-500">Matched Trends</span>
                      </div>
                      {loadingTrends
                        ? <Skeleton className="h-6 w-8 bg-slate-800" />
                        : <span className="text-xl font-display font-bold text-slate-100">{matchedTrends.length}</span>}
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs text-slate-500">Active Alerts</span>
                      </div>
                      <span className="text-xl font-display font-bold text-slate-100">
                        {matchedAlerts.filter((a: any) => a.status === "open").length}
                      </span>
                    </div>
                  </div>

                  {/* Keywords */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Tracking Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {campaign.keywords.map((kw) => (
                        <Badge key={kw} variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Matched trends preview */}
                  {matchedTrends.length > 0 && (
                    <div className="pt-2 border-t border-slate-800">
                      <p className="text-xs text-slate-500 mb-2">Top Matched Signals</p>
                      <div className="space-y-1.5">
                        {matchedTrends.slice(0, 3).map((t: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-slate-950">
                            <span className="text-slate-300 truncate">{t.topic}</span>
                            <span className="text-blue-400 font-mono shrink-0 ml-2">{t.score?.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      onClick={() => toggleStatus(campaign.id)}
                    >
                      {campaign.status === "active" ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => setCampaigns(campaigns.filter((c) => c.id !== campaign.id))}
                    >
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {campaigns.length === 0 && (
          <div className="py-20 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
            <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No campaigns yet</p>
            <p className="text-sm mt-1">Create a campaign to start tracking narrative signals against your objectives.</p>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
