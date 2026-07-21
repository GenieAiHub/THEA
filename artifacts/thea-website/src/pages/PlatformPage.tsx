import { motion } from "framer-motion";
import {
  Activity,
  Globe,
  ShieldAlert,
  FileText,
  Radio,
  Target,
  Bell,
  FileBarChart,
  Plug,
  Webhook,
  ChevronRight,
  Mail,
  LineChart,
  ScanFace,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/marketing/PageHero";
import { CtaSection } from "@/components/marketing/CtaSection";
import { breadcrumbJsonLd } from "@/lib/seo";

const capabilities = [
  {
    icon: <Activity className="h-7 w-7 text-blue-400" />,
    title: "Real-Time Trend Detection",
    desc: "Identify emerging narratives across global social platforms and news outlets before they reach critical mass. THEA measures the velocity and vector of every conversation shift so you see the ripples before the wave.",
  },
  {
    icon: <Globe className="h-7 w-7 text-blue-400" />,
    title: "Global Sentiment Analysis",
    desc: "Understand exactly how the world feels. Our NLP engines parse millions of data points per second to quantify public emotion — extracting context, sarcasm, and nuance far beyond a basic positive/negative score.",
  },
  {
    icon: <ShieldAlert className="h-7 w-7 text-blue-400" />,
    title: "Preemptive Crisis Alerts",
    desc: "Don't get blindsided. THEA alerts your team the moment negative volume spikes around your entities, keywords, or leadership, routing severity-graded intelligence straight to your command center.",
  },
  {
    icon: <FileText className="h-7 w-7 text-blue-400" />,
    title: "AI-Drafted Statements",
    desc: "When seconds matter, THEA generates context-aware talking points, press statements, and rebuttal drafts based on the live threat — matched to your established voice and tone.",
  },
];

const suite = [
  {
    icon: <Target className="h-6 w-6 text-blue-400" />,
    title: "Watchlist Tracking",
    desc: "Define complex Boolean queries for exact entity tracking. Monitor competitors, executives, product lines, and distinct industry terminology.",
  },
  {
    icon: <Bell className="h-6 w-6 text-blue-400" />,
    title: "Severity-Graded Alerts",
    desc: "Not every spike is a crisis. THEA classifies alerts from Low (Information) to Critical (Immediate Action) to prevent alert fatigue.",
  },
  {
    icon: <Activity className="h-6 w-6 text-blue-400" />,
    title: "What-If Simulation",
    desc: "Run predictive simulations on proposed statements to gauge likely public reaction before you hit publish.",
  },
  {
    icon: <FileBarChart className="h-6 w-6 text-blue-400" />,
    title: "White-Label Reporting",
    desc: "Export data-rich PDF and PPTX intelligence briefs branded for your agency or organization with a single click.",
  },
  {
    icon: <Plug className="h-6 w-6 text-blue-400" />,
    title: "Enterprise API",
    desc: "Integrate THEA's cognitive engine directly into your dashboards, CRMs, or command-center software via our robust REST API.",
  },
  {
    icon: <Webhook className="h-6 w-6 text-blue-400" />,
    title: "Custom Webhooks",
    desc: "Trigger automated workflows in Zapier, Slack, Teams, or proprietary systems the moment sentiment thresholds are breached.",
  },
  {
    icon: <Mail className="h-6 w-6 text-blue-400" />,
    title: "Scheduled Intelligence Digests",
    desc: "Daily or weekly email digests summarize trends, sentiment shifts, and volume spikes across your watchlists — delivered on your schedule.",
  },
  {
    icon: <LineChart className="h-6 w-6 text-blue-400" />,
    title: "THEA Markets",
    desc: "Live public-opinion markets generated automatically from detected trends — a real-time signal of collective conviction.",
  },
  {
    icon: <ScanFace className="h-6 w-6 text-blue-400" />,
    title: "THEA Access",
    desc: "Biometric face-recognition access control for events, campaign HQs, and secure facilities — verified in seconds from a phone or browser.",
  },
];

export default function PlatformPage() {
  return (
    <PublicLayout>
      <Seo
        title="The THEA Platform — Global Intelligence Suite"
        description="Explore the THEA platform: real-time trend detection, global sentiment analysis, preemptive crisis alerts, AI-drafted statements, and a full enterprise intelligence suite."
        path="/platform"
        jsonLd={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Platform", path: "/platform" },
        ])}
      />

      <PageHero
        eyebrow="The Platform"
        eyebrowIcon={<Radio className="h-4 w-4" />}
        title="One platform for the entire information space"
        description="THEA unifies collection, analysis, detection, and response into a single intelligence engine — so your team can move from raw global noise to decisive action without switching tools."
      >
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button size="lg" className="h-12 bg-blue-600 px-8 text-white hover:bg-blue-500" asChild>
            <Link href="/pricing">Book a Demo</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 border-white/10 bg-black/20 px-8 hover:bg-white/5"
            asChild
          >
            <Link href="/how-it-works">See How It Works</Link>
          </Button>
        </div>
      </PageHero>

      {/* Core capabilities */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-3xl">
            <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">Core capabilities</h2>
            <p className="text-lg text-muted-foreground">
              THEA doesn't just aggregate data; it understands it. Four core capabilities give your
              team decisive advantage across the global conversation landscape.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {capabilities.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-md transition-all hover:border-blue-500/50 hover:bg-white/5"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 transition-transform group-hover:scale-110">
                  {c.icon}
                </div>
                <h3 className="mb-3 text-xl font-bold text-white group-hover:text-blue-200">
                  {c.title}
                </h3>
                <p className="leading-relaxed text-muted-foreground">{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Intelligence suite */}
      <section className="border-y border-white/5 bg-black/40 px-6 py-24 backdrop-blur-md">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">
              A comprehensive intelligence suite
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Beyond the core engine, THEA provides the enterprise tooling required to operationalize
              intelligence at scale.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {suite.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-7 transition-all hover:border-blue-500/50 hover:bg-white/[0.04]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/technology"
              className="inline-flex items-center gap-2 font-medium text-blue-400 hover:text-blue-300"
            >
              Explore the technology behind THEA <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <CtaSection />
    </PublicLayout>
  );
}
