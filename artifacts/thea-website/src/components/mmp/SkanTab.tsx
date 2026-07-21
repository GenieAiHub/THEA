import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Apple, BarChart3 } from "lucide-react";
import { api, type MmpApp, type SkanPostbackRow } from "./api";

interface SkanResponse {
  count: number;
  data: SkanPostbackRow[];
  byConversionValue: { conversionValue: number | null; n: number }[];
}

export function SkanTab({ apps, selectedAppId }: { apps: MmpApp[]; selectedAppId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const appId = selectedAppId !== "all" ? selectedAppId : apps[0]?.id;
  const app = apps.find((a) => a.id === appId);

  const [appleId, setAppleId] = useState<string | null>(null);
  const appleIdValue = appleId ?? app?.appleAppId ?? "";

  const postbacksQ = useQuery({
    queryKey: ["mmp", "skan", appId],
    queryFn: () => api<SkanResponse>(`/skan/postbacks?appId=${appId}`),
    enabled: Boolean(appId),
  });

  const saveAppleId = useMutation({
    mutationFn: () =>
      api<MmpApp>(`/apps/${appId}`, {
        method: "PATCH",
        body: JSON.stringify({ appleAppId: appleIdValue.trim() || null }),
      }),
    onSuccess: () => {
      setAppleId(null);
      qc.invalidateQueries({ queryKey: ["mmp"] });
      toast({ title: "Apple App ID saved", description: "Incoming SKAdNetwork postbacks will now match this app." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  if (!appId) {
    return (
      <Card data-testid="tab-skan">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Register an iOS app first — SKAdNetwork postbacks are matched per app.
        </CardContent>
      </Card>
    );
  }

  const skan = postbacksQ.data;
  const rows = skan?.data ?? [];
  const histogram = (skan?.byConversionValue ?? []).filter((b) => b.conversionValue !== null);
  const maxN = Math.max(1, ...histogram.map((b) => b.n));
  const endpointHost = window.location.origin;

  return (
    <div className="space-y-4" data-testid="tab-skan">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Apple className="w-4 h-4" /> SKAdNetwork setup — {app?.name}</CardTitle>
            <CardDescription>
              Apple sends privacy-preserving install postbacks directly from devices. Point your iOS app
              here and THEA will collect them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Apple App ID (numeric, from App Store Connect)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. 1234567890"
                  value={appleIdValue}
                  onChange={(e) => setAppleId(e.target.value)}
                  data-testid="input-apple-app-id"
                />
                <Button
                  onClick={() => saveAppleId.mutate()}
                  disabled={saveAppleId.isPending || appleId === null || (app?.appleAppId ?? "") === appleIdValue.trim()}
                  data-testid="button-save-apple-app-id"
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Postbacks carry only the numeric App Store ID — without it THEA cannot match them to this app.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Add to your app's Info.plist</Label>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto" data-testid="text-skan-plist">
{`<key>NSAdvertisingAttributionReportEndpoint</key>
<string>${endpointHost}</string>`}
              </pre>
              <p className="text-xs text-muted-foreground">
                Apple will then POST winning (and non-winning) postbacks to{" "}
                <code className="bg-muted px-1 rounded">{endpointHost}/.well-known/skadnetwork/report</code>{" "}
                24–144 hours after install. Use your production domain here — the snippet shows the
                domain you are viewing this page on.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Conversion values</CardTitle>
            <CardDescription>
              Distribution of fine conversion values (0–63) across received postbacks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {postbacksQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : histogram.length === 0 ? (
              <p className="text-sm text-muted-foreground">No postbacks with a fine conversion value yet.</p>
            ) : (
              <div className="space-y-1.5" data-testid="chart-skan-histogram">
                {histogram.map((b) => (
                  <div key={String(b.conversionValue)} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-right font-mono text-muted-foreground">{b.conversionValue}</span>
                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500/70 rounded"
                        style={{ width: `${Math.max(4, (b.n / maxN) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 font-mono">{b.n}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Received postbacks {skan ? `(${skan.count})` : ""}</CardTitle>
              <CardDescription className="mt-1">
                Raw SKAdNetwork postbacks as sent by devices. Apple's cryptographic signature is{" "}
                <span className="font-medium">not verified</span> — treat counts as directional.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40" data-testid="badge-skan-unverified">
              Signature unverified
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {postbacksQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No postbacks yet. They arrive automatically once your app ships with the endpoint configured
              and real installs occur via SKAdNetwork campaigns.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Received</th>
                    <th className="py-2 pr-4 font-medium">Ad network</th>
                    <th className="py-2 pr-4 font-medium">Transaction</th>
                    <th className="py-2 pr-4 font-medium text-right">Seq</th>
                    <th className="py-2 pr-4 font-medium text-right">Fine CV</th>
                    <th className="py-2 pr-4 font-medium">Coarse</th>
                    <th className="py-2 pr-4 font-medium">Won</th>
                    <th className="py-2 pr-4 font-medium">Source ID</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0" data-testid={`row-skan-${r.id}`}>
                      <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-4"><code className="text-xs">{r.adNetworkId ?? "—"}</code></td>
                      <td className="py-2 pr-4"><code className="text-xs">{r.transactionId.slice(0, 12)}…</code></td>
                      <td className="py-2 pr-4 text-right">{r.postbackSequenceIndex ?? "—"}</td>
                      <td className="py-2 pr-4 text-right font-medium">{r.conversionValue ?? "—"}</td>
                      <td className="py-2 pr-4 capitalize">{r.coarseConversionValue ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {r.didWin === null ? "—" : r.didWin
                          ? <Badge variant="secondary">won</Badge>
                          : <Badge variant="outline">lost</Badge>}
                      </td>
                      <td className="py-2 pr-4">{r.sourceIdentifier ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
