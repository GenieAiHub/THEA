import { useState, useCallback, useRef } from "react";
import { useVoteOnMarket, getListMarketsQueryKey, getGetMarketQueryKey, getGetMarketStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getVoterId, recordVoteLocally, hasVotedOn } from "@/lib/voter-id";

export function useVoting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const voteMutation = useVoteOnMarket();
  const voterId = getVoterId();
  const [localVotes, setLocalVotes] = useState<Record<string, number>>({});

  // Sync initial state
  const isInitialized = useRef(false);
  if (!isInitialized.current) {
    const votesStr = localStorage.getItem("thea_markets_votes");
    if (votesStr) {
      try {
        const parsed = JSON.parse(votesStr);
        setLocalVotes(parsed);
      } catch (e) {
        // ignore
      }
    }
    isInitialized.current = true;
  }

  const castVote = useCallback((marketId: string, optionIndex: number) => {
    if (localVotes[marketId] !== undefined) {
      return; // already voted locally
    }

    voteMutation.mutate(
      { id: marketId, data: { optionIndex, voterId } },
      {
        onSuccess: (updatedMarket) => {
          recordVoteLocally(marketId, optionIndex);
          setLocalVotes(prev => ({ ...prev, [marketId]: optionIndex }));
          
          toast({
            title: "Vote cast successfully",
            description: "Your opinion has been recorded on the ledger.",
          });

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: getListMarketsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMarketQueryKey(marketId) });
          queryClient.invalidateQueries({ queryKey: getGetMarketStatsQueryKey() });
        },
        onError: (err: any) => {
          if (err?.status === 409) {
            toast({
              title: "Market closed or already voted",
              description: "You cannot vote on this market right now.",
              variant: "destructive",
            });
            // Mark it as voted locally so we don't try again
            recordVoteLocally(marketId, -1); 
            setLocalVotes(prev => ({ ...prev, [marketId]: -1 }));
          } else {
            toast({
              title: "Error casting vote",
              description: "An unexpected error occurred.",
              variant: "destructive",
            });
          }
        }
      }
    );
  }, [localVotes, voteMutation, queryClient, toast, voterId]);

  return {
    castVote,
    isVoting: voteMutation.isPending,
    localVotes
  };
}
