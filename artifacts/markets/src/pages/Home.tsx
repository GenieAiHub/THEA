import { useState, useEffect } from "react";
import { useSearch, Link } from "wouter";
import {
  useListMarkets,
  useGetMarketStats,
  getListMarketsQueryKey,
  getGetMarketStatsQueryKey,
  ListMarketsSort,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { CategoryChips } from "@/components/markets/CategoryChips";
import { MarketGrid } from "@/components/markets/MarketGrid";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Flame } from "lucide-react";

export default function Home() {
  const searchStr = useSearch();
  const urlSearch = new URLSearchParams(searchStr).get("search") ?? "";

  const [search, setSearch] = useState(urlSearch);
  const [sort, setSort] = useState<ListMarketsSort>("trending");

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  const { data: stats } = useGetMarketStats({
    query: { queryKey: getGetMarketStatsQueryKey() },
  });

  const listParams = {
    search: search || undefined,
    sort,
  };

  const { data: marketsData, isLoading } = useListMarkets(listParams, {
    query: { queryKey: getListMarketsQueryKey(listParams) },
  });

  const statCards = [
    { label: "Live Markets", value: stats?.openMarkets },
    { label: "Total Votes", value: stats?.totalVotes },
    { label: "Total Markets", value: stats?.totalMarkets },
    { label: "Categories", value: stats?.categories },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-10">
          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-4">
            Predict what happens <span className="text-primary glow-text">next</span>.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mb-8">
            Live prediction markets on politics, crypto, sports and the news cycle — surfaced by
            THEA's AI trend scanning. Back your read, watch the odds move in real time, and{" "}
            <Link href="/how-it-works" className="text-primary hover:underline">
              see how it works
            </Link>
            .
          </p>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statCards.map((s) => (
                <div key={s.label} className="glass-panel p-4 rounded-xl">
                  <div className="text-sm text-muted-foreground mb-1">{s.label}</div>
                  <div className="text-2xl font-mono font-bold text-white">
                    {(s.value ?? 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </header>

        <section className="mb-6">
          <CategoryChips />
        </section>

        <section className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/30 border-primary/20 focus-visible:ring-primary"
            />
          </div>
          <Select value={sort} onValueChange={(val: any) => setSort(val)}>
            <SelectTrigger className="w-full md:w-[180px] bg-secondary/30 border-primary/20">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4" />
                <SelectValue placeholder="Sort by" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trending">Trending</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="closing">Closing Soon</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <MarketGrid markets={marketsData?.data} isLoading={isLoading} />
      </div>
    </Layout>
  );
}
