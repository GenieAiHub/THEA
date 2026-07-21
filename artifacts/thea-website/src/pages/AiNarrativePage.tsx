import React, { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useGetAiNarrativeOverview,
  useListAiNarrativePrompts,
  useGetAiNarrativeTimeline,
  useListAiNarrativeRuns,
  useRunAiNarrative,
  useCreateAiNarrativePrompt,
  useUpdateAiNarrativePrompt,
  useDeleteAiNarrativePrompt,
  getGetAiNarrativeOverviewQueryKey,
  getGetAiNarrativeTimelineQueryKey,
  getListAiNarrativePromptsQueryKey,
  getListAiNarrativeRunsQueryKey,
  type NarrativeEntitySummary,
  type NarrativeProviderReading,
  type NarrativePrompt,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bot, Play, Plus, Trash2, TrendingUp, TrendingDown, Minus, ExternalLink,
  Pause, CircleCheck, CircleAlert, LoaderCircle, Quote,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

const PROVIDER_LABELS: Record<string, string> = { openai: "ChatGPT (OpenAI)", gemini: "Gemini (grounded)" };
const PROVIDER_COLORS: Record<string, string> = { openai: "#34d399", gemini: "#818cf8" };

function fmtSentiment(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}

function sentimentColor(v: number | null | undefined): string {
  if (v === null || v === undefined) return "text-slate-500";
  if (v > 0.15) return "text-emerald-400";
  if (v < -0.15) return "text-rose-400";
  return "text-slate-300";
}

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined) return null;
  const Icon = delta > 0.05 ? TrendingUp : delta < -0.05 ? TrendingDown : Minus;
  const cls = delta > 0.05 ? "text-emerald-400" : delta < -0.05 ? "text-rose-400" : "text-slate-500";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cls}`}>
      <Icon className="w-3 h-3" />
      {fmtSentiment(delta)}
    </span>
  );
}

function runStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><CircleCheck className="w-3 h-3 mr-1" />Completed</Badge>;
    case "partial":
      return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20"><CircleAlert className="w-3 h-3 mr-1" />Partial</Badge>;
    case "failed":
      return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20"><CircleAlert className="w-3 h-3 mr-1" />Failed</Badge>;
    default:
      return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20"><LoaderCircle className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
  }
}

export default function AiNarrativePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [timelineDays, setTimelineDays] = useState<number>(30);
  const [newEntity, setNewEntity] = useState("");
  const [newEntityType, setNewEntityType] = useState("brand");
  const [newPromptText, setNewPromptText] = useState("");

  const { data: overview, isLoading: loadingOverview } = useGetAiNarrativeOverview();
  const { data: promptsData, isLoading: loadingPrompts } = useListAiNarrativePrompts();
  const { data: runsData } = useListAiNarrativeRuns();

  const entities: NarrativeEntitySummary[] = overview?.entities ?? [];
  const activeEntity = selectedEntity || entities[0]?.entity || "";

  const { data: timelineData, isLoading: loadingTimeline } = useGetAiNarrativeTimeline(
    { entity: activeEntity, days: timelineDays },
    {
      query: {
        enabled: !!activeEntity,
        queryKey: getGetAiNarrativeTimelineQueryKey({ entity: activeEntity, days: timelineDays }),
      },
    },
  );

  const runMutation = useRunAiNarrative();
  const createPrompt = useCreateAiNarrativePrompt();
  const updatePrompt = useUpdateAiNarrativePrompt();
  const deletePrompt = useDeleteAiNarrativePrompt();

  const isRunning = overview?.lastRun?.status === "running";

  const chartData = useMemo(() => {
    const points = timelineData?.data ?? [];
    const byRun = new Map<string, { at: string; ts: number; openai?: number; gemini?: number }>();
    for (const p of points) {
      const existing = byRun.get(p.runId) ?? { at: p.at, ts: new Date(p.at).getTime() };
      (existing as Record<string, unknown>)[p.provider] = p.sentiment;
      if (new Date(p.at).getTime() < existing.ts) {
        existing.ts = new Date(p.at).getTime();
        existing.at = p.at;
      }
      byRun.set(p.runId, existing);
    }
    return Array.from(byRun.values())
      .sort((a, b) => a.ts - b.ts)
      .map((r) => ({
        ...r,
        label: new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
          " " + new Date(r.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      }));
  }, [timelineData]);

  const handleRunNow = async () => {
    try {
      await runMutation.mutateAsync();
      toast({ title: "Narrative run queued", description: "Results will appear here in a few minutes." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: getGetAiNarrativeOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAiNarrativeRunsQueryKey() });
      }, 2000);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      toast({
        title: status === 409 ? "A run is already in progress" :
          status === 429 ? "Daily AI budget reached" : "Could not queue run",
        variant: "destructive",
      });
    }
  };

  const handleAddPrompt = async () => {
    if (!newEntity.trim() || !newPromptText.trim()) {
      toast({ title: "Entity and question are required", variant: "destructive" });
      return;
    }
    try {
      await createPrompt.mutateAsync({
        data: { entity: newEntity.trim(), entityType: newEntityType as never, promptText: newPromptText.trim() },
      });
      setNewEntity("");
      setNewPromptText("");
      queryClient.invalidateQueries({ queryKey: getListAiNarrativePromptsQueryKey() });
      toast({ title: "Prompt added" });
    } catch {
      toast({ title: "Could not add prompt", variant: "destructive" });
    }
  };

  const handleToggleActive = async (prompt: NarrativePrompt) => {
    try {
      await updatePrompt.mutateAsync({ promptId: prompt.id, data: { isActive: !prompt.isActive } });
      queryClient.invalidateQueries({ queryKey: getListAiNarrativePromptsQueryKey() });
    } catch {
      toast({ title: "Could not update prompt", variant: "destructive" });
    }
  };

  const handleDeletePrompt = async (prompt: NarrativePrompt) => {
    try {
      await deletePrompt.mutateAsync({ promptId: prompt.id });
      queryClient.invalidateQueries({ queryKey: getListAiNarrativePromptsQueryKey() });
      toast({ title: `Stopped tracking "${prompt.entity}"` });
    } catch {
      toast({ title: "Could not delete prompt", variant: "destructive" });
    }
  };

  const selectedSummary = entities.find((e) => e.entity === activeEntity);

  return (
    <DashboardLayout title="AI Narrative Monitor">
      <div className="flex flex-col gap-6 max-w-6xl">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-100">AI Narrative Monitor</h1>
            <p className="text-sm text-slate-500 mt-1">
              How ChatGPT and Gemini describe your brand and competitors — tracked over time, with alerts on negative shifts
            </p>
          </div>
          <div className="flex items-center gap-3">
            {overview?.lastRun && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {runStatusBadge(overview.lastRun.status)}
                <span>{new Date(overview.lastRun.startedAt).toLocaleString()}</span>
              </div>
            )}
            <Button
              onClick={handleRunNow}
              disabled={runMutation.isPending || isRunning}
              data-testid="button-run-narrative"
            >
              {isRunning ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {isRunning ? "Run in progress…" : "Run now"}
            </Button>
          </div>
        </div>

        {loadingOverview ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : entities.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Bot className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-300 font-medium">No narrative data yet</p>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Prompts are seeded from your watchlist automatically. Click "Run now" to ask ChatGPT and Gemini
                about your tracked entities and start building a history.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {entities.map((entity) => (
              <Card
                key={entity.entity}
                className={`cursor-pointer transition-colors ${activeEntity === entity.entity ? "border-primary/60" : "hover:border-slate-600"}`}
                onClick={() => setSelectedEntity(entity.entity)}
                data-testid={`card-entity-${entity.entity.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-slate-100">{entity.entity}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{entity.entityType}</Badge>
                      <span className={`text-xl font-bold ${sentimentColor(entity.avgSentiment)}`}>
                        {fmtSentiment(entity.avgSentiment)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {entity.providers.map((p: NarrativeProviderReading) => (
                    <div key={p.provider} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[p.provider] ?? "#64748b" }} />
                        {PROVIDER_LABELS[p.provider] ?? p.provider}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={sentimentColor(p.sentiment)}>{fmtSentiment(p.sentiment)}</span>
                        <DeltaBadge delta={p.delta} />
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeEntity && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base text-slate-100">Sentiment timeline — {activeEntity}</CardTitle>
                  <CardDescription>How each AI assistant's tone has moved (−1 very negative … +1 very positive)</CardDescription>
                </div>
                <div className="flex gap-1">
                  {[7, 30, 90].map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={timelineDays === d ? "default" : "ghost"}
                      onClick={() => setTimelineDays(d)}
                      data-testid={`button-days-${d}`}
                    >
                      {d}d
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTimeline ? (
                <Skeleton className="h-64" />
              ) : chartData.length === 0 ? (
                <p className="text-sm text-slate-500 py-10 text-center">No scored responses in this window yet.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis domain={[-1, 1]} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                        labelStyle={{ color: "#cbd5e1" }}
                      />
                      <Legend />
                      <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="openai" name="ChatGPT" stroke={PROVIDER_COLORS.openai} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="gemini" name="Gemini" stroke={PROVIDER_COLORS.gemini} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedSummary && selectedSummary.providers.some((p) => p.quoteSnippets.length || p.notableClaims.length) && (
          <div className="grid gap-4 md:grid-cols-2">
            {selectedSummary.providers.map((p) => (
              <Card key={p.provider}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[p.provider] ?? "#64748b" }} />
                    {PROVIDER_LABELS[p.provider] ?? p.provider}
                    <span className="text-xs text-slate-500 font-normal">{p.model}</span>
                  </CardTitle>
                  <CardDescription>Answered {new Date(p.answeredAt).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {p.quoteSnippets.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Key quotes</p>
                      <ul className="space-y-1.5">
                        {p.quoteSnippets.map((q, i) => (
                          <li key={i} className="flex gap-2 text-slate-300">
                            <Quote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-600" />
                            <span className="italic">{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {p.notableClaims.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Notable claims</p>
                      <ul className="list-disc list-inside space-y-1 text-slate-400">
                        {p.notableClaims.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                  {p.groundingSources.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Cited sources</p>
                      <div className="flex flex-wrap gap-2">
                        {p.groundingSources.map((s, i) => (
                          <a
                            key={i}
                            href={s.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {s.title || new URL(s.uri).hostname}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-100">Tracked prompts</CardTitle>
            <CardDescription>
              Questions asked to each AI assistant on every run
              {promptsData?.promptCap ? ` — up to ${promptsData.promptCap} active prompts per run on your plan` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingPrompts ? (
              <Skeleton className="h-24" />
            ) : (
              <div className="space-y-2">
                {(promptsData?.data ?? []).map((prompt) => (
                  <div
                    key={prompt.id}
                    className={`flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 ${prompt.isActive ? "" : "opacity-50"}`}
                    data-testid={`row-prompt-${prompt.id}`}
                  >
                    <Badge variant="outline" className="capitalize shrink-0">{prompt.entityType}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200 truncate">{prompt.entity}</p>
                      <p className="text-xs text-slate-500 truncate">{prompt.promptText}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(prompt)}
                      title={prompt.isActive ? "Pause this prompt" : "Resume this prompt"}
                      data-testid={`button-toggle-${prompt.id}`}
                    >
                      {prompt.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-400 hover:text-rose-300"
                      onClick={() => handleDeletePrompt(prompt)}
                      data-testid={`button-delete-${prompt.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {(promptsData?.data ?? []).length === 0 && (
                  <p className="text-sm text-slate-500">No prompts yet — add one below or add brand/competitor keywords to your watchlist.</p>
                )}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-[1fr_160px_2fr_auto] items-end pt-2 border-t border-slate-800">
              <div>
                <Label htmlFor="narrative-entity" className="text-xs text-slate-400">Entity</Label>
                <Input
                  id="narrative-entity"
                  placeholder="e.g. Acme Corp"
                  value={newEntity}
                  onChange={(e) => setNewEntity(e.target.value)}
                  data-testid="input-entity"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Type</Label>
                <Select value={newEntityType} onValueChange={setNewEntityType}>
                  <SelectTrigger data-testid="select-entity-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand">Brand</SelectItem>
                    <SelectItem value="competitor">Competitor</SelectItem>
                    <SelectItem value="person">Person</SelectItem>
                    <SelectItem value="keyword">Keyword</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="narrative-question" className="text-xs text-slate-400">Question to ask the AIs</Label>
                <Input
                  id="narrative-question"
                  placeholder='e.g. "What is Acme Corp known for?"'
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  data-testid="input-prompt-text"
                />
              </div>
              <Button onClick={handleAddPrompt} disabled={createPrompt.isPending} data-testid="button-add-prompt">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {(runsData?.data ?? []).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">Run history</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {(runsData?.data ?? []).map((run) => (
                  <div key={run.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/60 last:border-0">
                    <div className="flex items-center gap-3">
                      {runStatusBadge(run.status)}
                      <span className="text-slate-400">{new Date(run.startedAt).toLocaleString()}</span>
                      <Badge variant="outline" className="text-xs capitalize">{run.trigger}</Badge>
                    </div>
                    <span className="text-xs text-slate-500">
                      {run.responseCount} responses / {run.promptCount} prompts
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
