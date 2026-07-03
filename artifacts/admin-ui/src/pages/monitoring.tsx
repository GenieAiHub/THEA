import { useAdminMonitoring } from "@/hooks/use-admin";
import { Activity, Database, Server, Search, Layers, Rss } from "lucide-react";

const statusDot: Record<string, string> = {
  ok: "text-emerald-400",
  unavailable: "text-destructive",
};

function HealthPill({ label, status, icon: Icon }: { label: string; status: string; icon: any }) {
  const ok = status === "ok";
  return (
    <div className="border border-border rounded-sm p-4 bg-card/40 flex items-center gap-3">
      <Icon className={`h-5 w-5 ${statusDot[status] ?? "text-muted-foreground"}`} />
      <div>
        <div className="text-xs font-mono font-bold text-foreground">{label}</div>
        <div className={`text-[11px] font-mono uppercase tracking-wider ${ok ? "text-emerald-400" : "text-destructive"}`}>
          {ok ? "● operational" : "○ " + status}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border rounded-sm p-4 bg-card/40">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-2xl font-mono font-bold text-foreground mt-1">{value}</div>
    </div>
  );
}

const runStatusStyles: Record<string, string> = {
  completed: "text-emerald-400",
  success: "text-emerald-400",
  running: "text-primary",
  failed: "text-destructive",
  error: "text-destructive",
};

export default function MonitoringPage() {
  const { data, isLoading } = useAdminMonitoring();

  if (isLoading || !data) {
    return (
      <div className="border border-border rounded-sm p-6 text-xs font-mono text-muted-foreground">
        Loading monitoring data...
      </div>
    );
  }

  const { health, queues, content, collection, sources } = data as any;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-mono font-bold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Monitoring
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Live system health, queues &amp; ingestion — auto-refreshes every 15s
          </p>
        </div>
      </div>

      {/* Health */}
      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Service Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <HealthPill label="PostgreSQL" status={health.database} icon={Database} />
          <HealthPill label="Redis" status={health.redis} icon={Server} />
          <HealthPill label="Elasticsearch" status={health.elasticsearch} icon={Search} />
        </div>
      </div>

      {/* Ingestion stats */}
      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Ingestion (last 24h)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Stat label="Content total" value={content.total.toLocaleString()} />
          <Stat label="Content 24h" value={content.last24h.toLocaleString()} />
          <Stat label="Runs 24h" value={collection.runs24h} />
          <Stat label="Fetched 24h" value={collection.fetched24h} />
          <Stat label="Stored 24h" value={collection.stored24h} />
          <Stat label="Sources" value={`${sources.active}/${sources.total}`} />
        </div>
      </div>

      {/* Queues */}
      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5" /> Job Queues
        </h2>
        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Queue</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Waiting</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Active</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Delayed</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Completed</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Failed</th>
              </tr>
            </thead>
            <tbody>
              {(queues ?? []).map((q: any) => (
                <tr key={q.name} className="border-b border-border/50 hover:bg-muted/20" data-testid={`row-queue-${q.name}`}>
                  <td className="px-4 py-2.5 text-foreground">{q.name}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{q.counts.waiting ?? 0}</td>
                  <td className="px-4 py-2.5 text-right text-primary">{q.counts.active ?? 0}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{q.counts.delayed ?? 0}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-400/80">{q.counts.completed ?? 0}</td>
                  <td className={`px-4 py-2.5 text-right ${(q.counts.failed ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {q.counts.failed ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent collection runs */}
      <div>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Rss className="h-3.5 w-3.5" /> Recent Collection Runs
        </h2>
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
              {(collection.recentRuns ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No runs yet.</td>
                </tr>
              ) : (
                collection.recentRuns.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-foreground">{r.sourceType}</td>
                    <td className={`px-4 py-2.5 uppercase text-[10px] tracking-wider ${runStatusStyles[r.status] ?? "text-muted-foreground"}`}>
                      {r.status}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{r.itemsFetched ?? 0}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{r.itemsStored ?? 0}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                      {new Date(r.startedAt).toLocaleString()}
                    </td>
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
