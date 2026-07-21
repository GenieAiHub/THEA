import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  MousePointerClick, Download, Activity, DollarSign, Plus, Copy, RefreshCw,
  Trash2, Smartphone, Link2, FileBarChart, BookOpen, Eye, EyeOff, FileDown,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { api, fmtUsd, type Creator, type MmpApp, type MmpLink } from "@/components/mmp/api";
import { HealthTab } from "@/components/mmp/HealthTab";
import { BenchmarksTab } from "@/components/mmp/BenchmarksTab";
import { SkanTab } from "@/components/mmp/SkanTab";
import { CreatorsTab } from "@/components/mmp/CreatorsTab";
import { CohortsTab } from "@/components/mmp/CohortsTab";
import { CostsTab } from "@/components/mmp/CostsTab";
import { DebugTab } from "@/components/mmp/DebugTab";
import { LinkQrButton } from "@/components/mmp/LinkQrButton";

interface Summary {
  clicks: number;
  installs: number;
  attributedInstalls: number;
  organicInstalls: number;
  suspectInstalls: number;
  uninstalls: number;
  events: number;
  revenueUsd: number;
  spendUsd: number;
  roas: number | null;
  cpi: number | null;
}

interface BreakdownRow {
  linkId: string;
  appId: string;
  name: string;
  channel: string;
  code: string;
  creatorId: string | null;
  clicks: number;
  installs: number;
  suspectInstalls: number;
  uninstalls: number;
  revenueUsd: number;
  spendUsd: number;
  roas: number | null;
  cpi: number | null;
}

