import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListAlerts, useResolveAlert, getListAlertsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AlertsPage() {
  const [showResolved, setShowResolved] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  
  const { data: alertsData, isLoading } = useListAlerts<any>({ status: showResolved ? undefined : "open", limit: 50 });
  const resolveAlert = useResolveAlert();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await resolveAlert.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      toast({ title: "Alert marked as resolved" });
    } catch (err) {
      toast({ title: "Failed to resolve alert", variant: "destructive" });
    }
  };

  const severityColors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-400 border-red-500/20",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20"
  };

  return (
    <DashboardLayout title="Alert Inbox">
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-3 text-slate-200">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="font-medium">Incident Response</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              id="show-resolved" 
              checked={showResolved} 
              onCheckedChange={setShowResolved} 
              className="data-[state=checked]:bg-blue-600"
            />
            <Label htmlFor="show-resolved" className="text-slate-400 cursor-pointer">Show Resolved</Label>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full bg-slate-900 rounded-xl" />
            ))
          ) : alertsData?.data?.length ? (
            alertsData.data.map((alert: any) => {
              const isExpanded = expandedAlert === alert.id;
              return (
                <div 
                  key={alert.id} 
                  className={`bg-slate-900 border ${alert.status === 'open' ? 'border-slate-700' : 'border-slate-800'} rounded-xl overflow-hidden transition-all cursor-pointer`}
                  onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                >
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <Badge className={severityColors[alert.severity] || severityColors.low}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <div className="flex flex-col">
                        <span className={`font-medium ${alert.status === 'resolved' ? 'text-slate-400' : 'text-slate-200'}`}>
                          {alert.title}
                        </span>
                        <span className="text-xs text-slate-500">{new Date(alert.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {alert.status === 'open' ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-slate-700 text-slate-300 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/50"
                          onClick={(e) => handleResolve(alert.id, e)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          Resolve
                        </Button>
                      ) : (
                        <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700">Resolved</Badge>
                      )}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-4 border-t border-slate-800 bg-slate-950 text-slate-300 text-sm">
                      <p className="leading-relaxed mb-4">{alert.message || alert.description || "No detailed description provided."}</p>
                      {alert.context && (
                        <div className="p-3 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-slate-400">
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