import { motion } from "framer-motion";
import {
  Cpu,
  Database,
  Languages,
  Radar,
  Sparkles,
  Lock,
  Gauge,
  Network,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/marketing/PageHero";
import { CtaSection } from "@/components/marketing/CtaSection";
import { breadcrumbJsonLd } from "@/lib/seo";

const layers = [
  {
    icon: <Database className="h-7 w-7 text-blue-400" />,
    title: "Global Data Ingestion",
    desc: "THEA maintains real-time connections to 150,000+ sources — global news APIs, major social networks, decentralized forums, and curated RSS feeds. A politeness-aware crawler and streaming listeners normalize more than 4 billion data points every day into a single, queryable schema.",
    points: ["150,000+ monitored sources", "4B+ daily data points", "Author, reach & language captured at ingest"],
  },
  {
    icon: <Languages className="h-7 w-7 text-blue-400" />,
    title: "Multilingual NLP Engine",
    desc: "Our cognitive pipeline resolves entities, classifies topics, and scores sentiment across 75+ languages simultaneously — understanding context, sarcasm, and nuance rather than counting keywords. A narrative forming in one language is understood alongside the global conversation.",
    points: ["75+ languages", "Entity & topic resolution", "Context-aware sentiment"],
  },
  {
    icon: <Radar className="h-7 w-7 text-blue-400" />,
    title: "Anomaly Detection",
    desc: "THEA continuously learns the normal rhythm of every tracked entity. When volume, velocity, or sentiment breaks from baseline, the anomaly engine flags it and grades severity — separating routine chatter from the signals that demand a response.",
    points: ["Adaptive baselines", "Volume & velocity spikes", "Severity grading"],
  },
  {
    icon: <Sparkles className="h-7 w-7 text-blue-400" />,
    title: "Generative Response Layer",
    desc: "When a threat is understood, THEA's generative layer drafts talking points, holding statements, and rebuttals grounded in the live situation and matched to your organization's voice — accelerating response from hours to minutes, always with a human in the loop.",
    points: ["Voice & tone matching", "Context-grounded drafts", "Human review by design"],
  },
];

const infra = [
  {
    icon: <Gauge className="h-6 w-6 text-blue-400" />,
    title: "Real-Time Streaming",
    desc: "A streaming architecture evaluates inbound data in sub-second latency, dispatching critical alerts within milliseconds of an event triggering.",
  },
  {
    icon: <Network className="h-6 w-6 text-blue-400" />,
    title: "Scalable Pipeline",
    desc: "Queue-based processing and horizontal scaling keep throughput steady from routine days to viral surges, so coverage never degrades when it matters most.",
  },
  {
    icon: <Lock className="h-6 w-6 text-blue-400" />,
    title: "Security & Compliance",
    desc: "Operated under SOC 2 Type II and ISO 27001 practices. Your watchlists and generated statements are siloed, encrypted at rest and in transit, and never used to train the base model.",
  },
];

export default function TechnologyPage() {
  return (
    <PublicLayout>
      <Seo
        title="Technology — Inside the THEA Intelligence Engine"
        description="Inside THEA's technology: global data ingestion across 150,000+ sources, a multilingual NLP engine spanning 75+ languages, real-time anomaly detection, and a human-in-the-loop generative response layer."
        path="/technology"
        jsonLd={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Technology", path: "/technology" },
        ])}
      />

      <PageHero
        eyebrow="Technology"
        eyebrowIcon={<Cpu className="h-4 w-4" />}
        title="The engine behind the intelligence"
        description="THEA is built as four cooperating layers — ingestion, understanding, detection, and response — running on a real-time streaming core engineered for scale and security."
      />

      {/* Layers */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2">
            {layers.map((layer, i) => (
              <motion.div
                key={layer.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-md transition-all hover:border-blue-500/50 hover:bg-white/5"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 transition-transform group-hover:scale-110">
                  {layer.icon}
                </div>
                <h2 className="mb-3 text-2xl font-bold text-white group-hover:text-blue-200">
                  {layer.title}
                </h2>
                <p className="mb-6 leading-relaxed text-muted-foreground">{layer.desc}</p>
                <ul className="space-y-2">
                  {layer.points.map((p) => (
                    <li key={p} className="flex items-center gap-3 text-sm text-white/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {p}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Infra */}
      <section className="border-y border-white/5 bg-black/40 px-6 py-24 backdrop-blur-md">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">
              Built for real time, built for trust
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              The intelligence layers run on infrastructure engineered for speed, resilience, and
              enterprise-grade security.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {infra.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-7 transition-all hover:border-blue-500/50 hover:bg-white/[0.04]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  {item.icon}
                </div>
                <h3 className="mb-2 text-lg font-bold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        title="Put the engine to work"
        description="See how THEA's technology maps to your mission. Book a demo with our team."
      />
    </PublicLayout>
  );
}
