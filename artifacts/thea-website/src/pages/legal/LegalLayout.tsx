import type { ReactNode } from "react";
import { Scale } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/marketing/PageHero";
import { breadcrumbJsonLd } from "@/lib/seo";

type LegalLayoutProps = {
  title: string;
  description: string;
  path: string;
  lastUpdated: string;
  children: ReactNode;
};

export function LegalLayout({ title, description, path, lastUpdated, children }: LegalLayoutProps) {
  return (
    <PublicLayout>
      <Seo
        title={title}
        description={description}
        path={path}
        jsonLd={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: title, path },
        ])}
      />
      <PageHero
        eyebrow="Legal"
        eyebrowIcon={<Scale className="h-4 w-4" />}
        title={title}
        description={description}
      />
      <section className="px-6 pb-32">
        <div className="mx-auto max-w-3xl">
          <p className="mb-10 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          <article className="prose prose-invert max-w-none prose-headings:font-display prose-headings:text-white prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-a:text-blue-400 prose-strong:text-white prose-li:marker:text-blue-400">
            {children}
          </article>
        </div>
      </section>
    </PublicLayout>
  );
}
