import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  useListMarkets,
  getListMarketsQueryKey,
  Market,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Sparkles, Clock, BarChart3 } from "lucide-react";

function FeedItem({ market, meta }: { market: Market; meta: string }) {
  return (
    <Link
      href={`/market/${market.id}`}
      className="flex items-start gap-3 px-4 py-4 hover:bg-secondary/30 transition-colors group"
    >
      <div className="shrink-0 mt-0.5 w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
        <BarChart3 className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">
            {market.category}
          </span>
          <span className="text-xs text-muted-foreground">· {meta}</span>
        </div>
        <h3 className="font-display font-medium text-white truncate group-hover:text-primary transition-colors">
          {market.question}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {market.totalVotes.toLocaleString()} votes
        </p>
      </div>
    </Link>
  );
}

function FeedColumn({
  title,
  icon,
  markets,
  isLoading,
  metaFor,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  markets?: Market[];
  isLoading?: boolean;
  metaFor: (m: Market) => string;
  emptyText: string;
}) {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border/50">
        {icon}
        <h2 className="font-display font-semibold text-white">{title}</h2>
      </div>
      {isLoading ? (
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg bg-primary/5" />
          ))}
        </div>
      ) : !markets?.length ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="divide-y divide-border/50">
          {markets.map((m) => (
            <FeedItem key={m.id} market={m} meta={metaFor(m)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Activity() {
  const newestParams = { sort: "newest" as const, limit: 15 };
  const closingParams = { sort: "closing" as const, status: "open" as const, limit: 15 };

  const { data: newest, isLoading: newestLoading } = useListMarkets(newestParams, {
    query: { queryKey: getListMarketsQueryKey(newestParams) },
  });
  const { data: closing, isLoading: closingLoading } = useListMarkets(closingParams, {
    query: { queryKey: getListMarketsQueryKey(closingParams) },
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">Activity</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">
            The live pulse of THEA Markets — fresh polls and markets about to close.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FeedColumn
            title="Latest Markets"
            icon={<Sparkles className="w-5 h-5 text-primary" />}
            markets={newest?.data}
            isLoading={newestLoading}
            metaFor={(m) =>
              m.createdAt
                ? `${formatDistanceToNow(new Date(m.createdAt))} ago`
                : "recently added"
            }
            emptyText="No recent markets yet."
          />
          <FeedColumn
            title="Closing Soon"
            icon={<Clock className="w-5 h-5 text-primary" />}
            markets={closing?.data}
            isLoading={closingLoading}
            metaFor={(m) =>
              m.closesAt ? `closes in ${formatDistanceToNow(new Date(m.closesAt))}` : "open"
            }
            emptyText="Nothing closing soon."
          />
        </div>
      </div>
    </Layout>
  );
}
