export function getVoterId(): string {
  const KEY = "thea_markets_voter_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function getVotedMarkets(): Record<string, number> {
  const KEY = "thea_markets_votes";
  try {
    const data = localStorage.getItem(KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function recordVoteLocally(marketId: string, optionIndex: number) {
  const KEY = "thea_markets_votes";
  const votes = getVotedMarkets();
  votes[marketId] = optionIndex;
  localStorage.setItem(KEY, JSON.stringify(votes));
}

export function hasVotedOn(marketId: string): number | null {
  const votes = getVotedMarkets();
  return votes[marketId] !== undefined ? votes[marketId] : null;
}
