import { useState } from "react";
import {
  useAdminMarkets,
  useAdminMarketSettings,
  useAdminUpdateMarketSettings,
  useAdminCreateMarket,
  useAdminUpdateMarket,
  useAdminDeleteMarket,
  useAdminGenerateMarkets,
} from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Sparkles, Plus, Trash2, Lock, Unlock, CheckCircle2, X } from "lucide-react";

interface MarketOption {
  label: string;
  votes: number;
  percentage: number;
}

interface AdminMarket {
  id: string;
  question: string;
  description: string | null;
  category: string;
  options: MarketOption[];
  totalVotes: number;
  status: string;
  resolvedOption: number | null;
  source: string;
  sourceTopic: string | null;
  closesAt: string | null;
  createdAt: string;
}

interface MarketSettings {
  enabled: boolean;
  frequencyMinutes: number;
  topics: string[];
  marketsPerRun: number;
  lastRunAt: string | null;
}

const FREQUENCY_OPTIONS = [
  { label: "Every hour", value: 60 },
  { label: "Every 3 hours", value: 180 },
  { label: "Every 6 hours", value: 360 },
  { label: "Every 12 hours", value: 720 },
  { label: "Daily", value: 1440 },
];

function SettingsPanel() {
  const { data, isLoading } = useAdminMarketSettings();
  const updateSettings = useAdminUpdateMarketSettings();
  const generate = useAdminGenerateMarkets();
  const { toast } = useToast();
  const settings: MarketSettings | undefined = data;
  const [topicsInput, setTopicsInput] = useState<string | null>(null);

  if (isLoading || !settings) {
    return (
      <div className="border border-border rounded-sm p-4 text-xs font-mono text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  const topicsValue = topicsInput ?? settings.topics.join(", ");

  const saveTopics = () => {
    if (topicsInput === null) return;
    const topics = topicsInput.split(",").map((t) => t.trim()).filter(Boolean);
    updateSettings.mutate(
      { topics },
      {
        onSuccess: () => {
          setTopicsInput(null);
          toast({ title: "Topics updated" });
        },
        onError: (e: any) => toast({ title: "Failed to update topics", description: e.message, variant: "destructive" }),
      },
    );
  };

  const handleGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: (res: any) => toast({ title: "Generation complete", description: res?.message ?? `Generated ${res?.generated} market(s)` }),
      onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="border border-border rounded-sm p-5 space-y-5 bg-card/40">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-mono font-bold">Auto-Generation</span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generate.isPending}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          data-testid="button-generate-now"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {generate.isPending ? "Generating..." : "Generate Now"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Status</label>
          <button
            onClick={() =>
              updateSettings.mutate(
                { enabled: !settings.enabled },
                {
                  onSuccess: () => toast({ title: settings.enabled ? "Auto-generation disabled" : "Auto-generation enabled" }),
                  onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
                },
              )
            }
            disabled={updateSettings.isPending}
            className={`w-full px-3 py-2 text-xs font-mono rounded-sm border transition-colors ${
              settings.enabled
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-muted/30 text-muted-foreground"
            }`}
            data-testid="button-toggle-autogen"
          >
            {settings.enabled ? "● ENABLED" : "○ DISABLED"}
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Frequency</label>
          <select
            value={settings.frequencyMinutes}
            onChange={(e) =>
              updateSettings.mutate(
                { frequencyMinutes: Number(e.target.value) },
                {
                  onSuccess: () => toast({ title: "Frequency updated" }),
                  onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
                },
              )
            }
            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm text-foreground"
            data-testid="select-frequency"
          >
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
            {!FREQUENCY_OPTIONS.some((o) => o.value === settings.frequencyMinutes) && (
              <option value={settings.frequencyMinutes}>Every {settings.frequencyMinutes} min</option>
            )}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Polls per run</label>
          <select
            value={settings.marketsPerRun}
            onChange={(e) =>
              updateSettings.mutate(
                { marketsPerRun: Number(e.target.value) },
                {
                  onSuccess: () => toast({ title: "Updated" }),
                  onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
                },
              )
            }
            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm text-foreground"
            data-testid="select-per-run"
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Focus topics (comma-separated — leave empty to follow trending data)
        </label>
        <div className="flex gap-2">
          <input
            value={topicsValue}
            onChange={(e) => setTopicsInput(e.target.value)}
            placeholder="e.g. AI, elections, climate, crypto"
            className="flex-1 px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm text-foreground placeholder:text-muted-foreground/50"
            data-testid="input-topics"
          />
          {topicsInput !== null && (
            <button
              onClick={saveTopics}
              disabled={updateSettings.isPending}
              className="px-3 py-2 text-xs font-mono bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
              data-testid="button-save-topics"
            >
              Save
            </button>
          )}
        </div>
      </div>

      {settings.lastRunAt && (
        <p className="text-[10px] font-mono text-muted-foreground">
          Last generation run: {new Date(settings.lastRunAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function CreateMarketForm({ onClose }: { onClose: () => void }) {
  const create = useAdminCreateMarket();
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [options, setOptions] = useState<string[]>(["Yes", "No"]);
  const [closesInDays, setClosesInDays] = useState(30);

  const submit = () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) {
      toast({ title: "Question and at least 2 options are required", variant: "destructive" });
      return;
    }
    create.mutate(
      {
        question: question.trim(),
        description: description.trim() || undefined,
        category: category.trim() || "General",
        options: cleanOptions,
        closesAt: new Date(Date.now() + closesInDays * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        onSuccess: () => {
          toast({ title: "Market created" });
          onClose();
        },
        onError: (e: any) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="border border-primary/30 rounded-sm p-5 space-y-4 bg-primary/5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono font-bold">New Market</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="button-close-create">
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Question — e.g. Will X happen by August 2026?"
        className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm"
        data-testid="input-question"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short description / context (optional)"
        rows={2}
        className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm resize-none"
        data-testid="input-description"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm"
            data-testid="input-category"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Closes in (days)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={closesInDays}
            onChange={(e) => setClosesInDays(Number(e.target.value) || 30)}
            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm"
            data-testid="input-closes-days"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Options</label>
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={opt}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
              className="flex-1 px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm"
              data-testid={`input-option-${i}`}
            />
            {options.length > 2 && (
              <button
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
                className="px-2 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button
            onClick={() => setOptions([...options, ""])}
            className="text-xs font-mono text-primary hover:underline"
            data-testid="button-add-option"
          >
            + Add option
          </button>
        )}
      </div>

      <button
        onClick={submit}
        disabled={create.isPending}
        className="px-4 py-2 text-xs font-mono bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
        data-testid="button-submit-create"
      >
        {create.isPending ? "Creating..." : "Create Market"}
      </button>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  open: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  closed: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  resolved: "text-primary border-primary/30 bg-primary/10",
};

export default function MarketsPage() {
  const { data, isLoading } = useAdminMarkets();
  const updateMarket = useAdminUpdateMarket();
  const deleteMarket = useAdminDeleteMarket();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const markets: AdminMarket[] = data ?? [];

  const handleStatus = (m: AdminMarket, status: string) => {
    updateMarket.mutate(
      { id: m.id, status },
      {
        onSuccess: () => toast({ title: `Market ${status === "open" ? "reopened" : status}` }),
        onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  const handleResolve = (m: AdminMarket, optionIndex: number) => {
    updateMarket.mutate(
      { id: m.id, resolvedOption: optionIndex },
      {
        onSuccess: () => {
          setResolvingId(null);
          toast({ title: `Resolved: ${m.options[optionIndex]?.label}` });
        },
        onError: (e: any) => toast({ title: "Resolve failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  const handleDelete = (m: AdminMarket) => {
    if (!window.confirm(`Delete market "${m.question}"? This removes all ${m.totalVotes} votes.`)) return;
    deleteMarket.mutate(m.id, {
      onSuccess: () => toast({ title: "Market deleted" }),
      onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-mono font-bold text-foreground">Markets</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {markets.length} prediction market{markets.length !== 1 ? "s" : ""} — public voting at /markets
          </p>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-border rounded-sm hover:bg-muted transition-colors"
          data-testid="button-new-market"
        >
          <Plus className="h-3.5 w-3.5" />
          New Market
        </button>
      </div>

      <SettingsPanel />

      {showCreate && <CreateMarketForm onClose={() => setShowCreate(false)} />}

      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Question</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Category</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Status</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Votes</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Source</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Closes</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : markets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-8 w-8 opacity-30" />
                    <span>No markets yet. Generate some or create one manually.</span>
                  </div>
                </td>
              </tr>
            ) : (
              markets.map((m) => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors align-top" data-testid={`row-market-${m.id}`}>
                  <td className="px-4 py-3 max-w-md">
                    <div className="text-foreground font-semibold">{m.question}</div>
                    {resolvingId === m.id ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="text-muted-foreground py-1">Winner:</span>
                        {m.options.map((o, i) => (
                          <button
                            key={i}
                            onClick={() => handleResolve(m, i)}
                            className="px-2 py-1 border border-primary/40 text-primary rounded-sm hover:bg-primary/10"
                            data-testid={`button-resolve-option-${i}`}
                          >
                            {o.label}
                          </button>
                        ))}
                        <button onClick={() => setResolvingId(null)} className="px-2 py-1 text-muted-foreground hover:text-foreground">
                          cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 text-muted-foreground">
                        {m.options.map((o, i) => (
                          <span key={i} className="mr-3">
                            {m.resolvedOption === i && <CheckCircle2 className="inline h-3 w-3 text-primary mr-0.5" />}
                            {o.label}: {o.percentage}%
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-primary">{m.category}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 border rounded-sm uppercase text-[10px] tracking-wider ${statusStyles[m.status] ?? ""}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">{m.totalVotes}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.source === "auto" ? (
                      <span title={m.sourceTopic ?? undefined} className="text-primary/70">auto</span>
                    ) : (
                      "manual"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                    {m.closesAt ? new Date(m.closesAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {m.status === "open" ? (
                        <button
                          onClick={() => handleStatus(m, "closed")}
                          title="Close voting"
                          className="p-1.5 text-muted-foreground hover:text-amber-400 transition-colors"
                          data-testid={`button-close-${m.id}`}
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </button>
                      ) : m.status === "closed" ? (
                        <button
                          onClick={() => handleStatus(m, "open")}
                          title="Reopen voting"
                          className="p-1.5 text-muted-foreground hover:text-emerald-400 transition-colors"
                          data-testid={`button-reopen-${m.id}`}
                        >
                          <Unlock className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {m.status !== "resolved" && (
                        <button
                          onClick={() => setResolvingId(resolvingId === m.id ? null : m.id)}
                          title="Resolve market"
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                          data-testid={`button-resolve-${m.id}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(m)}
                        title="Delete market"
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        data-testid={`button-delete-${m.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
