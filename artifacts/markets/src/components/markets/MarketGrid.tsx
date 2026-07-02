import { Market } from "@workspace/api-client-react";
import { MarketCard } from "@/components/markets/MarketCard";
import { useVoting } from "@/hooks/use-voting";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

interface MarketGridProps {
  markets?: Market[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyText?: string;
  skeletonCount?: number;
}

export function MarketGrid({
  markets,
  isLoading,
  emptyTitle = "No markets found",
  emptyText = "Try adjusting your search or filters.",
  skeletonCount = 6,
}: MarketGridProps) {
  const { castVote, isVoting, localVotes } = useVoting();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(skeletonCount)].map((_, i) => (
          <div key={i} className="glass-panel p-6 rounded-xl space-y-4">
            <Skeleton className="h-6 w-24 rounded-full bg-primary/20" />
            <Skeleton className="h-16 w-full bg-primary/10" />
            <div className="space-y-2 mt-8">
              <Skeleton className="h-12 w-full bg-primary/5" />
              <Skeleton className="h-12 w-full bg-primary/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!markets?.length) {
    return (
      <div className="text-center py-24 glass-panel rounded-xl">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-display font-medium text-white mb-2">{emptyTitle}</h3>
        <p className="text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {markets.map((market) => (
        <MarketCard
          key={market.id}
          market={market}
          votedOptionIndex={localVotes[market.id] >= 0 ? localVotes[market.id] : undefined}
          onVote={castVote}
          isVoting={isVoting}
        />
      ))}
    </div>
  );
}
