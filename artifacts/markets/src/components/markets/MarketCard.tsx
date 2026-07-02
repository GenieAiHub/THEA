import { Market } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { BarChart3, Clock, CheckCircle2, TrendingUp } from "lucide-react";

interface MarketCardProps {
  market: Market;
  votedOptionIndex?: number;
  onVote?: (marketId: string, optionIndex: number) => void;
  isVoting?: boolean;
}

export function MarketCard({ market, votedOptionIndex, onVote, isVoting }: MarketCardProps) {
  const isResolved = market.status === "resolved";
  const isClosed = market.status === "closed" || isResolved;
  const hasVoted = votedOptionIndex !== undefined;
  const showResults = hasVoted || isClosed;

  return (
    <div className="group relative glass-panel rounded-xl overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] flex flex-col">
      <Link href={`/market/${market.id}`} className="flex-1 p-6 flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary uppercase tracking-wide">
            {market.category}
          </span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isResolved ? (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
              </span>
            ) : isClosed ? (
              <span className="flex items-center gap-1 text-yellow-500">
                <Clock className="w-3.5 h-3.5" /> Closed
              </span>
            ) : market.closesAt ? (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDistanceToNow(new Date(market.closesAt))} left
              </span>
            ) : (
              <span className="flex items-center gap-1 text-primary">
                <TrendingUp className="w-3.5 h-3.5" /> Live
              </span>
            )}
          </div>
        </div>

        <h3 className="font-display text-xl font-bold leading-tight mb-6 group-hover:text-primary transition-colors line-clamp-3">
          {market.question}
        </h3>

        <div className="mt-auto space-y-3">
          {market.options.map((opt, i) => {
            const isWinner = isResolved && market.resolvedOption === i;
            const isSelected = votedOptionIndex === i;
            
            return (
              <div 
                key={i}
                className="relative overflow-hidden rounded-lg bg-secondary/50 border border-border/50"
              >
                {showResults && (
                  <div 
                    className={`absolute inset-y-0 left-0 poll-bar-fill opacity-20 ${
                      isWinner ? "bg-green-500" : isSelected ? "bg-primary" : "bg-muted-foreground"
                    }`}
                    style={{ width: `${opt.percentage}%` }}
                  />
                )}
                
                <div className="relative px-4 py-3 flex items-center justify-between z-10">
                  <span className={`text-sm font-medium ${isWinner ? 'text-green-400' : isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {opt.label}
                    {isSelected && <span className="ml-2 text-xs opacity-75">(Your Pick)</span>}
                  </span>
                  
                  {showResults ? (
                    <span className="font-mono font-bold text-sm">
                      {Math.round(opt.percentage)}%
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (!isClosed && !hasVoted && onVote) {
                          onVote(market.id, i);
                        }
                      }}
                      disabled={isVoting || isClosed || hasVoted}
                      className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Vote
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground pt-4 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" />
            {market.totalVotes.toLocaleString()} votes
          </div>
        </div>
      </Link>
    </div>
  );
}
