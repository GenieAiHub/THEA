import { Market } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Clock, CheckCircle2, TrendingUp, Users } from "lucide-react";

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
  const canVote = !isClosed && !hasVoted && !!onVote;

  const leaderIndex = market.options.length
    ? market.options.reduce(
        (best, opt, i, arr) => (opt.percentage > arr[best].percentage ? i : best),
        0,
      )
    : -1;

  return (
    <div className="group relative glass-panel rounded-2xl overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_25px_rgba(59,130,246,0.15)] flex flex-col">
      <Link href={`/market/${market.id}`} className="flex-1 p-5 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary uppercase tracking-wider">
            {market.category}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
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

        <h3 className="font-display text-lg font-bold leading-snug mb-5 group-hover:text-primary transition-colors line-clamp-3">
          {market.question}
        </h3>

        <div className="mt-auto space-y-2">
          {market.options.map((opt, i) => {
            const pct = opt.percentage ?? 0;
            const isWinner = isResolved && market.resolvedOption === i;
            const isSelected = votedOptionIndex === i;
            const isLeader = i === leaderIndex;

            const barColor = isWinner
              ? "bg-green-500/25"
              : isSelected
                ? "bg-primary/30"
                : isLeader
                  ? "bg-primary/20"
                  : "bg-muted-foreground/10";

            const labelColor = isWinner
              ? "text-green-400"
              : isSelected
                ? "text-primary"
                : "text-foreground";

            const rowClass = `group/opt relative w-full overflow-hidden rounded-lg border text-left transition-colors ${
              isSelected
                ? "border-primary/50"
                : isWinner
                  ? "border-green-500/40"
                  : "border-border/50"
            } ${canVote ? "hover:border-primary/50 cursor-pointer" : ""}`;

            const inner = (
              <>
                <div
                  className={`absolute inset-y-0 left-0 poll-bar-fill ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative z-10 flex items-center justify-between gap-2 px-3.5 py-2.5">
                  <span className={`text-sm font-medium truncate ${labelColor}`}>
                    {opt.label}
                    {isSelected && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide opacity-70">
                        Your pick
                      </span>
                    )}
                    {isWinner && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide opacity-80">
                        Winner
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {canVote && (
                      <span className="hidden group-hover/opt:inline text-[10px] font-bold uppercase tracking-wider text-primary">
                        Vote
                      </span>
                    )}
                    <span className="font-mono font-bold text-sm tabular-nums">
                      {Math.round(pct)}%
                    </span>
                  </span>
                </div>
              </>
            );

            return canVote ? (
              <button
                key={i}
                type="button"
                disabled={isVoting}
                onClick={(e) => {
                  e.preventDefault();
                  onVote!(market.id, i);
                }}
                className={`${rowClass} disabled:opacity-60`}
              >
                {inner}
              </button>
            ) : (
              <div key={i} className={rowClass}>
                {inner}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground pt-3.5 border-t border-border/50">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {market.totalVotes.toLocaleString()} votes
          </span>
          <span className="text-primary/70 font-medium group-hover:text-primary transition-colors">
            View market →
          </span>
        </div>
      </Link>
    </div>
  );
}
