import { useParams, Link } from "wouter";
import {
  useGetMarket,
  getGetMarketQueryKey,
  useListMarkets,
  getListMarketsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { MarketCard } from "@/components/markets/MarketCard";
import { useVoting } from "@/hooks/use-voting";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  AlertCircle,
  Info,
  Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { castVote, isVoting, localVotes } = useVoting();

  const { data: market, isLoading, isError } = useGetMarket(id!, {
    query: { enabled: !!id, queryKey: getGetMarketQueryKey(id!) },
  });

  const relatedParams = { category: market?.category, sort: "trending" as const, limit: 4 };
  const { data: relatedData } = useListMarkets(relatedParams, {
    query: {
      enabled: !!market?.category,
      queryKey: getListMarketsQueryKey(relatedParams),
    },
  });
  const related = (relatedData?.data ?? []).filter((m) => m.id !== market?.id).slice(0, 3);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied",
      description: "Market link copied to clipboard.",
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-t-2 border-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading market...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !market) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-24 glass-panel rounded-xl">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-display font-medium text-white mb-4">Market not found</h3>
            <Link href="/">
              <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Markets
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const isResolved = market.status === "resolved";
  const isClosed = market.status === "closed" || isResolved;
  const votedOptionIndex = localVotes[market.id] >= 0 ? localVotes[market.id] : undefined;
  const hasVoted = votedOptionIndex !== undefined;
  const showResults = hasVoted || isClosed;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Markets
        </Link>

        <div className="glass-panel rounded-2xl p-6 md:p-10 border border-primary/20 shadow-2xl shadow-primary/5">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Link
              href={`/category/${encodeURIComponent(market.category)}`}
              className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary uppercase tracking-wide hover:bg-primary/20 transition-colors"
            >
              {market.category}
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isResolved ? (
                <span className="flex items-center gap-1 text-green-400 bg-green-400/10 px-2 py-1 rounded-md">
                  <CheckCircle2 className="w-4 h-4" /> Resolved
                </span>
              ) : isClosed ? (
                <span className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-md">
                  <Clock className="w-4 h-4" /> Closed
                </span>
              ) : market.closesAt ? (
                <span className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-md">
                  <Clock className="w-4 h-4 text-primary" />
                  Closes in {formatDistanceToNow(new Date(market.closesAt))}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-1 rounded-md">
                  <TrendingUp className="w-4 h-4" /> Live Market
                </span>
              )}
            </div>

            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="text-muted-foreground hover:text-white border-primary/20 hover:bg-primary/20"
              >
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            </div>
          </div>

          <h1 className="text-3xl md:text-5xl font-display font-bold leading-tight mb-6 text-white">
            {market.question}
          </h1>

          {market.description && (
            <p className="text-lg text-muted-foreground mb-8 whitespace-pre-wrap">
              {market.description}
            </p>
          )}

          <div className="grid gap-4 mb-10">
            {market.options.map((opt, i) => {
              const isWinner = isResolved && market.resolvedOption === i;
              const isSelected = votedOptionIndex === i;

              return (
                <div
                  key={i}
                  className={`relative overflow-hidden rounded-xl bg-secondary/30 border transition-all duration-300 ${
                    isSelected
                      ? "border-primary shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                      : isWinner
                        ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                        : "border-border hover:border-primary/50"
                  }`}
                >
                  {showResults && (
                    <div
                      className={`absolute inset-y-0 left-0 poll-bar-fill opacity-20 ${
                        isWinner ? "bg-green-500" : isSelected ? "bg-primary" : "bg-white/20"
                      }`}
                      style={{ width: `${opt.percentage}%` }}
                    />
                  )}

                  <button
                    onClick={() => {
                      if (!isClosed && !hasVoted) {
                        castVote(market.id, i);
                      }
                    }}
                    disabled={isVoting || isClosed || hasVoted}
                    className="relative w-full px-6 py-5 flex items-center justify-between z-10 text-left disabled:cursor-default group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                          isWinner
                            ? "border-green-500 bg-green-500/20 text-green-400"
                            : isSelected
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-muted-foreground/30 text-muted-foreground group-hover:border-primary/50 group-hover:text-primary transition-colors"
                        }`}
                      >
                        {isWinner ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <span className="font-mono font-bold">{i + 1}</span>
                        )}
                      </div>
                      <span
                        className={`text-xl font-medium ${
                          isWinner
                            ? "text-green-400"
                            : isSelected
                              ? "text-primary font-bold"
                              : "text-foreground"
                        }`}
                      >
                        {opt.label}
                        {isSelected && (
                          <span className="ml-3 text-sm opacity-75 font-normal tracking-wide uppercase">
                            (Your Pick)
                          </span>
                        )}
                      </span>
                    </div>

                    {showResults ? (
                      <div className="text-right">
                        <div className="font-mono font-bold text-2xl">
                          {Math.round(opt.percentage)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {opt.votes.toLocaleString()} votes
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`px-4 py-2 rounded font-semibold uppercase tracking-wider text-sm transition-all ${
                          isVoting
                            ? "opacity-0"
                            : "bg-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                        }`}
                      >
                        Vote
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-border/50 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="font-mono text-white text-base">
                {market.totalVotes.toLocaleString()}
              </span>{" "}
              Total Votes
            </div>

            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              Source: {market.source === "auto" ? "AI Generated" : "Manual"}
            </div>

            {market.createdAt && (
              <div className="flex items-center gap-2 text-xs opacity-75 ml-auto">
                Created {format(new Date(market.createdAt), "MMM d, yyyy")}
              </div>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-bold text-2xl text-white">Related markets</h2>
              <Link
                href={`/category/${encodeURIComponent(market.category)}`}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((m) => (
                <MarketCard
                  key={m.id}
                  market={m}
                  votedOptionIndex={localVotes[m.id] >= 0 ? localVotes[m.id] : undefined}
                  onVote={castVote}
                  isVoting={isVoting}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
