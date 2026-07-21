import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Upload, Shuffle } from "lucide-react";
import { api, fmtUsd, type CostRow, type MediaMixResponse, type MmpLink } from "./api";

function prettyChannel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CostsTab({ links, selectedAppId, days }: { links: MmpLink[]; selectedAppId: string; days: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const appFilter = selectedAppId !== "all" ? `&appId=${selectedAppId}` : "";

  const costsQ = useQuery({
    queryKey: ["mmp", "costs", selectedAppId, days],
    queryFn: () => api<{ data: CostRow[] }>(`/costs?days=${days}${appFilter}`),
  });
  const mixQ = useQuery({
    queryKey: ["mmp", "media-mix", selectedAppId, days],
    queryFn: () => api<MediaMixResponse>(`/stats/media-mix?days=${days}${appFilter}`),
  });
  const mix = mixQ.data;

  const [entry, setEntry] = useState({ linkId: "", day: new Date().toISOString().slice(0, 10), costUsd: "" });
  const addCost = useMutation({
    mutationFn: () => api<CostRow>("/costs", {
      method: "POST",
      body: JSON.stringify({ linkId: entry.linkId, day: entry.day, costUsd: Number(entry.costUsd) }),
    }),
    onSuccess: () => {
      setEntry((s) => ({ ...s, costUsd: "" }));
      qc.invalidateQueries({ queryKey: ["mmp"] });
      toast({ title: "Spend recorded", description: "ROAS and CPI update immediately in the overview." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not record spend", description: e.message }),
  });

  const [csv, setCsv] = useState("");
  const importCsv = useMutation({
    mutationFn: () => api<{ imported: number; skipped: { line: number; reason: string }[] }>("/costs/import", {
      method: "POST",
      body: JSON.stringify({ csv }),
    }),
    onSuccess: (r) => {
      setCsv("");
      qc.invalidateQueries({ queryKey: ["mmp"] });
      toast({
        title: `Imported ${r.imported} row${r.imported === 1 ? "" : "s"}`,
        description: r.skipped.length
          ? `${r.skipped.length} skipped — first: line ${r.skipped[0].line}: ${r.skipped[0].reason}`
          : "All rows imported.",
        variant: r.imported === 0 && r.skipped.length ? "destructive" : undefined,
      });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Import failed", description: e.message }),
  });

  const rows = costsQ.data?.data ?? [];
  const costNum = Number(entry.costUsd);
  const entryValid = entry.linkId && entry.day && entry.costUsd !== "" && Number.isFinite(costNum) && costNum >= 0;

  return (
    <div className="space-y-4" data-testid="tab-costs">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" /> Record ad spend</CardTitle>
            <CardDescription>One amount per campaign link per day — re-entering the same day overwrites it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Campaign link</Label>
              <Select value={entry.linkId} onValueChange={(v) => setEntry((s) => ({ ...s, linkId: v }))}>
                <SelectTrigger data-testid="select-cost-link">
                  <SelectValue placeholder="Choose a tracking link" />
                </SelectTrigger>
                <SelectContent>
                  {links.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <div className="space-y-2 flex-1">
                <Label className="text-xs">Day</Label>
                <Input
                  type="date"
                  value={entry.day}
                  onChange={(e) => setEntry((s) => ({ ...s, day: e.target.value }))}
                  data-testid="input-cost-day"
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label className="text-xs">Spend (USD)</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={entry.costUsd}
                  onChange={(e) => setEntry((s) => ({ ...s, costUsd: e.target.value }))}
                  data-testid="input-cost-usd"
                />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => addCost.mutate()}
              disabled={!entryValid || addCost.isPending}
              data-testid="button-add-cost"
            >
              Record spend
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Bulk CSV import</CardTitle>
            <CardDescription>
              Paste rows as <code className="text-xs bg-muted px-1 rounded">day,code,cost_usd</code> — e.g.{" "}
              <code className="text-xs bg-muted px-1 rounded">2026-07-21,ab12cd34ef,120.50</code>. Header row optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={5}
              placeholder={"day,code,cost_usd\n2026-07-21,ab12cd34ef,120.50"}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              className="font-mono text-xs"
              data-testid="textarea-cost-csv"
            />
            <Button
              className="w-full" variant="outline"
              onClick={() => importCsv.mutate()}
              disabled={!csv.trim() || importCsv.isPending}
              data-testid="button-import-costs"
            >
              Import CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recorded spend</CardTitle>
        </CardHeader>
        <CardContent>
          {costsQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spend recorded in this window yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Day</th>
                    <th className="py-2 pr-4 font-medium">Campaign</th>
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium text-right">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0" data-testid={`row-cost-${r.id}`}>
                      <td className="py-2 pr-4">{r.day}</td>
                      <td className="py-2 pr-4 font-medium">{r.linkName}</td>
                      <td className="py-2 pr-4"><code className="text-xs">{r.code}</code></td>
                      <td className="py-2 pr-4 text-right">{fmtUsd(r.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-media-mix">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Shuffle className="w-4 h-4" /> Media mix — budget reallocation</CardTitle>
              <CardDescription className="mt-1">
                Where your next dollar works hardest, based on per-channel return in this window
                {mix && !mix.insufficient
                  ? ` — ${fmtUsd(mix.totalSpendUsd)} spend, ${fmtUsd(mix.totalRevenueUsd)} revenue${mix.blendedRoas != null ? `, blended ROAS ${mix.blendedRoas.toFixed(2)}` : ""}`
                  : ""}.
              </CardDescription>
            </div>
            <Badge variant="secondary">Heuristic model</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mixQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !mix || mix.insufficient ? (
            <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-media-mix-empty">
              {mix?.note ?? "Media-mix analysis needs recorded ad spend on at least 2 channels."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Channel</th>
                      <th className="py-2 pr-4 font-medium text-right">Spend</th>
                      <th className="py-2 pr-4 font-medium text-right">Revenue</th>
                      <th className="py-2 pr-4 font-medium text-right">Installs</th>
                      <th className="py-2 pr-4 font-medium text-right">ROAS</th>
                      <th className="py-2 pr-4 font-medium text-right">Marginal ROAS</th>
                      <th className="py-2 pr-4 font-medium w-56">Share: current → suggested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mix.channels.map((c) => {
                      const up = c.suggestedSharePct > c.currentSharePct + 0.5;
                      const down = c.suggestedSharePct < c.currentSharePct - 0.5;
                      return (
                        <tr key={c.channel} className="border-b last:border-0" data-testid={`row-mix-${c.channel}`}>
                          <td className="py-2 pr-4 font-medium">{prettyChannel(c.channel)}</td>
                          <td className="py-2 pr-4 text-right">{fmtUsd(c.spendUsd)}</td>
                          <td className="py-2 pr-4 text-right">{fmtUsd(c.revenueUsd)}</td>
                          <td className="py-2 pr-4 text-right">{c.installs}</td>
                          <td className="py-2 pr-4 text-right">{c.roas !== null ? c.roas.toFixed(2) : "—"}</td>
                          <td className="py-2 pr-4 text-right">{c.marginalRoas !== null ? c.marginalRoas.toFixed(2) : "—"}</td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 space-y-1">
                                <div className="h-2 bg-muted rounded overflow-hidden">
                                  <div className="h-full bg-muted-foreground/40 rounded" style={{ width: `${Math.min(100, c.currentSharePct)}%` }} />
                                </div>
                                <div className="h-2 bg-muted rounded overflow-hidden">
                                  <div className={`h-full rounded ${up ? "bg-emerald-500/70" : down ? "bg-amber-500/70" : "bg-blue-500/60"}`} style={{ width: `${Math.min(100, c.suggestedSharePct)}%` }} />
                                </div>
                              </div>
                              <span className={`text-xs whitespace-nowrap font-medium ${up ? "text-emerald-600 dark:text-emerald-400" : down ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                                {c.currentSharePct.toFixed(0)}% → {c.suggestedSharePct.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground border-t pt-3" data-testid="text-media-mix-note">{mix.note}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
