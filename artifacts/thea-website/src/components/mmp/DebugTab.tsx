import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bug } from "lucide-react";
import { api, type DebugRow } from "./api";

export function DebugTab({ selectedAppId }: { selectedAppId: string }) {
  const debugQ = useQuery({
    queryKey: ["mmp", "debug", selectedAppId],
    queryFn: () => api<{ data: DebugRow[] }>(`/debug/recent${selectedAppId !== "all" ? `?appId=${selectedAppId}` : ""}`),
    refetchInterval: 5000,
  });

  const rows = debugQ.data?.data ?? [];

  return (
    <Card data-testid="tab-debug">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bug className="w-4 h-4" /> SDK debugger — live ingest inspector
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </CardTitle>
        <CardDescription>
          Last 50 ingest hits (installs, events, uninstalls) including rejected payloads with the rejection
          reason. Refreshes every 5 seconds — send a test ping and watch it appear.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {debugQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ingest activity yet. Send a test install or event from the integration guide on the Overview tab.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Kind</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Reason</th>
                  <th className="py-2 font-medium">Payload</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top" data-testid={`row-debug-${r.id}`}>
                    <td className="py-2 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-4"><Badge variant="outline" className="capitalize">{r.kind}</Badge></td>
                    <td className="py-2 pr-4">
                      <Badge variant={r.status === "ok" ? "secondary" : "destructive"}>{r.status}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground max-w-52">
                      {r.reason ?? "—"}
                    </td>
                    <td className="py-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded block max-w-md truncate">
                        {r.payload ?? "—"}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
