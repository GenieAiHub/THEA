import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Grid3x3, Telescope } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { api, fmtPct, fmtUsd, type LtvPoint, type PltvResponse, type RetentionRow } from "./api";

function confidenceBadge(confidence: PltvResponse["confidence"]) {
  if (confidence === "high") {
    return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" variant="outline">High confidence</Badge>;
  }
  if (confidence === "medium") {
    return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" variant="outline">Medium confidence</Badge>;
  }
  if (confidence === "low") {
    return <Badge variant="outline" className="text-muted-foreground">Low confidence</Badge>;
  }
  return null;
}

function heatClass(rate: number | null): string {
  if (rate === null) return "text-muted-foreground";
  if (rate >= 0.4) return "bg-emerald-500/30";
  if (rate >= 0.25) return "bg-emerald-500/20";
  if (rate >= 0.15) return "bg-amber-500/20";
  if (rate >= 0.05) return "bg-amber-500/10";
  return "bg-red-500/10";
}

export function CohortsTab({ selectedAppId, days }: { selectedAppId: string; days: string }) {
  const appFilter = selectedAppId !== "all" ? `&appId=${selectedAppId}` : "";

  const retentionQ = useQuery({
    queryKey: ["mmp", "retention", selectedAppId],
    queryFn: () => api<{ data: RetentionRow[] }>(`/stats/retention?weeks=8${appFilter}`),
  });
  const ltvQ = useQuery({
    queryKey: ["mmp", "cohort-ltv", selectedAppId, days],
    queryFn: () => api<{ installs: number; data: LtvPoint[] }>(`/stats/cohort-ltv?days=${days}${appFilter}`),
  });
  const pltvQ = useQuery({
    queryKey: ["mmp", "pltv", selectedAppId, days],
    queryFn: () => api<PltvResponse>(`/stats/pltv?days=${days}${appFilter}`),
  });

  const rows = retentionQ.data?.data ?? [];
  const ltv = ltvQ.data?.data ?? [];
  const pltv = pltvQ.data;

  const pltvChart = (() => {
    if (!pltv) return [];
    const pts: { day: number; observed?: number; projected?: number }[] =
      pltv.observed.map((p) => ({ day: p.day, observed: p.ltvUsd }));
    if (pts.length > 0 && pltv.projected.length > 0) {
      pts[pts.length - 1].projected = pts[pts.length - 1].observed;
    }
    for (const p of pltv.projected) pts.push({ day: p.day, projected: p.ltvUsd });
    return pts;
  })();

  const milestones = [
    { label: "Day 30", value: pltv?.milestones.d30 ?? null },
    { label: "Day 90", value: pltv?.milestones.d90 ?? null },
    { label: "Day 180", value: pltv?.milestones.d180 ?? null },
  ];

  return (
    <div className="space-y-4" data-testid="tab-cohorts">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Grid3x3 className="w-4 h-4" /> Weekly retention cohorts</CardTitle>
          <CardDescription>
            Installs grouped by week, with D1 / D7 / D30 retention measured as event activity (a device
            counts as retained if it sent any event on that day). Cohorts too young to measure show "—".
          </CardDescription>
        </CardHeader>
        <CardContent>
          {retentionQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No install cohorts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Week of</th>
                    <th className="py-2 pr-4 font-medium text-right">Installs</th>
                    <th className="py-2 pr-4 font-medium text-right">Paid</th>
                    <th className="py-2 pr-4 font-medium text-right">Organic</th>
                    <th className="py-2 pr-4 font-medium text-center">D1</th>
                    <th className="py-2 pr-4 font-medium text-center">D7</th>
                    <th className="py-2 pr-4 font-medium text-center">D30</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.week} className="border-b last:border-0" data-testid={`row-cohort-${r.week}`}>
                      <td className="py-2 pr-4 font-medium">{r.week}</td>
                      <td className="py-2 pr-4 text-right">{r.installs}</td>
                      <td className="py-2 pr-4 text-right">{r.paid}</td>
                      <td className="py-2 pr-4 text-right">{r.organic}</td>
                      {([r.d1, r.d7, r.d30] as const).map((v, i) => (
                        <td key={i} className="py-1 pr-4 text-center">
                          <span className={`inline-block min-w-14 rounded px-2 py-1 ${heatClass(v)}`}>
                            {fmtPct(v)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Cumulative LTV curve</CardTitle>
          <CardDescription>
            Average cumulative revenue per install by days since install
            {ltvQ.data ? ` (${ltvQ.data.installs} installs in window)` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          {ltvQ.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : ltv.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No revenue events yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ltv} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" fontSize={11} tickLine={false} label={{ value: "days since install", position: "insideBottom", offset: -2, fontSize: 10 }} />
                <YAxis fontSize={11} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${Number(v).toFixed(2)}`, "LTV / install"]} />
                <Line type="monotone" dataKey="ltvUsd" stroke="#8b5cf6" strokeWidth={2} dot={false} name="LTV / install" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-pltv">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Telescope className="w-4 h-4" /> Predictive LTV (180-day projection)
              </CardTitle>
              <CardDescription className="mt-1">
                Observed revenue per install extended to day 180
                {pltv ? ` — ${pltv.installs} installs in window` : ""}.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {pltv && confidenceBadge(pltv.confidence)}
              {pltv && pltv.method !== "none" && (
                <Badge variant="secondary" data-testid="badge-pltv-method">
                  {pltv.method === "log_fit" ? "Fitted from your data" : "Industry-standard curve"}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pltvQ.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !pltv || pltv.method === "none" ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {pltv?.note ?? "Not enough data to project lifetime value yet."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                {milestones.map((m) => (
                  <div key={m.label} className="border rounded-lg p-3 text-center" data-testid={`milestone-${m.label.replace(" ", "-").toLowerCase()}`}>
                    <div className="text-xs text-muted-foreground">{m.label} LTV</div>
                    <div className="text-xl font-bold mt-1">{m.value !== null ? fmtUsd(m.value) : "—"}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">projected / install</div>
                  </div>
                ))}
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pltvChart} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" type="number" domain={[0, 180]} fontSize={11} tickLine={false} label={{ value: "days since install", position: "insideBottom", offset: -2, fontSize: 10 }} />
                    <YAxis fontSize={11} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                    <Tooltip formatter={(v: number, name: string) => [`$${Number(v).toFixed(2)}`, name]} labelFormatter={(d) => `Day ${d}`} />
                    <Legend />
                    <Line type="monotone" dataKey="observed" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Observed" connectNulls />
                    <Line type="monotone" dataKey="projected" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 4" strokeOpacity={0.6} dot={false} name="Projected" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground border-t pt-3" data-testid="text-pltv-note">{pltv.note}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
