import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Users } from "lucide-react";
import { api, fmtPct, fmtUsd, type Creator, type CreatorStats, type MmpApp } from "./api";

const PLATFORMS = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "twitch", label: "Twitch" },
  { value: "other", label: "Other" },
];

export function CreatorsTab({ apps, selectedAppId, days }: { apps: MmpApp[]; selectedAppId: string; days: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const appFilter = selectedAppId !== "all" ? `&appId=${selectedAppId}` : "";

  const creatorsQ = useQuery({
    queryKey: ["mmp", "creators", selectedAppId],
    queryFn: () => api<{ data: Creator[] }>(`/creators${selectedAppId !== "all" ? `?appId=${selectedAppId}` : ""}`),
  });
  const statsQ = useQuery({
    queryKey: ["mmp", "creators-stats", selectedAppId, days],
    queryFn: () => api<{ data: CreatorStats[] }>(`/creators/stats?days=${days}${appFilter}`),
  });

  const [form, setForm] = useState({ appId: "", name: "", platform: "youtube", handle: "" });
  const createCreator = useMutation({
    mutationFn: () => api<Creator>("/creators", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm((s) => ({ ...s, name: "", handle: "" }));
      qc.invalidateQueries({ queryKey: ["mmp"] });
      toast({ title: "Creator added", description: "Assign them to tracking links to start attributing installs." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Could not add creator", description: e.message }),
  });
  const deleteCreator = useMutation({
    mutationFn: (id: string) => api<{ deleted: boolean }>(`/creators/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mmp"] }),
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const stats = statsQ.data?.data ?? [];
  const creators = creatorsQ.data?.data ?? [];

  return (
    <div className="space-y-4" data-testid="tab-creators">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Creators</CardTitle>
          <CardDescription>
            Track influencer and creator campaigns. Add a creator, then assign them when creating a tracking
            link — installs, retention and revenue roll up per creator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={form.appId} onValueChange={(v) => setForm((s) => ({ ...s, appId: v }))}>
              <SelectTrigger className="w-40" data-testid="select-creator-app">
                <SelectValue placeholder="App" />
              </SelectTrigger>
              <SelectContent>
                {apps.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              className="w-44"
              placeholder="Creator name"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              data-testid="input-creator-name"
            />
            <Select value={form.platform} onValueChange={(v) => setForm((s) => ({ ...s, platform: v }))}>
              <SelectTrigger className="w-36" data-testid="select-creator-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              className="w-40"
              placeholder="@handle (optional)"
              value={form.handle}
              onChange={(e) => setForm((s) => ({ ...s, handle: e.target.value }))}
              data-testid="input-creator-handle"
            />
            <Button
              onClick={() => createCreator.mutate()}
              disabled={!form.appId || !form.name.trim() || createCreator.isPending}
              data-testid="button-create-creator"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {statsQ.isLoading || creatorsQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No creators yet — add your first creator above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Creator</th>
                    <th className="py-2 pr-4 font-medium">Platform</th>
                    <th className="py-2 pr-4 font-medium text-right">Clicks</th>
                    <th className="py-2 pr-4 font-medium text-right">Installs</th>
                    <th className="py-2 pr-4 font-medium text-right">Uninstalls</th>
                    <th className="py-2 pr-4 font-medium text-right" title="Share of mature installs active on day 1 (event activity)">D1</th>
                    <th className="py-2 pr-4 font-medium text-right" title="Share of mature installs active on day 7 (event activity)">D7</th>
                    <th className="py-2 pr-4 font-medium text-right">Revenue</th>
                    <th className="py-2 pr-4 font-medium text-right">LTV / install</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {stats.map((row) => (
                    <tr key={row.creatorId} className="border-b last:border-0" data-testid={`row-creator-${row.creatorId}`}>
                      <td className="py-2 pr-4 font-medium">
                        {row.name}
                        {row.handle && <span className="text-muted-foreground font-normal ml-1">{row.handle}</span>}
                      </td>
                      <td className="py-2 pr-4"><Badge variant="secondary" className="capitalize">{row.platform}</Badge></td>
                      <td className="py-2 pr-4 text-right">{row.clicks}</td>
                      <td className="py-2 pr-4 text-right">{row.installs}</td>
                      <td className="py-2 pr-4 text-right">{row.uninstalls}</td>
                      <td className="py-2 pr-4 text-right">{fmtPct(row.d1Retention)}</td>
                      <td className="py-2 pr-4 text-right">{fmtPct(row.d7Retention)}</td>
                      <td className="py-2 pr-4 text-right">{fmtUsd(row.revenueUsd)}</td>
                      <td className="py-2 pr-4 text-right">{fmtUsd(row.ltvUsd)}</td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          title="Delete creator"
                          onClick={() => {
                            const c = creators.find((x) => x.id === row.creatorId);
                            if (window.confirm(`Delete creator "${row.name}"? Their links stay but lose the creator tag.`)) {
                              deleteCreator.mutate(c?.id ?? row.creatorId);
                            }
                          }}
                          data-testid={`button-delete-creator-${row.creatorId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-2">
                Retention is measured as event activity (any event on that day counts as active) and only
                includes installs old enough to measure — young cohorts show "—" instead of a misleading 0%.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
