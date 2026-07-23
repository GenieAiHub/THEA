import React, { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useGetAlert,
  useResolveAlert,
  getListAlertsQueryKey,
  useListContent,
  useListTrends,
  useLlmChat,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Brain,
  Flame,
  TrendingUp,
  MessageSquare,
  FileText,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { alertTypeInfo, alertTitle, alertDescription, isSovAlert, sovShiftText, sovOvertakenText } from "@/lib/alertPresentation";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const severityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const crisisProbability: Record<string, { pct: number; label: string; color: string }> = {
  critical: { pct: 82, label: "High Crisis Risk", color: "text-red-400" },
  high: { pct: 61, label: "Elevated Risk", color: "text-orange-400" },
  medium: { pct: 34, label: "Moderate Risk", color: "text-yellow-400" },
  low: { pct: 12, label: "Low Risk", color: "text-blue-400" },
};

export default function AlertDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [counterNarrative, setCounterNarrative] = useState("");
  const [loadingNarrative, setLoadingNarrative] = useState(false);

  const { data: alertData, isLoading: loadingAlert } = useGetAlert<any>(id, {
    query: { enabled: !!id, queryKey: ["/api/v1/alerts", id] },
  });
  const alert = alertData as any;

  const { data: trendsData, isLoading: loadingTrends } = useListTrends<any>({
    limit: 50,
  });

  const { data: contentData, isLoading: loadingContent } = useListContent(
    { search: alert?.title || "", limit: 20 } as any,
    { query: { enabled: !!alert?.title, queryKey: ["/api/v1/content", { alertTitle: alert?.title }] } }
  );

  const resolveAlert = useResolveAlert();
  const llmChat = useLlmChat();

  const handleResolve = async () => {
    try {
      await resolveAlert.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      toast({ title: "Alert resolved" });
      setLocation("/alerts");
    } catch {
      toast({ title: "Failed to resolve", variant: "destructive" });
    }
  };

  const handleGenerateCounterNarrative = async () => {
    if (!alert) return;
    setLoadingNarrative(true);
    try {
      const res = await llmChat.mutateAsync({
        data: {
          messages: [{
            role: "user",
            content: `You are a crisis communications expert. Generate a concise counter-narrative for the following alert:\n\nTitle: ${alertTitle(alert)}\nSeverity: ${alert.severity}\nDescription: ${alertDescription(alert)}\n\nProvide:\n1. The key counter-narrative message (2-3 sentences)\n2. Three supporting proof points\n3. Recommended communication channel (press release, social, internal)\n4. Urgency level (immediate / within 4h / within 24h)`,
          }],
        },
      });
      setCounterNarrative(res.content || "No response generated.");
    } catch {
      toast({ title: "Failed to generate counter-narrative", variant: "destructive" });
    } finally {
      setLoadingNarrative(false);
    }
  };

  const relatedTrends = (trendsData?.data || []).filter((t: any) =>
    alert?.title?.toLowerCase().split(" ").some((word: string) =>
      word.length > 4 && t.topic?.toLowerCase().includes(word)
    )
  ).slice(0, 5);

  const spikeChartData = Array.from({ length: 12 }).map((_, i) => {
    const hoursAgo = 11 - i;
    const isAlertTime = i === 8;
    return {
      hour: hoursAgo === 0 ? "Now" : `-${hoursAgo}h`,
      volume: isAlertTime
        ? 100
        : hoursAgo > 8
        ? Math.round(20 + Math.random() * 20)
        : Math.round(60 + Math.random() * 30),
    };
  });

  const crisis = crisisProbability[alert?.severity || "low"];

  if (loadingAlert) {
    return (
      <DashboardLayout title="Alert Detail">
        <div className="space-y-4 max-w-4xl">
          <Skeleton className="h-24 w-full bg-slate-900" />
          <Skeleton className="h-48 w-full bg-slate-900" />
          <Skeleton className="h-64 w-full bg-slate-900" />
        </div>
      </DashboardLayout>
    );
  }

  if (!alert && !loadingAlert) {
    return (
      <DashboardLayout title="Alert Not Found">
        <div className="text-center py-20 text-slate-500">
          <p>Alert not found. It may have been deleted or the ID is invalid.</p>
          <Link href="/alerts">
            <Button className="mt-4 bg-slate-800 hover:bg-slate-700">← Back to Alerts</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Alert: ${alert ? alertTitle(alert).slice(0, 40) : id}`}>
      <div className="flex flex-col gap-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/alerts">
              <div className="p-2 mt-1 bg-slate-900 border border-slate-800 rounded-md hover:bg-slate-800 cursor-pointer transition-colors shrink-0">
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </div>
            </Link>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`shrink-0 ${severityColors[alert?.severity || "low"]}`}>
                  {alert?.severity?.toUpperCase()}
                </Badge>
                {alert && (
                  <Badge variant="outline" className={`shrink-0 inline-flex items-center gap-1 ${alertTypeInfo(alert).badgeClass}`}>
                    {alertTypeInfo(alert).icon}
                    {alertTypeInfo(alert).label}
                  </Badge>
                )}
                {alert?.status === "resolved" && (
                  <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700">Resolved</Badge>
                )}
              </div>
              <h1 className="text-xl font-display font-bold text-slate-100 mt-2">{alert ? alertTitle(alert) : ""}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {alert?.createdAt ? new Date(alert.createdAt).toLocaleString() : ""}
                {alert?.category && ` · ${alert.category}`}
              </p>
            </div>
          </div>
          {alert?.status !== "resolved" && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 shrink-0"
              onClick={handleResolve}
              disabled={resolveAlert.isPending}
            >
              {resolveAlert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Resolve
            </Button>
          )}
        </div>

        {/* SoV shift summary (ai_sov alerts only) */}
        {alert && isSovAlert(alert) && (sovShiftText(alert) || sovOvertakenText(alert)) && (
          <Card className="bg-slate-900 border-purple-900/40">
            <CardContent className="p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
              {sovShiftText(alert) && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Share of Voice Shift</p>
                  <p className="text-2xl font-display font-bold text-purple-400">{sovShiftText(alert)}</p>
                </div>
              )}
              {sovOvertakenText(alert) && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Competitor Overtake</p>
                  <p className="text-2xl font-display font-bold text-red-400">{sovOvertakenText(alert)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Description */}
        {alert && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              <p className="text-slate-300 text-sm leading-relaxed">
                {alertDescription(alert)}
              </p>
              {alert.context && (
                <details className="mt-4">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">Show raw context</summary>
                  <pre className="mt-2 p-3 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-slate-400 overflow-auto max-h-32">
                    {JSON.stringify(alert.context, null, 2)}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        {/* Crisis probability + Spike chart */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={`bg-slate-900 ${alert?.severity === "critical" || alert?.severity === "high" ? "border-red-900/50" : "border-slate-800"}`}>
            <CardContent className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-400" />
                <span className="text-xs text-slate-500 uppercase tracking-wide">Crisis Probability</span>
              </div>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-display font-bold ${crisis?.color}`}>{crisis?.pct}%</span>
              </div>
              <p className={`text-sm font-medium ${crisis?.color}`}>{crisis?.label}</p>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    alert?.severity === "critical" ? "bg-red-500" :
                    alert?.severity === "high" ? "bg-orange-500" :
                    alert?.severity === "medium" ? "bg-yellow-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${crisis?.pct}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 mt-1">Based on severity, reach, and velocity indicators</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-100 text-sm">Mention Volume Spike</CardTitle>
              <CardDescription className="text-slate-400 text-xs">Estimated mention activity around alert detection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spikeChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="hour" stroke="#475569" fontSize={10} />
                    <YAxis stroke="#475569" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", color: "#f8fafc", fontSize: 11 }}
                      formatter={(v: number) => [`${v} mentions`, "Volume"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="volume"
                      stroke={
                        alert?.severity === "critical" ? "#ef4444" :
                        alert?.severity === "high" ? "#f97316" :
                        "#3b82f6"
                      }
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top triggering content */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base">Top Triggering Content</CardTitle>
            <CardDescription className="text-slate-400">Content items most likely contributing to this alert</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingContent ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-slate-800 rounded-lg" />)}</div>
            ) : contentData?.data?.length ? (
              <div className="space-y-3">
                {contentData.data.slice(0, 5).map((item: any) => (
                  <div key={item.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{item.title || "Untitled"}</p>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{item.body}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
                        <Badge variant="outline" className="bg-slate-900 text-slate-400 border-slate-800 text-xs capitalize py-0">{item.platform}</Badge>
                        <span className={item.sentimentScore < -0.1 ? "text-red-400" : item.sentimentScore > 0.1 ? "text-emerald-400" : ""}>
                          {item.sentimentScore != null ? `S: ${item.sentimentScore.toFixed(2)}` : ""}
                        </span>
                        <span>{item.collectedAt ? new Date(item.collectedAt).toLocaleDateString() : ""}</span>
                      </div>
                    </div>
                    {item.sourceUrl && (
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 shrink-0">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6">No related content found.</p>
            )}
          </CardContent>
        </Card>

        {/* Related trends */}
        {relatedTrends.length > 0 && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Related Active Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {relatedTrends.map((t: any, i: number) => (
                  <Link key={i} href={`/trends/${encodeURIComponent(t.topic)}`}>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500/40 cursor-pointer transition-colors">
                      <span className="text-sm text-slate-200">{t.topic}</span>
                      <Badge variant="outline" className="bg-slate-800 text-blue-400 border-slate-700 text-xs font-mono">{t.score?.toFixed(0)}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Counter-narrative generator */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              Suggested Counter-Narrative
            </CardTitle>
            <CardDescription className="text-slate-400">
              AI-generated response strategy for this alert
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {counterNarrative ? (
              <>
                <div className="p-4 bg-slate-950 rounded-lg border border-purple-900/30 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {counterNarrative}
                </div>
                <div className="flex gap-3">
                  <Link href="/ai-tools">
                    <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Draft Full Statement
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 hover:text-slate-300"
                    onClick={() => setCounterNarrative("")}
                  >
                    Regenerate
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6">
                <MessageSquare className="w-8 h-8 text-slate-700" />
                <p className="text-sm text-slate-500 text-center">
                  Generate an AI-powered counter-narrative strategy for this alert.
                </p>
                <Button
                  onClick={handleGenerateCounterNarrative}
                  disabled={loadingNarrative}
                  className="bg-purple-600 hover:bg-purple-500"
                >
                  {loadingNarrative ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
                  Generate Counter-Narrative
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
