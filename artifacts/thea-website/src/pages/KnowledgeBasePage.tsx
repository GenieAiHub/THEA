import { motion } from "framer-motion";
import { BookOpen, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/marketing/PageHero";
import { CtaSection } from "@/components/marketing/CtaSection";
import { breadcrumbJsonLd } from "@/lib/seo";
import { KB_ARTICLES, KB_CATEGORY_ORDER } from "@/content/knowledge-base";

export default function KnowledgeBasePage() {
  const categories = KB_CATEGORY_ORDER.map((category) => ({
    category,
    articles: KB_ARTICLES.filter((a) => a.category === category),
  })).filter((c) => c.articles.length > 0);

  return (
    <PublicLayout>
      <Seo
        title="Knowledge Base — Guides & Documentation"
        description="Learn how to get the most from THEA: guides on watchlists, alerts, sentiment analysis, trend detection, integrations, and data security."
        path="/knowledge-base"
        jsonLd={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Knowledge Base", path: "/knowledge-base" },
        ])}
      />

      <PageHero
        eyebrow="Knowledge Base"
        eyebrowIcon={<BookOpen className="h-4 w-4" />}
        title="Guides to master the platform"
        description="Practical, plain-language guides to help your team get from raw signal to decisive action with THEA."
      />

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-7xl space-y-16">
          {categories.map((group) => (
            <div key={group.category}>
              <h2 className="mb-6 font-display text-2xl font-bold text-white">{group.category}</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {group.articles.map((article, i) => (
                  <motion.div
                    key={article.slug}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                  >
                    <Link
                      href={`/knowledge-base/${article.slug}`}
                      className="group flex h-full flex-col rounded-2xl border border-white/10 bg-black/40 p-7 backdrop-blur-md transition-all hover:border-blue-500/50 hover:bg-white/5"
                    >
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-blue-400">
                        {article.readTime}
                      </div>
                      <h3 className="mb-3 text-lg font-bold text-white group-hover:text-blue-200">
                        {article.title}
                      </h3>
                      <p className="mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {article.description}
                      </p>
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-400">
                        Read guide
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaSection
        title="Ready to see it live?"
        description="Book a demo and we'll walk your team through THEA on the narratives that matter to you."
      />
    </PublicLayout>
  );
}
