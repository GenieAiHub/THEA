import { Link } from "wouter";
import {
  useListMarketCategories,
  getListMarketCategoriesQueryKey,
} from "@workspace/api-client-react";
import { LayoutGrid } from "lucide-react";
import { MARKET_CATEGORIES } from "@/lib/categories";

interface CategoryChipsProps {
  active?: string;
}

export function CategoryChips({ active }: CategoryChipsProps) {
  const { data: categories } = useListMarketCategories({
    query: { queryKey: getListMarketCategoriesQueryKey() },
  });

  const counts = new Map<string, number>();
  categories?.data?.forEach((c) => counts.set(c.category.toLowerCase(), c.count));

  const chip = (isActive: boolean) =>
    `shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
      isActive
        ? "bg-primary/15 border-primary/40 text-primary"
        : "bg-secondary/30 border-primary/10 text-muted-foreground hover:text-white hover:border-primary/30"
    }`;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
      <Link href="/" className={chip(!active)}>
        <LayoutGrid className="w-3.5 h-3.5" />
        All
      </Link>
      {MARKET_CATEGORIES.map(({ name, icon: Icon }) => {
        const count = counts.get(name.toLowerCase()) ?? 0;
        const isActive = active?.toLowerCase() === name.toLowerCase();
        return (
          <Link
            key={name}
            href={`/category/${encodeURIComponent(name)}`}
            className={chip(isActive)}
          >
            <Icon className="w-3.5 h-3.5" />
            {name}
            {count > 0 && (
              <span className="ml-0.5 text-xs opacity-60 font-mono">{count}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
