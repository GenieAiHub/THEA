import { motion } from "framer-motion";
import {
  Link2,
  Smartphone,
  Apple,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  PieChart,
  Users,
  DollarSign,
  Megaphone,
  FileDown,
  Bug,
  ChevronRight,
  Crosshair,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/marketing/PageHero";
import { CtaSection } from "@/components/marketing/CtaSection";
import { breadcrumbJsonLd } from "@/lib/seo";

const core = [
  {
    icon: <Link2 className="h-7 w-7 text-blue-400" />,
    title: "Tracking Links & Smart Redirects",
    desc: "Generate campaign tracking links for every channel, creator, and placement in seconds. Every click is captured with its source and routed to the right store or landing page — no SDK required for the click side.",
  },
  {
    icon: <Smartphone className="h-7 w-7 text-blue-400" />,
    title: "Install & Event Attribution",
    desc: "Attribute every install and in-app event to the campaign that drove it with last-click matching over a 7-day window. Lightweight SDK or direct server-to-server ingest — your revenue events land in the same dashboards.",
  },
  {
    icon: <Apple className="h-7 w-7 text-blue-400" />,
    title: "SKAdNetwork 4.0 Measurement",
    desc: "THEA operates a dedicated Apple SKAdNetwork postback receiver. Point your iOS app's Info.plist at THEA and privacy-safe postbacks — conversion values, win/loss, sequence — appear alongside your device-level data.",
  },
  {
    icon: <ShieldCheck className="h-7 w-7 text-blue-400" />,
    title: "Fraud Signals",
    desc: "Bot-like click-to-install times, click flooding, and click-pattern anomalies are flagged at ingest, so paid numbers reflect real humans — not install farms.",
  },
];

const intelligence = [
  {
    icon: <Crosshair className="h-6 w-6 text-blue-400" />,
    title: "Industry Benchmarks",
    desc: "Compare your CPI, conversion rate, D1/D7/D30 retention, and D30 ROAS against published industry benchmarks for your app category — instant verdicts on where you lead and where you lag.",
  },
  {
    icon: <TrendingUp className="h-6 w-6 text-blue-400" />,
    title: "Predictive LTV",
    desc: "A curve fitted to your observed revenue projects each cohort's lifetime value out to day 30, 90, and 180 — with confidence grading so you know how much weight to put on the forecast.",
  },
  {
    icon: <PieChart className="h-6 w-6 text-blue-400" />,
    title: "Media-Mix Modeling",
    desc: "MMM-lite analysis across your channels weighs spend against revenue and suggests a smarter budget allocation — see which channel deserves the next dollar.",
  },
  {
    icon: <BarChart3 className="h-6 w-6 text-blue-400" />,
    title: "Cohorts & Retention",
    desc: "Weekly install cohorts with maturity-aware D1/D7/D30 retention — young cohorts show as pending, never as a misleading zero.",
  },
  {
    icon: <DollarSign className="h-6 w-6 text-blue-400" />,
    title: "Cost & ROAS Tracking",
    desc: "Log spend per campaign link and day, and THEA computes CPI, ROAS, and payback directly against attributed revenue.",
  },
  {
    icon: <Megaphone className="h-6 w-6 text-blue-400" />,
    title: "Creator & Influencer Tracking",
    desc: "Dedicated links per creator show exactly which influencer drives installs, retention, and revenue — not just clicks.",
  },
  {
    icon: <Users className="h-6 w-6 text-blue-400" />,
    title: "App Health Checks",
    desc: "A single health view flags broken ingestion, silent SDKs, and anomalous attribution patterns per app.",
  },
  {
    icon: <FileDown className="h-6 w-6 text-blue-400" />,
    title: "CSV Export",
    desc: "Every table exports to spreadsheet-safe CSV for your own BI stack, investor updates, or agency reporting.",
  },
  {
    icon: <Bug className="h-6 w-6 text-blue-400" />,
    title: "Live SDK Debugger",
    desc: "Watch raw ingest payloads arrive in real time while you integrate — no support ticket required to see what your app is sending.",
  },
];

const comparison = [
  { feature: "Mobile install & event attribution", thea: true, legacy: true },
  { feature: "SKAdNetwork postback receiver", thea: true, legacy: true },
  { feature: "Cohort & retention reports", thea: true, legacy: true },
  { feature: "Industry category benchmarks", thea: true, legacy: "Enterprise add-on" },
  { feature: "Predictive LTV projections", thea: true, legacy: "Enterprise add-on" },
  { feature: "Media-mix budget suggestions", thea: true, legacy: "Enterprise add-on" },
  { feature: "Narrative & sentiment intelligence on the same platform", thea: true, legacy: false },
  { feature: "Per-conversion metering (~$0.07 per install after free tier)", thea: false, legacy: true },
];

export default function AttributionPage() {
  return (
    <PublicLayout>
      <Seo
        title="THEA Attribution — Full-Stack Mobile Measurement"
        description="Mobile attribution built into THEA: tracking links, install & event attribution, SKAdNetwork 4.0 measurement, fraud signals, industry benchmarks, predictive LTV, and media-mix modeling — included in every plan with no per-conversion fees."
        path="/attribution"
        jsonLd={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Attribution", path: "/attribution" },
        ])}
      />

      <PageHero
        eyebrow="THEA Attribution"
        eyebrowIcon={<Crosshair className="h-4 w-4" />}
        title="Know exactly which campaign moved the needle"
        description="A full mobile measurement suite — attribution, SKAdNetwork, benchmarks, predictive LTV, and media-mix intelligence — built into the same platform that watches the world's conversations. No separate MMP contract. No per-conversion metering."
      >
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button size="lg" className="h-12 bg-blue-600 px-8 text-white hover:bg-blue-500" asChild>
            <Link href="/pricing">See Plans</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 border-white/10 bg-black/20 px-8 hover:bg-white/5"
            asChild
          >
            <Link href="/faq">Attribution FAQ</Link>
          </Button>
        </div>
      </PageHero>

      {/* Core measurement */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-3xl">
            <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">Measurement that holds up</h2>
            <p className="text-lg text-muted-foreground">
              From the first click to the last purchase, THEA Attribution captures the full journey —
              on Android, iOS, and the post-ATT privacy landscape.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {core.map((c, i) => (
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
                <h3 className="mb-3 text-xl font-bold text-white group-hover:text-blue-200">{c.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Growth intelligence */}
      <section className="border-y border-white/5 bg-black/40 px-6 py-24 backdrop-blur-md">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">
              Attribution data is the start — intelligence is the point
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              THEA turns raw installs and events into decisions: how you rank against your category,
              what a cohort will be worth, and where the next dollar of budget should go. Estimates and
              benchmarks are always clearly labeled as such.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {intelligence.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
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
        </div>
      </section>

      {/* Comparison vs legacy MMPs */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">Why teams switch from legacy MMPs</h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Standalone measurement platforms meter every conversion and gate advanced analytics behind
              enterprise contracts. THEA Attribution ships with every plan.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-6 py-4 font-medium text-muted-foreground">Capability</th>
                  <th className="px-6 py-4 text-center font-bold text-white">THEA Attribution</th>
                  <th className="px-6 py-4 text-center font-medium text-muted-foreground">Legacy MMPs</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.feature} className="border-b border-white/5 last:border-0">
                    <td className="px-6 py-4 text-slate-300">{row.feature}</td>
                    <td className="px-6 py-4 text-center">
                      {row.thea ? (
                        <CheckCircle2 className="mx-auto h-5 w-5 text-blue-400" />
                      ) : (
                        <XCircle className="mx-auto h-5 w-5 text-slate-600" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.legacy === true ? (
                        <CheckCircle2 className="mx-auto h-5 w-5 text-slate-500" />
                      ) : row.legacy === false ? (
                        <XCircle className="mx-auto h-5 w-5 text-slate-600" />
                      ) : (
                        <span className="text-xs text-muted-foreground">{row.legacy}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            "Legacy MMPs" reflects typical published pricing and packaging of standalone mobile
            measurement vendors as of 2026; specifics vary by vendor and contract.
          </p>

          <div className="mt-12 text-center">
            <Link
              href="/platform"
              className="inline-flex items-center gap-2 font-medium text-blue-400 hover:text-blue-300"
            >
              See the full THEA platform <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <CtaSection />
    </PublicLayout>
  );
}
