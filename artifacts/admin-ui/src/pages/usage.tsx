import { useAdminUsage } from "@/hooks/use-admin";
import { Cpu, DollarSign } from "lucide-react";

export default function UsagePage() {
  const { data, isLoading } = useAdminUsage();
  const rows: any[] = data ?? [];

  const totalTokens = rows.reduce((s: number, r: any) => s + (r.totalTokens ?? 0), 0);
  const totalCost = rows.reduce((s: number, r: any) => s + (r.estimatedCostUsd ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-mono font-bold text-foreground">LLM Usage Logs</h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">Last 100 API calls</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border bg-card rounded-sm p-5 flex items-center gap-4">
          <div className="p-2 bg-primary/10 rounded-sm">
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-mono font-bold">{totalTokens.toLocaleString()}</div>
            <div className="text-xs font-mono text-muted-foreground">Total Tokens</div>
          </div>
        </div>
        <div className="border border-border bg-card rounded-sm p-5 flex items-center gap-4">
          <div className="p-2 bg-primary/10 rounded-sm">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-mono font-bold">${totalCost.toFixed(4)}</div>
            <div className="text-xs font-mono text-muted-foreground">Estimated Cost</div>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Operation</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Model</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Prompt</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Completion</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Total</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Cost</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Status</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No LLM usage recorded yet.
                </td>
              </tr>
            ) : (
              rows.map((r: any) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-foreground">{r.operation}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.model}</td>
                  <td className="px-4 py-2.5 text-right">{(r.promptTokens ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">{(r.completionTokens ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                    {(r.totalTokens ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-foreground">
                    ${(r.estimatedCostUsd ?? 0).toFixed(5)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`px-1.5 py-0.5 rounded-sm ${r.status === "success" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString()}
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
