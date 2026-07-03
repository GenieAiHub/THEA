import { motion } from "framer-motion";
import { Database, BarChart3, Eye, Bell, MessageSquare, Workflow } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/marketing/PageHero";
import { CtaSection } from "@/components/marketing/CtaSection";
import { breadcrumbJsonLd } from "@/lib/seo";

const steps = [
  {
    n: "01",
    title: "Collect",
    icon: <Database className="h-6 w-6 text-blue-400" />,
    desc: "Continuous ingestion from global news APIs, major social networks, decentralized forums, subreddits, and thousands of RSS feeds in real time.",
    detail:
      "THEA maintains persistent connections to 150,000+ sources across the open and social web. A politeness-aware crawler, streaming social listeners, and curated feed ingestion normalize every inbound item into a common schema — capturing author, reach, language, and timestamp — so nothing meaningful slips through.",
  },
  {
    n: "02",
    title: "Analyze",
    icon: <BarChart3 className="h-6 w-6 text-blue-400" />,
    desc: "Deep NLP processing evaluates emotional resonance, extracts entities, and scores sentiment across 75+ languages simultaneously.",
    detail:
      "Each item passes through a cognitive pipeline that resolves entities, classifies topics, and quantifies sentiment with an understanding of context, sarcasm, and nuance. Multilingual models mean a narrative forming in one language is understood alongside the global conversation, not siloed from it.",
  },
  {
    n: "03",
    title: "Detect",
    icon: <Eye className="h-6 w-6 text-blue-400" />,
    desc: "Anomaly detection models identify sudden spikes in conversation volume or severe negative sentiment shifts against baseline norms.",
    detail:
      "THEA continuously learns the normal rhythm of every entity you track. When volume, velocity, or sentiment breaks from that baseline, the anomaly engine flags it and grades severity — separating routine chatter from the signals that demand attention.",
  },
  {
    n: "04",
    title: "Alert",
    icon: <Bell className="h-6 w-6 text-blue-400" />,
    desc: "Intelligent routing pushes severity-graded alerts to your team via webhook, Slack, email, or SMS within milliseconds of an event triggering.",
    detail:
      "Alerts are classified from Low (Information) to Critical (Immediate Action) so your team is never buried under noise. Routing rules deliver the right alert to the right people on the right channel, with the context they need to act immediately.",
  },
  {
    n: "05",
    title: "Act",
    icon: <MessageSquare className="h-6 w-6 text-blue-400" />,
    desc: "Generative AI instantly drafts proposed public statements, internal memos, and social responses tailored to mitigate the specific narrative.",
    detail:
      "The moment a threat is understood, THEA drafts a response in your organization's voice — talking points, holding statements, and rebuttals grounded in the live situation. Your team reviews, refines, and publishes in minutes instead of hours.",
  },
];

export default function HowItWorksPage() {
  return (
    <PublicLayout>
      <Seo
        title="How THEA Works — The Intelligence Pipeline"
        description="How THEA transforms global noise into tactical clarity: a five-stage pipeline of Collect, Analyze, Detect, Alert, and Act that runs in real time across 150,000+ sources."
        path="/how-it-works"
        jsonLd={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "How It Works", path: "/how-it-works" },
        ])}
      />

      <PageHero
        eyebrow="How It Works"
        eyebrowIcon={<Workflow className="h-4 w-4" />}
        title="From global noise to tactical clarity"
        description="THEA runs a seamless five-stage intelligence pipeline. Each stage feeds the next — turning billions of daily signals into the specific insight and response your team needs."
      />

      <section className="px-6 pb-24">
        <div className="relative mx-auto max-w-4xl">
          <div className="absolute bottom-10 left-6 top-10 hidden w-0.5 bg-gradient-to-b from-blue-500/60 via-blue-500/20 to-transparent md:block" />

          <div className="space-y-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group relative md:pl-24"
              >
                <div className="absolute left-0 top-2 hidden h-12 w-12 items-center justify-center rounded-full border border-blue-500/30 bg-background shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-transform group-hover:scale-110 group-hover:border-blue-500/80 md:flex">
                  {step.icon}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/5">
                  <div className="mb-3 flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/20 md:hidden">
                      {step.icon}
                    </div>
                    <span className="font-mono text-sm text-blue-400">{step.n}</span>
                    <h2 className="text-2xl font-bold text-white group-hover:text-blue-300">
                      {step.title}
                    </h2>
                  </div>
                  <p className="mb-4 text-lg leading-relaxed text-white/90">{step.desc}</p>
                  <p className="leading-relaxed text-muted-foreground">{step.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        title="See the pipeline on live data"
        description="Book a demo and watch THEA collect, analyze, and respond to the narratives that matter to your organization."
      />
    </PublicLayout>
  );
}
