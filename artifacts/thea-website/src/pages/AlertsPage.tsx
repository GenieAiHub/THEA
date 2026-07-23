import React, { useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListAlerts, useResolveAlert, useDismissAlert, getListAlertsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Filter, ExternalLink, X } from "lucide-react";
import { alertTypeInfo, alertTitle, alertDescription, sovShiftText, sovOvertakenText } from "@/lib/alertPresentation";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type Severity = "all" | "critical" | "high" | "medium" | "low";

const severityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function AlertsPage() {
  const [showResolved, setShowResolved] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<Severity>("all");
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const { data: alertsData, isLoading } = useListAlerts<any>({
    status: showResolved ? undefined : "open",
    severity: severityFilter !== "all" ? severityFilter : undefined,
    limit: 100,
  });
  const resolveAlert = useResolveAlert();
  const dismissAlertMutation = useDismissAlert();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setResolvingId(id);
    try {
      await resolveAlert.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      toast({ title: "Alert marked as resolved" });
    } catch {
      toast({ title: "Failed to resolve alert", variant: "destructive" });
    } finally {
      setResolvingId(null);
    }
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissingId(id);
    try {
      await dismissAlertMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      toast({ title: "Alert dismissed" });
    } catch {
      toast({ title: "Failed to dismiss alert", variant: "destructive" });
    } finally {
      setDismissingId(null);
    }
  };

  const sorted = [...(alertsData?.data || [])].sort(
    (a: any, b: any) =>
      (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
  );

  const criticalCount = (alertsData?.data || []).filter((a: any) => a.severity === "critical" && a.status === "open").length;
  const highCount = (alertsData?.data || []).filter((a: any) => a.severity === "high" && a.status === "open").length;

  return (
    <DashboardLayout title="Alert Inbox">
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">

        {/* Summary bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Critical", count: criticalCount, color: "text-red-400", bg: "bg-red-500/10 border-red-900/40" },
            { label: "High", count: highCount, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-900/40" },
            { label: "Total Open", count: (alertsData?.data || []).filter((a: any) => a.status === "open").length, color: "text-slate-200", bg: "bg-slate-900 border-slate-800" },
            { label: "Resolved", count: (alertsData?.data || []).filter((a: any) => a.status === "resolved").length, color: "text-slate-400", bg: "bg-slate-900 border-slate-800" },
          ].map((s, i) => (
            <div key={i} className={`p-3 rounded-lg border ${s.bg} flex items-center justify-between`}>
              <span className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</span>
              <span className={`text-xl font-display font-bold ${s.color}`}>{isLoading ? "–" : s.count}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-3 text-slate-200">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="font-medium">Incident Response</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <Select value={severityFilter} onValueChange={(v: Severity) => setSeverityFilter(v)}>
                <SelectTrigger className="h-8 w-36 bg-slate-950 border-slate-700 text-slate-300 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-resolved"
                checked={showResolved}
                onCheckedChange={setShowResolved}
                className="data-[state=checked]:bg-blue-600"
              />
              <Label htmlFor="show-resolved" className="text-slate-400 cursor-pointer text-sm">Show Resolved</Label>
            </div>
          </div>
        </div>

        {/* Alert list */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full bg-slate-900 rounded-xl" />
            ))
          ) : sorted.length > 0 ? (
            sorted.map((alert: any) => {
              const isExpanded = expandedAlert === alert.id;
              return (
                <div
                  key={alert.id}
                  className={`bg-slate-900 border ${
                    alert.status === "open" && (alert.severity === "critical" || alert.severity === "high")
                      ? "border-red-900/50"
                      : alert.status === "open"
                      ? "border-slate-700"
                      : "border-slate-800"
                  } rounded-xl overflow-hidden transition-all cursor-pointer`}
                  onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                >
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Badge className={`shrink-0 ${severityColors[alert.severity] || severityColors.low}`}>
                        {alert.severity?.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className={`shrink-0 hidden sm:inline-flex items-center gap-1 ${alertTypeInfo(alert).badgeClass}`}>
                        {alertTypeInfo(alert).icon}
                        {alertTypeInfo(alert).label}
                      </Badge>
                      <div className="flex flex-col min-w-0">
                        <span className={`font-medium truncate ${alert.status === "resolved" ? "text-slate-400" : "text-slate-200"}`}>
                          {alertTitle(alert)}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          {new Date(alert.createdAt).toLocaleString()}
                          {sovShiftText(alert) && (
                            <span className="text-purple-400 font-medium">{sovShiftText(alert)}</span>
                          )}
                          {sovOvertakenText(alert) && (
                            <span className="text-red-400 font-medium">{sovOvertakenText(alert)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/alerts/${alert.id}`} onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-500 hover:text-blue-400 hover:bg-blue-500/10"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          <span className="hidden sm:inline">Detail</span>
                        </Button>
                      </Link>
                      {alert.status === "open" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-700 text-slate-300 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/50"
                            onClick={(e) => handleResolve(alert.id, e)}
                            disabled={resolvingId === alert.id}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-500 hover:text-amber-400 hover:bg-amber-500/10"
                            onClick={(e) => handleDismiss(alert.id, e)}
                            disabled={dismissingId === alert.id}
                            title="Dismiss alert"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className={alert.status === "dismissed" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-slate-800 text-slate-400 border-slate-700"}>
                          {alert.status === "dismissed" ? "Dismissed" : "Resolved"}
                        </Badge>
                      )}
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-slate-500" />
                        : <ChevronDown className="w-5 h-5 text-slate-500" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-slate-800 bg-slate-950 text-slate-300 text-sm">
                      <p className="leading-relaxed mb-4">
                        {alertDescription(alert)}
                      </p>
                      {alert.category && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-slate-500">Category:</span>
                          <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-xs">{alert.category}</Badge>
                        </div>
                      )}
                      {alert.context && (
                        <div className="p-3 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-400 overflow-auto max-h-40">
                          {JSON.stringify(alert.context, null, 2)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
              No alerts found matching current filters.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