const CHANNELS = [
  { value: "facebook_ads", label: "Facebook Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "tiktok_ads", label: "TikTok Ads" },
  { value: "twitter_ads", label: "X / Twitter Ads" },
  { value: "email", label: "Email" },
  { value: "influencer", label: "Influencer" },
  { value: "qr_code", label: "QR Code" },
  { value: "other", label: "Other" },
];

function channelLabel(value: string): string {
  return CHANNELS.find((c) => c.value === value)?.label ?? value;
}

function trackingUrl(code: string): string {
  return `${window.location.origin}/api/v1/mmp/c/${code}`;
}

export default function MmpPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    document.title = "THEA MMP | Mobile Attribution";
  }, []);

  const [selectedAppId, setSelectedAppId] = useState<string>("all");
  const [days, setDays] = useState<string>("30");
  const [tokenVisible, setTokenVisible] = useState<Record<string, boolean>>({});

  // ── Queries ──────────────────────────────────────────────────────────────
  const appsQ = useQuery({
    queryKey: ["mmp", "apps"],
    queryFn: () => api<{ data: MmpApp[] }>("/apps"),
  });
  const apps = appsQ.data?.data ?? [];

  const appFilter = selectedAppId !== "all" ? `&appId=${selectedAppId}` : "";
  const statsKey = ["mmp", "stats", selectedAppId, days];

  const summaryQ = useQuery({
    queryKey: [...statsKey, "summary"],
    queryFn: () => api<Summary>(`/stats/summary?days=${days}${appFilter}`),
  });
  const timeseriesQ = useQuery({
    queryKey: [...statsKey, "timeseries"],
    queryFn: () => api<{ data: { day: string; clicks: number; installs: number }[] }>(`/stats/timeseries?days=${days}${appFilter}`),
  });
  const breakdownQ = useQuery({
    queryKey: [...statsKey, "breakdown"],
    queryFn: () => api<{ data: BreakdownRow[]; organic: { installs: number; uninstalls: number; revenueUsd: number } }>(`/stats/breakdown?days=${days}${appFilter}`),
  });
  const linksQ = useQuery({
    queryKey: ["mmp", "links", selectedAppId],
    queryFn: () => api<{ data: MmpLink[] }>(`/links${selectedAppId !== "all" ? `?appId=${selectedAppId}` : ""}`),
  });
  const links = linksQ.data?.data ?? [];

  const creatorsQ = useQuery({
    queryKey: ["mmp", "creators", "all"],
    queryFn: () => api<{ data: Creator[] }>("/creators"),
  });
  const creators = creatorsQ.data?.data ?? [];
  const creatorName = useMemo(() => new Map(creators.map((c) => [c.id, c.name])), [creators]);

  const invalidateAll = () => qc.invalidateQueries({ queryKey: ["mmp"] });

  // ── Mutations ────────────────────────────────────────────────────────────
  const [newAppName, setNewAppName] = useState("");
  const [newAppPlatform, setNewAppPlatform] = useState("android");
  const createApp = useMutation({
    mutationFn: () => api<MmpApp>("/apps", { method: "POST", body: JSON.stringify({ name: newAppName, platform: newAppPlatform }) }),
    onSuccess: () => {
      setNewAppName("");
      invalidateAll();
      toast({ title: "App registered", description: "Your ingest token is ready — see the app card below." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not create app", description: e.message }),
  });

  const regenToken = useMutation({
    mutationFn: (appId: string) => api<MmpApp>(`/apps/${appId}/regenerate-token`, { method: "POST" }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Token regenerated", description: "The old ingest token no longer works." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const deleteApp = useMutation({
    mutationFn: (appId: string) => api<{ deleted: boolean }>(`/apps/${appId}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelectedAppId("all");
      invalidateAll();
      toast({ title: "App deleted", description: "All its links, clicks, installs and events were removed." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const [newLink, setNewLink] = useState({
    appId: "", name: "", channel: "facebook_ads", destinationUrl: "", deepLinkUrl: "", creatorId: "none",
  });
  const linkFormCreators = useMemo(
    () => creators.filter((c) => c.appId === newLink.appId),
    [creators, newLink.appId],
  );
  const createLink = useMutation({
    mutationFn: () => api<MmpLink>("/links", {
      method: "POST",
      body: JSON.stringify({
        appId: newLink.appId,
        name: newLink.name,
        channel: newLink.channel,
        destinationUrl: newLink.destinationUrl,
        ...(newLink.deepLinkUrl.trim() ? { deepLinkUrl: newLink.deepLinkUrl.trim() } : {}),
        ...(newLink.creatorId !== "none" ? { creatorId: newLink.creatorId } : {}),
      }),
    }),
    onSuccess: (link) => {
      setNewLink((s) => ({ ...s, name: "", destinationUrl: "", deepLinkUrl: "", creatorId: "none" }));
      invalidateAll();
      navigator.clipboard?.writeText(trackingUrl(link.code)).catch(() => undefined);
      toast({ title: "Tracking link created", description: "The tracking URL was copied to your clipboard." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not create link", description: e.message }),
  });

  const deleteLink = useMutation({
    mutationFn: (linkId: string) => api<{ deleted: boolean }>(`/links/${linkId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(),
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${what} copied` }),
      () => toast({ variant: "destructive", title: "Copy failed" }),
    );
  };

  const exportCsv = (kind: "clicks" | "installs" | "events") => {
    window.open(`/api/v1/mmp/export/${kind}?days=${days}${appFilter}`, "_blank");
  };

  const summary = summaryQ.data;
  const chartData = timeseriesQ.data?.data ?? [];
  const breakdown = breakdownQ.data?.data ?? [];
  const organic = breakdownQ.data?.organic;

  const guideApp = useMemo(
    () => (selectedAppId !== "all" ? apps.find((a) => a.id === selectedAppId) : apps[0]),
    [apps, selectedAppId],
  );

  const kpis = [
    { label: "Clicks", value: summary?.clicks ?? 0, icon: <MousePointerClick className="w-4 h-4 text-blue-500" /> },
    {
      label: "Installs", value: summary?.installs ?? 0,
      icon: <Download className="w-4 h-4 text-emerald-500" />,
      sub: summary
        ? `${summary.attributedInstalls} attributed · ${summary.organicInstalls} organic`
          + (summary.suspectInstalls ? ` · ${summary.suspectInstalls} suspect` : "")
          + (summary.uninstalls ? ` · ${summary.uninstalls} uninstalled` : "")
        : undefined,
    },
    { label: "Events", value: summary?.events ?? 0, icon: <Activity className="w-4 h-4 text-purple-500" /> },
    {
      label: "Revenue",
      value: fmtUsd(summary?.revenueUsd ?? 0),
      icon: <DollarSign className="w-4 h-4 text-amber-500" />,
      sub: summary && summary.spendUsd > 0
        ? `${fmtUsd(summary.spendUsd)} spend · ROAS ${summary.roas !== null ? summary.roas.toFixed(2) : "—"} · CPI ${fmtUsd(summary.cpi)}`
        : undefined,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="page-mmp">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">THEA MMP</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Mobile attribution — campaign tracking links, install attribution and revenue analytics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/mmp-report">
              <Button variant="outline" size="sm" data-testid="link-mmp-report">
                <FileBarChart className="w-4 h-4 mr-2" /> Market report
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-export-csv">
                  <FileDown className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportCsv("clicks")} data-testid="export-clicks">Clicks</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsv("installs")} data-testid="export-installs">Installs</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsv("events")} data-testid="export-events">Events</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Select value={selectedAppId} onValueChange={setSelectedAppId}>
              <SelectTrigger className="w-44" data-testid="select-app-filter">
                <SelectValue placeholder="All apps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All apps</SelectItem>
                {apps.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32" data-testid="select-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview" data-testid="tab-trigger-overview">Overview</TabsTrigger>
            <TabsTrigger value="health" data-testid="tab-trigger-health">Health</TabsTrigger>
            <TabsTrigger value="creators" data-testid="tab-trigger-creators">Creators</TabsTrigger>
            <TabsTrigger value="cohorts" data-testid="tab-trigger-cohorts">Cohorts</TabsTrigger>
            <TabsTrigger value="benchmarks" data-testid="tab-trigger-benchmarks">Benchmarks</TabsTrigger>
            <TabsTrigger value="costs" data-testid="tab-trigger-costs">Costs</TabsTrigger>
            <TabsTrigger value="skan" data-testid="tab-trigger-skan">SKAN</TabsTrigger>
            <TabsTrigger value="debug" data-testid="tab-trigger-debug">Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((k) => (
                <Card key={k.label} data-testid={`kpi-${k.label.toLowerCase()}`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                    {k.icon}
                  </CardHeader>
                  <CardContent>
                    {summaryQ.isLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">{k.value}</div>
                        {k.sub && <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Timeseries */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Clicks & installs over time</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {timeseriesQ.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No activity yet — share a tracking link to start collecting data.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" fontSize={11} tickLine={false} />
                      <YAxis fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="clicks" stroke="#3b82f6" strokeWidth={2} dot={false} name="Clicks" />
                      <Line type="monotone" dataKey="installs" stroke="#10b981" strokeWidth={2} dot={false} name="Installs" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Campaign breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign performance</CardTitle>
                <CardDescription>
                  Attributed installs, spend and revenue per tracking link (last-click, 7-day window).
                  Suspect installs are flagged by fraud heuristics and excluded from attributed counts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {breakdownQ.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : breakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tracking links yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Campaign</th>
                          <th className="py-2 pr-4 font-medium">Channel</th>
                          <th className="py-2 pr-4 font-medium text-right">Clicks</th>
                          <th className="py-2 pr-4 font-medium text-right">Installs</th>
                          <th className="py-2 pr-4 font-medium text-right">CVR</th>
                          <th className="py-2 pr-4 font-medium text-right">Suspect</th>
                          <th className="py-2 pr-4 font-medium text-right">Uninst.</th>
                          <th className="py-2 pr-4 font-medium text-right">Spend</th>
                          <th className="py-2 pr-4 font-medium text-right">Revenue</th>
                          <th className="py-2 pr-4 font-medium text-right">ROAS</th>
                          <th className="py-2 pr-4 font-medium text-right">CPI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.map((row) => (
                          <tr key={row.linkId} className="border-b last:border-0" data-testid={`row-breakdown-${row.code}`}>
                            <td className="py-2 pr-4 font-medium">
                              {row.name}
                              {row.creatorId && creatorName.get(row.creatorId) && (
                                <span className="text-xs text-muted-foreground ml-1">· {creatorName.get(row.creatorId)}</span>
                              )}
                            </td>
                            <td className="py-2 pr-4"><Badge variant="secondary">{channelLabel(row.channel)}</Badge></td>
                            <td className="py-2 pr-4 text-right">{row.clicks}</td>
                            <td className="py-2 pr-4 text-right">{row.installs}</td>
                            <td className="py-2 pr-4 text-right">{row.clicks > 0 ? `${((row.installs / row.clicks) * 100).toFixed(1)}%` : "—"}</td>
                            <td className="py-2 pr-4 text-right">{row.suspectInstalls || "—"}</td>
                            <td className="py-2 pr-4 text-right">{row.uninstalls || "—"}</td>
                            <td className="py-2 pr-4 text-right">{row.spendUsd > 0 ? fmtUsd(row.spendUsd) : "—"}</td>
                            <td className="py-2 pr-4 text-right">{fmtUsd(row.revenueUsd)}</td>
                            <td className="py-2 pr-4 text-right">{row.roas !== null ? row.roas.toFixed(2) : "—"}</td>
                            <td className="py-2 pr-4 text-right">{row.cpi !== null ? fmtUsd(row.cpi) : "—"}</td>
                          </tr>
                        ))}
                        {organic && (organic.installs > 0 || organic.revenueUsd > 0) && (
                          <tr className="text-muted-foreground">
                            <td className="py-2 pr-4">Organic (no campaign)</td>
                            <td className="py-2 pr-4">—</td>
                            <td className="py-2 pr-4 text-right">—</td>
                            <td className="py-2 pr-4 text-right">{organic.installs}</td>
                            <td className="py-2 pr-4 text-right">—</td>
                            <td className="py-2 pr-4 text-right">—</td>
                            <td className="py-2 pr-4 text-right">{organic.uninstalls || "—"}</td>
                            <td className="py-2 pr-4 text-right">—</td>
                            <td className="py-2 pr-4 text-right">{fmtUsd(organic.revenueUsd)}</td>
                            <td className="py-2 pr-4 text-right">—</td>
                            <td className="py-2 pr-4 text-right">—</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Apps */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Smartphone className="w-4 h-4" /> Apps</CardTitle>
                  <CardDescription>Register an app to get its server-to-server ingest token.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="App name (e.g. My Game)"
                      value={newAppName}
                      onChange={(e) => setNewAppName(e.target.value)}
                      data-testid="input-app-name"
                    />
                    <Select value={newAppPlatform} onValueChange={setNewAppPlatform}>
                      <SelectTrigger className="w-32" data-testid="select-app-platform">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="android">Android</SelectItem>
                        <SelectItem value="ios">iOS</SelectItem>
                        <SelectItem value="web">Web</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => createApp.mutate()}
                      disabled={!newAppName.trim() || createApp.isPending}
                      data-testid="button-create-app"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {appsQ.isLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : apps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No apps yet — register your first app above.</p>
                  ) : (
                    <div className="space-y-3">
                      {apps.map((app) => (
                        <div key={app.id} className="border rounded-lg p-3 space-y-2" data-testid={`card-app-${app.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{app.name}</span>
                              <Badge variant="outline" className="capitalize">{app.platform}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                title="Regenerate ingest token"
                                onClick={() => regenToken.mutate(app.id)}
                                data-testid={`button-regen-${app.id}`}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                title="Delete app"
                                onClick={() => {
                                  if (window.confirm(`Delete "${app.name}" and all of its attribution data? This cannot be undone.`)) {
                                    deleteApp.mutate(app.id);
                                  }
                                }}
                                data-testid={`button-delete-app-${app.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                              {tokenVisible[app.id] ? app.ingestToken : `${app.ingestToken.slice(0, 10)}••••••••••••`}
                            </code>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => setTokenVisible((s) => ({ ...s, [app.id]: !s[app.id] }))}
                              data-testid={`button-toggle-token-${app.id}`}
                            >
                              {tokenVisible[app.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => copy(app.ingestToken, "Ingest token")}
                              data-testid={`button-copy-token-${app.id}`}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tracking links */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Link2 className="w-4 h-4" /> Tracking links</CardTitle>
                  <CardDescription>Create a link per campaign, use it as the ad's destination URL.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Select value={newLink.appId} onValueChange={(v) => setNewLink((s) => ({ ...s, appId: v, creatorId: "none" }))}>
                        <SelectTrigger className="w-40" data-testid="select-link-app">
                          <SelectValue placeholder="App" />
                        </SelectTrigger>
                        <SelectContent>
                          {apps.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Campaign name"
                        value={newLink.name}
                        onChange={(e) => setNewLink((s) => ({ ...s, name: e.target.value }))}
                        data-testid="input-link-name"
                      />
                      <Select value={newLink.channel} onValueChange={(v) => setNewLink((s) => ({ ...s, channel: v }))}>
                        <SelectTrigger className="w-40" data-testid="select-link-channel">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHANNELS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Destination URL (store page / landing page)"
                        value={newLink.destinationUrl}
                        onChange={(e) => setNewLink((s) => ({ ...s, destinationUrl: e.target.value }))}
                        data-testid="input-link-destination"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Deep link (optional, e.g. myapp://promo/summer)"
                        value={newLink.deepLinkUrl}
                        onChange={(e) => setNewLink((s) => ({ ...s, deepLinkUrl: e.target.value }))}
                        data-testid="input-link-deeplink"
                      />
                      <Select value={newLink.creatorId} onValueChange={(v) => setNewLink((s) => ({ ...s, creatorId: v }))}>
                        <SelectTrigger className="w-44" data-testid="select-link-creator">
                          <SelectValue placeholder="Creator (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No creator</SelectItem>
                          {linkFormCreators.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => createLink.mutate()}
                        disabled={!newLink.appId || !newLink.name.trim() || !newLink.destinationUrl.trim() || createLink.isPending}
                        data-testid="button-create-link"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The deep link is returned to your app when an attributed install reports in — route new
                      users straight to the promoted screen (deferred deep linking).
                    </p>
                  </div>

                  {linksQ.isLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : links.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tracking links yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {links.map((link) => (
                        <div key={link.id} className="border rounded-lg p-3 flex items-center justify-between gap-2" data-testid={`card-link-${link.code}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{link.name}</span>
                              <Badge variant="secondary" className="text-xs">{channelLabel(link.channel)}</Badge>
                              {link.creatorId && creatorName.get(link.creatorId) && (
                                <Badge variant="outline" className="text-xs">{creatorName.get(link.creatorId)}</Badge>
                              )}
                              {link.deepLinkUrl && (
                                <Badge variant="outline" className="text-xs" title={link.deepLinkUrl}>deep link</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{trackingUrl(link.code)}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <LinkQrButton url={trackingUrl(link.code)} name={link.name} code={link.code} />
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              title="Copy tracking URL"
                              onClick={() => copy(trackingUrl(link.code), "Tracking URL")}
                              data-testid={`button-copy-link-${link.code}`}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              title="Delete link"
                              onClick={() => {
                                if (window.confirm(`Delete tracking link "${link.name}"?`)) {
                                  deleteLink.mutate(link.id);
                                }
                              }}
                              data-testid={`button-delete-link-${link.code}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Integration guide */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4" /> Integration guide</CardTitle>
                <CardDescription>
                  Send install and event pings from your app's backend (server-to-server). Installs are attributed to the
                  last click within a 7-day window using IP-based fingerprinting — approximate behind carrier NAT, so treat
                  small-sample numbers with care.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">1 — Report an install (first app open)</Label>
                  <pre className="bg-muted rounded-lg p-3 mt-1 overflow-x-auto text-xs">
{`curl -X POST ${window.location.origin}/api/v1/mmp/ingest/install \\
  -H "X-Ingest-Token: ${guideApp?.ingestToken ?? "mmpi_YOUR_TOKEN"}" \\
  -H "Content-Type: application/json" \\
  -d '{"deviceId": "STABLE-DEVICE-ID"}'`}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-1">
                    If the install was attributed, the response includes the link's <code>deepLink</code> — route the
                    user straight to that screen (deferred deep linking).
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">2 — Report in-app events (with optional revenue in USD)</Label>
                  <pre className="bg-muted rounded-lg p-3 mt-1 overflow-x-auto text-xs">
{`curl -X POST ${window.location.origin}/api/v1/mmp/ingest/event \\
  -H "X-Ingest-Token: ${guideApp?.ingestToken ?? "mmpi_YOUR_TOKEN"}" \\
  -H "Content-Type: application/json" \\
  -d '{"deviceId": "STABLE-DEVICE-ID", "name": "purchase", "revenue": 4.99}'`}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>Always include the same <code>deviceId</code> on every event</strong> — retention, cohorts and
                    creator analytics link events back to the install through it. Events without a deviceId cannot be
                    attributed.
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">3 — Report an uninstall (optional)</Label>
                  <pre className="bg-muted rounded-lg p-3 mt-1 overflow-x-auto text-xs">
{`curl -X POST ${window.location.origin}/api/v1/mmp/ingest/uninstall \\
  -H "X-Ingest-Token: ${guideApp?.ingestToken ?? "mmpi_YOUR_TOKEN"}" \\
  -H "Content-Type: application/json" \\
  -d '{"deviceId": "STABLE-DEVICE-ID"}'`}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-1">
                    Trigger this from your push-token feedback loop or a server-side inactivity heuristic. Uninstall
                    rates per campaign appear in the overview and health monitor.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use a stable device identifier (IDFV, GAID, or a UUID you persist on first launch). Duplicate install
                  pings for the same device are de-duplicated automatically. Send the ping from the device itself (or
                  forward the device's IP) so click matching works.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health">
            <HealthTab appId={selectedAppId !== "all" ? selectedAppId : null} />
          </TabsContent>
          <TabsContent value="creators">
            <CreatorsTab apps={apps} selectedAppId={selectedAppId} days={days} />
          </TabsContent>
          <TabsContent value="cohorts">
            <CohortsTab selectedAppId={selectedAppId} days={days} />
          </TabsContent>
          <TabsContent value="benchmarks">
            <BenchmarksTab apps={apps} selectedAppId={selectedAppId} />
          </TabsContent>
          <TabsContent value="costs">
            <CostsTab links={links} selectedAppId={selectedAppId} days={days} />
          </TabsContent>
          <TabsContent value="skan">
            <SkanTab apps={apps} selectedAppId={selectedAppId} />
          </TabsContent>
          <TabsContent value="debug">
            <DebugTab selectedAppId={selectedAppId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
