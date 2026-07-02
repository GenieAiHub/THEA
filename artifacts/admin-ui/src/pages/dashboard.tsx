import { useAdminStats, useAdminUsage } from "@/hooks/use-admin";
import { Building2, Cpu, DollarSign, Activity } from "lucide-react";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="border border-border bg-card rounded-sm p-5 flex items-start gap-4">
      <div className="p-2 bg-primary/10 rounded-sm">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <div className="text-2xl font-mono font-bold text-foreground">{value}</div>
        <div className="text-xs font-mono text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-xs font-mono text-primary/70 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const stats = useAdminStats();
  const usage = useAdminUsage();

  const usageData: any[] = usage.data ?? [];
  const totalTokens = usageData.reduce((s: number, r: any) => s + (r.totalTokens ?? 0), 0);
  const totalCost = usageData.reduce((s: number, r: any) => s + (r.estimatedCostUsd ?? 0), 0);
  const recentOps = usageData.slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-mono font-bold text-foreground">Platform Overview</h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          {stats.data?.timestamp
            ? `Last refreshed: ${new Date(stats.data.timestamp).toUTCString()}`
            : "Loading..."}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Organizations"
          value={stats.isLoading ? "—" : (stats.data?.organizations ?? 0)}
          icon={Building2}
        />
        <StatCard
          label="LLM Calls (last 100)"
          value={usageData.length}
          icon={Activity}
        />
        <StatCard
          label="Total Tokens (last 100)"
          value={totalTokens.toLocaleString()}
          icon={Cpu}
        />
        <StatCard
          label="Est. Cost (last 100)"
          value={`$${totalCost.toFixed(4)}`}
          icon={DollarSign}
        />
      </div>

      <div>
        <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4">
          Recent LLM Operations
        </h2>
        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Operation</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Model</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Tokens</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Cost</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Status</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Time</th>
              </tr>
            </thead>
            <tbody>
              {usage.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : recentOps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No LLM calls recorded yet.
                  </td>
                </tr>
              ) : (
                recentOps.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-foreground">{r.operation}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.model}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{(r.totalTokens ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">${(r.estimatedCostUsd ?? 0).toFixed(4)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`px-1.5 py-0.5 rounded-sm ${r.status === "success" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {new Date(r.createdAt).toLocaleTimeString()}
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
