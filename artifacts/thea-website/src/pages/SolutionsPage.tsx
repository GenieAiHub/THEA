import { motion } from "framer-motion";
import { Building, Mic, Briefcase, Activity, Globe, Target, Shield, Crosshair } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/marketing/PageHero";
import { CtaSection } from "@/components/marketing/CtaSection";
import { breadcrumbJsonLd } from "@/lib/seo";

const audiences = [
  {
    role: "Government & Political",
    icon: <Building className="h-8 w-8 text-blue-400" />,
    problem:
      "Public sentiment shifts rapidly, and missing an emerging oppositional narrative can derail legislative efforts or campaign momentum.",
    solution:
      "THEA tracks electorate sentiment geographically, monitors opposition narratives, and alerts campaigns to disinformation before it goes viral.",
    example:
      "During a debate, THEA detected a localized negative spike around a specific policy answer and drafted clarification talking points for the post-debate spin room.",
  },
  {
    role: "PR & Comms Agencies",
    icon: <Mic className="h-8 w-8 text-blue-400" />,
    problem:
      "Managing dozens of client brands manually requires massive analyst teams and still results in delayed reporting of critical events.",
    solution:
      "Deliver preemptive crisis alerts and automated daily intelligence briefings generated across every monitored client entity.",
    example:
      "An agency used THEA to warn a Fortune 500 client about a coordinated boycott forming on a niche forum 14 hours before mainstream news picked it up.",
  },
  {
    role: "Brand & Reputation Managers",
    icon: <Briefcase className="h-8 w-8 text-blue-400" />,
    problem:
      "Brand crises often start small. By the time leadership is aware, the narrative is already entrenched in public consciousness.",
    solution:
      "Safeguard corporate identity with continuous monitoring of executive mentions, brand sentiment vectors, and competitor controversy.",
    example:
      "When a product-defect rumor surfaced online, THEA alerted the reputation manager and generated a preemptive holding statement for customer service.",
  },
  {
    role: "Enterprise Marketing Teams",
    icon: <Activity className="h-8 w-8 text-blue-400" />,
    problem:
      "Campaign effectiveness is hard to measure in real time, and missing cultural trends means lost opportunities for engagement.",
    solution:
      "Optimize messaging on the fly. THEA surfaces trending topics in your vertical so marketing can inject the brand into relevant conversations.",
    example:
      "A retail brand used THEA's trend detection to pivot a major ad spend toward an emerging cultural moment, doubling weekend engagement.",
  },
  {
    role: "Newsrooms & Media",
    icon: <Globe className="h-8 w-8 text-blue-400" />,
    problem:
      "Journalists are overwhelmed by social noise, making it difficult to find verified breaking stories or gauge public reaction accurately.",
    solution:
      "Discover stories at the source. THEA acts as an automated assignment editor, highlighting anomalous data clusters that signal real-world events.",
    example:
      "A major news desk used THEA's geolocation anomalies to dispatch reporters to an unannounced protest hours ahead of competing networks.",
  },
];

export default function SolutionsPage() {
  return (
    <PublicLayout>
      <Seo
        title="Solutions — Intelligence for High-Stakes Teams"
        description="THEA delivers tailored intelligence for government and political campaigns, PR agencies, brand and reputation managers, enterprise marketing, and newsrooms."
        path="/solutions"
        jsonLd={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Solutions", path: "/solutions" },
        ])}
      />

      <PageHero
        eyebrow="Solutions"
        eyebrowIcon={<Crosshair className="h-4 w-4" />}
        title="Engineered for the frontlines"
        description="If your success depends on public perception, THEA is your asymmetric advantage. Explore how each team turns global signals into decisive action."
      />

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-7xl space-y-8">
          {audiences.map((a, i) => (
            <motion.div
              key={a.role}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/60 p-8 backdrop-blur-xl transition-all hover:border-blue-500/30 lg:p-12"
            >
              <div className="flex flex-col gap-12 lg:flex-row">
                <div className="lg:w-1/3">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 transition-transform group-hover:scale-110">
                    {a.icon}
                  </div>
                  <h2 className="text-3xl font-bold">{a.role}</h2>
                </div>
                <div className="grid gap-8 md:grid-cols-2 lg:w-2/3">
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-400">
                      <Target className="h-4 w-4" /> The Challenge
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{a.problem}</p>
                  </div>
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-400">
                      <Shield className="h-4 w-4" /> The THEA Advantage
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{a.solution}</p>
                  </div>
                  <div className="mt-2 rounded-xl border border-blue-500/20 bg-blue-950/20 p-6 md:col-span-2">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                        Mission Debrief
                      </h3>
                    </div>
                    <p className="text-base italic leading-relaxed text-blue-100/70">"{a.example}"</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <CtaSection
        title="Find your advantage"
        description="Tell us about your mission and we'll show you exactly how THEA fits."
      />
    </PublicLayout>
  );
}
