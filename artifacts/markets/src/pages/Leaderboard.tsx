import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListMarkets,
  getListMarketsQueryKey,
  Market,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, BarChart3, TrendingUp } from "lucide-react";

function leadingOption(market: Market) {
  if (!market.options.length) return null;
  return market.options.reduce((best, opt) => (opt.percentage > best.percentage ? opt : best));
}

export default function Leaderboard() {
  const listParams = { sort: "trending" as const, limit: 100 };
  const { data: marketsData, isLoading } = useListMarkets(listParams, {
    query: { queryKey: getListMarketsQueryKey(listParams) },
  });

  const ranked = useMemo(() => {
    const items = marketsData?.data ?? [];
    return [...items].sort((a, b) => b.totalVotes - a.totalVotes);
  }, [marketsData]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
              Leaderboard
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">
            The most-voted markets on THEA, ranked by total engagement. Where the crowd is loudest.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl bg-primary/5" />
            ))}
          </div>
        ) : ranked.length === 0 ? (
          <div className="text-center py-24 glass-panel rounded-xl">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-display font-medium text-white mb-2">No markets yet</h3>
            <p className="text-muted-foreground">The leaderboard fills up as votes come in.</p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-border/50">
            {ranked.map((market, i) => {
              const lead = leadingOption(market);
              const rank = i + 1;
              const isTop = rank <= 3;
              return (
                <Link
                  key={market.id}
                  href={`/market/${market.id}`}
                  className="flex items-center gap-4 px-4 md:px-6 py-4 hover:bg-secondary/30 transition-colors group"
                >
                  <div
                    className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold ${
                      isTop
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    {rank}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                        {market.category}
                      </span>
                    </div>
                    <h3 className="font-display font-semibold text-white truncate group-hover:text-primary transition-colors">
                      {market.question}
                    </h3>
                    {lead && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        Leading: <span className="text-foreground">{lead.label}</span>{" "}
                        <span className="font-mono">({Math.round(lead.percentage)}%)</span>
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1.5 justify-end text-white font-mono font-bold">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      {market.totalVotes.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">votes</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
