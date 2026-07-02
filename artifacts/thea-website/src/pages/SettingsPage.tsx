import React from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useListCrawlerSources, useListWebhooks, useListCollectionRuns } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { data: sources, isLoading: loadingSources } = useListCrawlerSources<any>();
  const { data: webhooks, isLoading: loadingWebhooks } = useListWebhooks<any>();
  const { data: runs, isLoading: loadingRuns } = useListCollectionRuns<any>({ limit: 20 });

  return (
    <DashboardLayout title="Platform Settings">
      <div className="max-w-5xl mx-auto">
        <Tabs defaultValue="sources" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 mb-8 h-12 inline-flex">
            <TabsTrigger value="sources" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-8">
              Data Sources
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-8">
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-8">
              Collection History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Ingestion Sources</CardTitle>
                <CardDescription className="text-slate-400">Manage external APIs, RSS feeds, and scrapers.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSources ? (
                  <div className="space-y-4">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full bg-slate-800 rounded-lg" />)}
                  </div>
                ) : sources?.data?.length ? (
                  <div className="space-y-4">
                    {sources.data.map((src: any) => (
                      <div key={src.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-slate-200">{src.name}</p>
                          <p className="text-sm text-slate-500 font-mono mt-1">{src.url}</p>
                        </div>
                        <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">{src.type}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500">No active sources configured.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Webhook Endpoints</CardTitle>
                <CardDescription className="text-slate-400">Route alerts and intelligence out to your own systems.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingWebhooks ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full bg-slate-800 rounded-lg" />
                  </div>
                ) : webhooks?.data?.length ? (
                  <div className="space-y-4">
                    {webhooks.data.map((wh: any) => (
                      <div key={wh.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                        <p className="font-medium text-slate-200 font-mono text-sm">{wh.url}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500">No webhooks configured.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Collection Runs</CardTitle>
                <CardDescription className="text-slate-400">Recent ingestion pipeline jobs.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRuns ? (
                  <div className="space-y-4">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full bg-slate-800 rounded-lg" />)}
                  </div>
                ) : runs?.data?.length ? (
                  <div className="space-y-2">
                    {runs.data.map((run: any) => (
                      <div key={run.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center text-sm">
                        <span className="text-slate-300 font-mono">{run.sourceType || "System"}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400">{run.itemsCollected} items</span>
                          <span className={`${run.status === 'completed' ? 'text-emerald-400' : 'text-slate-400'}`}>{run.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500">No recent run history.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}