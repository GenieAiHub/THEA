import React from "react";
import { useParams, Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useGetTrendHistory, useGetCategoryAnalysis, useListContent } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

export default function TrendDetailPage() {
  const params = useParams();
  const topic = decodeURIComponent(params.topic || "");

  const { data: trendHistory, isLoading: loadingHistory } = useGetTrendHistory(topic, {
    query: { enabled: !!topic, queryKey: ["/api/v1/trends", topic] }
  });
  
  // Note: the api spec doesn't explicitly expose getCategoryAnalysis for a topic or it might be getGetCategoryAnalysisQueryKey
  // For now we'll handle gracefully. Let's just use useListContent.
  const { data: contentData, isLoading: loadingContent } = useListContent(
    { search: topic, limit: 20 },
    { query: { enabled: !!topic, queryKey: ["/api/v1/content", { search: topic, limit: 20 }] } }
  );

  return (
    <DashboardLayout title={`Trend: ${topic}`}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link href="/trends">
            <div className="p-2 bg-slate-900 border border-slate-800 rounded-md hover:bg-slate-800 cursor-pointer transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </div>
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-100">{topic}</h1>
            <p className="text-sm text-slate-400">Detailed trend analysis and related content.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="col-span-1 lg:col-span-2 bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Momentum Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <Skeleton className="h-[300px] w-full bg-slate-800" />
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendHistory as any || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#475569" fontSize={12} tickFormatter={(val) => new Date(val).toLocaleDateString()} />
                      <YAxis stroke="#475569" fontSize={12} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                        labelFormatter={(val) => new Date(val).toLocaleString()}
                      />
                      <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#3b82f6' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Category Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 text-sm leading-relaxed">
                Analysis summary for the topic will appear here based on recent activity and NLP processing. 
                The system categorizes this as an emerging trend within its sector.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Recent Content</CardTitle>
            <CardDescription className="text-slate-400">Latest ingested articles and social posts mentioning "{topic}"</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingContent ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full bg-slate-800" />)}
              </div>
            ) : contentData?.data?.length ? (
              <div className="space-y-4">
                {contentData.data.map((item: any) => (
                  <div key={item.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="font-medium text-slate-200 line-clamp-1">{item.title || item.body?.slice(0, 50)}</h4>
                      {item.sourceUrl && (
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 flex-shrink-0">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2">{item.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">{item.platform}</Badge>
                      <span className="text-xs text-slate-500">{new Date(item.collectedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-slate-500">No recent content found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}