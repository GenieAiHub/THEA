import { Link } from "wouter";
import {
  useListMarketCategories,
  getListMarketCategoriesQueryKey,
} from "@workspace/api-client-react";

interface CategoryChipsProps {
  active?: string;
}

export function CategoryChips({ active }: CategoryChipsProps) {
  const { data: categories } = useListMarketCategories({
    query: { queryKey: getListMarketCategoriesQueryKey() },
  });

  const chip = (isActive: boolean) =>
    `shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
      isActive
        ? "bg-primary/15 border-primary/40 text-primary"
        : "bg-secondary/30 border-primary/10 text-muted-foreground hover:text-white hover:border-primary/30"
    }`;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
      <Link href="/" className={chip(!active)}>
        All
      </Link>
      {categories?.data?.map((cat) => (
        <Link
          key={cat.category}
          href={`/category/${encodeURIComponent(cat.category)}`}
          className={chip(active?.toLowerCase() === cat.category.toLowerCase())}
        >
          {cat.category}
          <span className="ml-1.5 text-xs opacity-60 font-mono">{cat.count}</span>
        </Link>
      ))}
    </div>
  );
}
