import { useState } from "react";
import {
  useAdminScheduler,
  useReloadScheduler,
  useTriggerAnalysis,
  useTriggerCollection,
  useCollectionRuns,
  useAdminConfigs,
  useAdminUpsertConfig,
} from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { Clock, Play, RefreshCw, Waves, Rss } from "lucide-react";

const INTERVAL_KEYS = [
  { key: "mirofish_interval_minutes", label: "MiroFish run interval", def: 60 },
  { key: "llm_classify_interval_minutes", label: "LLM classify interval", def: 15 },
  { key: "llm_embed_interval_minutes", label: "LLM embed interval", def: 30 },
];

function IntervalEditor({ onSaved }: { onSaved: () => void }) {
  const { data: configs } = useAdminConfigs();
  const upsert = useAdminUpsertConfig();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const valueFor = (key: string, def: number) => {
    if (drafts[key] !== undefined) return drafts[key];
    const cfg = (configs ?? []).find((c: any) => c.key === key);
    return cfg?.value ?? String(def);
  };

  const save = (key: string, def: number) => {
    const v = valueFor(key, def).trim();
    if (!/^\d+$/.test(v) || Number(v) < 1) {
      toast({ title: "Enter a whole number ≥ 1", variant: "destructive" });
      return;
    }
    upsert.mutate(
      { key, value: v },
      {
        onSuccess: () => {
          setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
          toast({ title: "Interval saved", description: "Reload schedulers to apply." });
          onSaved();
        },
        onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {INTERVAL_KEYS.map(({ key, label, def }) => (
        <div key={key} className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label} (min)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={valueFor(key, def)}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
              className="flex-1 px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm text-foreground"
              data-testid={`input-${key}`}
            />
            <button
              onClick={() => save(key, def)}
              disabled={upsert.isPending}
              className="px-3 py-2 text-xs font-mono bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
              data-testid={`button-save-${key}`}
            >
              Save
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SchedulerPage() {
  const { data, isLoading } = useAdminScheduler();
  const reload = useReloadScheduler();
  const triggerAnalysis = useTriggerAnalysis();
  const triggerCollection = useTriggerCollection();
  const { data: runs } = useCollectionRuns(15);
  const { toast } = useToast();

  const [analysisCategory, setAnalysisCategory] = useState("");
  const [sourceType, setSourceType] = useState("rss-all");
  const [fetchCategory, setFetchCategory] = useState("");

  const sched = data as any;

  const handleReload = () => {
    reload.mutate(undefined, {
      onSuccess: () => toast({ title: "Schedulers reloaded", description: "New cadences are now active." }),
      onError: (e: any) => toast({ title: "Reload failed", description: e.message, variant: "destructive" }),
    });
  };

  const runAnalysis = () => {
    triggerAnalysis.mutate(
      { category: analysisCategory || undefined },
      {
        onSuccess: (r: any) => toast({ title: "MiroFish run queued", description: r?.categories ? `Categories: ${r.categories.join(", ")}` : undefined }),
        onError: (e: any) => toast({ title: "Trigger failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  const runFetch = () => {
    triggerCollection.mutate(
      { sourceType, category: fetchCategory || undefined },
      {
        onSuccess: () => toast({ title: "Data fetch queued", description: sourceType }),
        onError: (e: any) => toast({ title: "Fetch failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  const sourceTypes: string[] = sched?.validSourceTypes ?? ["rss-all"];
  const categories: string[] = sched?.categories ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-mono font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Scheduler
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            MiroFish analysis &amp; data-fetch cadence, manual triggers, and run history
          </p>
        </div>
        <button
          onClick={handleReload}
          disabled={reload.isPending}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-border rounded-sm hover:bg-muted transition-colors disabled:opacity-50"
          data-testid="button-reload-scheduler"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${reload.isPending ? "animate-spin" : ""}`} />
          {reload.isPending ? "Reloading..." : "Apply Cadence"}
        </button>
      </div>

      {/* Intervals */}
      <div className="border border-border rounded-sm p-5 space-y-4 bg-card/40">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-mono font-bold">Cadence</span>
          <span className="text-[10px] font-mono text-muted-foreground">— save an interval, then Apply Cadence to re-register the schedulers</span>
        </div>
        <IntervalEditor onSaved={() => { /* cadence applied via Apply button */ }} />
      </div>

      {/* Manual triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-sm p-5 space-y-4 bg-card/40">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-primary" />
            <span className="text-sm font-mono font-bold">Run MiroFish Analysis</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Category (blank = all core)</label>
            <select
              value={analysisCategory}
              onChange={(e) => setAnalysisCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm text-foreground"
              data-testid="select-analysis-category"
            >
              <option value="">All core categories</option>
              {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <button
            onClick={runAnalysis}
            disabled={triggerAnalysis.isPending}
            className="flex items-center gap-2 px-3 py-2 text-xs font-mono bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
            data-testid="button-run-analysis"
          >
            <Play className="h-3.5 w-3.5" />
            {triggerAnalysis.isPending ? "Queuing..." : "Run Now"}
          </button>
        </div>

        <div className="border border-border rounded-sm p-5 space-y-4 bg-card/40">
          <div className="flex items-center gap-2">
            <Rss className="h-4 w-4 text-primary" />
            <span className="text-sm font-mono font-bold">Trigger Data Fetch</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Source</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm text-foreground"
                data-testid="select-source-type"
              >
                {sourceTypes.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Category (optional)</label>
              <input
                value={fetchCategory}
                onChange={(e) => setFetchCategory(e.target.value)}
                placeholder="e.g. Politics"
                className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm text-foreground placeholder:text-muted-foreground/50"
                data-testid="input-fetch-category"
              />
            </div>
          </div>
          <button
            onClick={runFetch}
            disabled={triggerCollection.isPending}
            className="flex items-center gap-2 px-3 py-2 text-xs font-mono bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
            data-testid="button-run-fetch"
          >
            <Play className="h-3.5 w-3.5" />
            {triggerCollection.isPending ? "Queuing..." : "Fetch Now"}
          </button>
          <p className="text-[10px] font-mono text-muted-foreground">
            web-crawler / deepseek-crawl require URLs — use the crawler sources config for those.
          </p>
        </div>
      </div>

      {/* Registered schedulers */}
      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Registered Schedulers</h2>
        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Queue</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Key</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Every</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Next run</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : (sched?.jobSchedulers ?? []).length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No schedulers registered yet.</td></tr>
              ) : (
                sched.jobSchedulers.map((j: any) => (
                  <tr key={`${j.queue}-${j.key}`} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-foreground">{j.queue}</td>
                    <td className="px-4 py-2.5 text-primary">{j.key}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {j.every ? `${Math.round(Number(j.every) / 60000)}m` : (j.pattern ?? "—")}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                      {j.next ? new Date(Number(j.next)).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent runs */}
      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Recent Data-Fetch Runs</h2>
        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Source</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Status</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Fetched</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Stored</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Started</th>
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No runs yet.</td></tr>
              ) : (
                (runs ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-foreground">{r.sourceType}</td>
                    <td className="px-4 py-2.5 text-muted-foreground uppercase text-[10px] tracking-wider">{r.status}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{r.itemsFetched ?? 0}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{r.itemsStored ?? 0}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">{new Date(r.startedAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
