import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListTrends, useListCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Link, useSearch } from "wouter";

type Timeframe = "24h" | "7d" | "30d";

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

const lifecycleColor: Record<string, string> = {
  emerging: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  peaking: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  declining: "bg-slate-500/10 text-slate-400 border-slate-700",
};

export default function TrendsPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialCategory = params.get("category") || "all";

  const [timeframe, setTimeframe] = useState<Timeframe>("24h");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  const { data: trendsData, isLoading: loadingTrends } = useListTrends<any>({ limit: 100, timeframe });
  const { data: categoriesData } = useListCategories<any>();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const cat = p.get("category");
    if (cat) setSelectedCategory(cat);
  }, []);

  const filteredTrends = (trendsData?.data || []).filter((trend: any) => {
    const matchesSearch =
      !searchQuery ||
      trend.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trend.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || trend.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", ...(categoriesData?.data || [])];

  return (
    <DashboardLayout title="Trend Explorer">
      <div className="flex flex-col gap-6">

        {/* Controls row */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1">
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf.value}
                variant="ghost"
                size="sm"
                onClick={() => setTimeframe(tf.value)}
                className={`h-8 px-4 text-sm ${
                  timeframe === tf.value
                    ? "bg-blue-600 text-white hover:bg-blue-500"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {tf.label}
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2">
          {loadingTrends
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 bg-slate-900 rounded-full" />
              ))
            : categories.slice(0, 12).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200"
                  }`}
                >
                  {cat === "all" ? "All Categories" : cat}
                </button>
              ))}
        </div>

        {/* Results count */}
        <p className="text-sm text-slate-500">
          {loadingTrends ? "Loading..." : `${filteredTrends.length} trends found`}
        </p>

        {/* Trends grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingTrends ? (
            Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full bg-slate-900 rounded-xl" />
            ))
          ) : filteredTrends.length > 0 ? (
            filteredTrends.map((trend: any) => {
              const lifecycle = trend.lifecycleStage?.toLowerCase() || "emerging";
              const ScoreIcon =
                lifecycle === "emerging"
                  ? TrendingUp
                  : lifecycle === "declining"
                  ? TrendingDown
                  : Minus;
              const scoreColor =
                lifecycle === "emerging"
                  ? "text-emerald-400"
                  : lifecycle === "declining"
                  ? "text-red-400"
                  : "text-slate-400";
              return (
                <Link key={trend.id} href={`/trends/${encodeURIComponent(trend.topic)}`}>
                  <div className="group p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/80 transition-all cursor-pointer flex flex-col gap-3 h-full">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-semibold text-slate-100 text-base leading-tight group-hover:text-blue-400 transition-colors">
                        {trend.topic}
                      </h3>
                      <div className={`flex items-center gap-1 shrink-0 ${scoreColor}`}>
                        <ScoreIcon className="w-3.5 h-3.5" />
                        <span className="text-sm font-mono font-bold">{trend.score?.toFixed(0)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 text-xs">
                        {trend.category}
                      </Badge>
                      {trend.lifecycleStage && (
                        <Badge className={`text-xs ${lifecycleColor[lifecycle] || lifecycleColor.emerging}`}>
                          {trend.lifecycleStage}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-auto pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                      <span>{trend.mentionCount || 0} mentions</span>
                      {trend.sentimentAvg != null && (
                        <span className={trend.sentimentAvg > 0 ? "text-emerald-400" : trend.sentimentAvg < 0 ? "text-red-400" : ""}>
                          {trend.sentimentAvg > 0 ? "+" : ""}
                          {trend.sentimentAvg.toFixed(2)} sentiment
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="col-span-full py-20 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
              {searchQuery ? `No trends found matching "${searchQuery}"` : "No trends found for the selected filters."}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
