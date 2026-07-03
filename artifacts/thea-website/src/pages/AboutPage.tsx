import { motion } from "framer-motion";
import { Eye, Compass, Shield, Zap, Scale, Globe2 } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/marketing/PageHero";
import { CtaSection } from "@/components/marketing/CtaSection";
import { breadcrumbJsonLd } from "@/lib/seo";

const metrics = [
  { value: "150K+", label: "Sources monitored" },
  { value: "4B+", label: "Data points daily" },
  { value: "<200ms", label: "Detection latency" },
  { value: "75+", label: "Languages supported" },
];

const principles = [
  {
    icon: <Zap className="h-6 w-6 text-blue-400" />,
    title: "Speed is a strategy",
    desc: "In the information space, the first hours decide the narrative. We build for milliseconds so our users are never the last to know.",
  },
  {
    icon: <Scale className="h-6 w-6 text-blue-400" />,
    title: "Signal over noise",
    desc: "More data is not more clarity. THEA is designed to surface what matters and stay silent about what doesn't — respecting your team's attention.",
  },
  {
    icon: <Shield className="h-6 w-6 text-blue-400" />,
    title: "Responsible by design",
    desc: "We monitor public conversation to understand trends, not to surveil individuals. Human review sits at the center of every consequential decision.",
  },
  {
    icon: <Globe2 className="h-6 w-6 text-blue-400" />,
    title: "Global by default",
    desc: "Narratives cross borders and languages instantly. Our intelligence does too — so nothing forming abroad catches you off guard.",
  },
];

export default function AboutPage() {
  return (
    <PublicLayout>
      <Seo
        title="About THEA — Our Purpose & Mission"
        description="THEA — Total Human Engagement Analytics — exists to give organizations a clear, real-time view of the world's conversations, so they can understand narratives and act before they break."
        path="/about"
        jsonLd={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ])}
      />

      <PageHero
        eyebrow="Our Purpose"
        eyebrowIcon={<Eye className="h-4 w-4" />}
        title="Why THEA exists"
        description="The world talks faster than any team can listen. THEA — The All-Seeing Intelligence Eye — was built to close that gap: to turn the global conversation into clarity your organization can act on."
      />

      {/* Mission narrative */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl space-y-6 text-lg leading-relaxed text-muted-foreground">
          <p>
            Every day, billions of posts, articles, and broadcasts shape how the world sees your
            organization, your leaders, and your cause. Narratives now form in hours and travel across
            languages and borders before a traditional team has even finished its morning briefing.
          </p>
          <p>
            <span className="text-white">THEA stands for Total Human Engagement Analytics.</span> Our
            purpose is simple: to give the people who answer for public perception a real-time,
            all-seeing view of the conversation — and the tools to respond before a moment becomes a
            crisis.
          </p>
          <p>
            We combine large-scale collection, multilingual understanding, and generative response into
            a single engine. The result is not another dashboard of raw numbers, but decisive
            intelligence: what is changing, why it matters, and what to do about it.
          </p>
        </div>
      </section>

      {/* Metrics */}
      <section className="border-y border-white/5 bg-black/40 px-6 py-16 backdrop-blur-md">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="text-center">
              <div className="mb-2 font-display text-4xl font-bold text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)] md:text-5xl">
                {m.value}
              </div>
              <div className="text-sm uppercase tracking-wider text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Principles */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 text-blue-400">
              <Compass className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-widest">What we believe</span>
            </div>
            <h2 className="font-display text-3xl font-bold md:text-4xl">
              The principles behind the platform
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {principles.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-md transition-all hover:border-blue-500/50 hover:bg-white/5"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
                  {p.icon}
                </div>
                <h3 className="mb-3 text-xl font-bold text-white">{p.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        title="Join the organizations shaping the narrative"
        description="From newsrooms to national campaigns, teams rely on THEA to see clearly and act first."
      />
    </PublicLayout>
  );
}
