import React from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListTrends, useListCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Link } from "wouter";

export default function TrendsPage() {
  const { data: trendsData, isLoading: loadingTrends } = useListTrends({ limit: 50 });
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredTrends = trendsData?.data?.filter((trend: any) => 
    trend.topic?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    trend.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout title="Trend Explorer">
      <div className="flex flex-col gap-6">
        
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-slate-100">Global Trends</h1>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input 
              placeholder="Search topics or categories..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingTrends ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full bg-slate-900 rounded-xl" />
            ))
          ) : filteredTrends && filteredTrends.length > 0 ? (
            filteredTrends.map((trend: any) => (
              <Link key={trend.id} href={`/trends/${encodeURIComponent(trend.topic)}`}>
                <div className="group p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/80 transition-all cursor-pointer flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-slate-100 text-lg leading-tight group-hover:text-blue-400 transition-colors">
                      {trend.topic}
                    </h3>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-transparent shrink-0">
                      {trend.score.toFixed(0)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-auto">
                    <span className="text-xs text-slate-500">{trend.category}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                    <span className="text-xs text-slate-500">{trend.mentionCount || 0} mentions</span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-20 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
              No trends found matching "{searchQuery}"
            </div>
          )}
        </div>
        
      </div>
    </DashboardLayout>
  );
}