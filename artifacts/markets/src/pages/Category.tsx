import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useListMarkets,
  getListMarketsQueryKey,
  ListMarketsSort,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { CategoryChips } from "@/components/markets/CategoryChips";
import { MarketGrid } from "@/components/markets/MarketGrid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Flame, ArrowLeft } from "lucide-react";

export default function Category() {
  const { category } = useParams<{ category: string }>();
  const decoded = decodeURIComponent(category ?? "");
  const [sort, setSort] = useState<ListMarketsSort>("trending");

  const listParams = { category: decoded, sort };

  const { data: marketsData, isLoading } = useListMarkets(listParams, {
    query: { queryKey: getListMarketsQueryKey(listParams) },
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> All Markets
        </Link>

        <header className="mb-8">
          <div className="text-sm text-primary font-semibold uppercase tracking-wide mb-2">
            Category
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight capitalize">
            {decoded}
          </h1>
        </header>

        <section className="mb-6">
          <CategoryChips active={decoded} />
        </section>

        <section className="mb-8 flex justify-end">
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

        <MarketGrid
          markets={marketsData?.data}
          isLoading={isLoading}
          emptyTitle="No markets in this category"
          emptyText="Check back soon — THEA is always scanning for new trends."
        />
      </div>
    </Layout>
  );
}
