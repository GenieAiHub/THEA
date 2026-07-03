import { Link, useParams } from "wouter";
import { ArrowLeft, BookOpen } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { CtaSection } from "@/components/marketing/CtaSection";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { getArticle } from "@/content/knowledge-base";

export default function KnowledgeBaseArticlePage() {
  const params = useParams();
  const slug = params.slug ?? "";
  const article = getArticle(slug);

  if (!article) {
    return (
      <PublicLayout>
        <Seo
          title="Article not found"
          description="The requested knowledge base article could not be found."
          path={`/knowledge-base/${slug}`}
          noindex
        />
        <section className="px-6 pt-40 pb-32">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="mb-4 font-display text-3xl font-bold text-white">Article not found</h1>
            <p className="mb-8 text-muted-foreground">
              We couldn't find that guide. It may have moved or been renamed.
            </p>
            <Link
              href="/knowledge-base"
              className="inline-flex items-center gap-2 font-medium text-blue-400 hover:text-blue-300"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Knowledge Base
            </Link>
          </div>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <Seo
        title={article.title}
        description={article.description}
        path={`/knowledge-base/${article.slug}`}
        ogType="article"
        jsonLd={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Knowledge Base", path: "/knowledge-base" },
            { name: article.title, path: `/knowledge-base/${article.slug}` },
          ]),
          articleJsonLd({
            title: article.title,
            description: article.description,
            path: `/knowledge-base/${article.slug}`,
            section: article.category,
          }),
        ]}
      />

      <article className="px-6 pt-40 pb-24">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/knowledge-base"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Knowledge Base
          </Link>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400">
            <BookOpen className="h-3.5 w-3.5" />
            {article.category} · {article.readTime}
          </div>

          <h1 className="mb-4 font-display text-4xl font-bold leading-tight text-white md:text-5xl">
            {article.title}
          </h1>
          <p className="mb-10 text-lg leading-relaxed text-muted-foreground">
            {article.description}
          </p>

          <div className="prose prose-invert max-w-none prose-headings:font-display prose-headings:text-white prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3 prose-a:text-blue-400 prose-strong:text-white prose-li:marker:text-blue-400">
            {article.body.map((block, i) => {
              if (block.type === "h") return <h2 key={i}>{block.text}</h2>;
              if (block.type === "ul") {
                return (
                  <ul key={i}>
                    {block.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                );
              }
              return <p key={i}>{block.text}</p>;
            })}
          </div>
        </div>
      </article>

      <CtaSection />
    </PublicLayout>
  );
}
