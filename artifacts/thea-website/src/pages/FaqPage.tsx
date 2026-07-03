import { HelpCircle, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { PageHero } from "@/components/marketing/PageHero";
import { CtaSection } from "@/components/marketing/CtaSection";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";

type Qa = { question: string; answer: string };

const FAQ_GROUPS: { category: string; items: Qa[] }[] = [
  {
    category: "General",
    items: [
      {
        question: "What is THEA?",
        answer:
          "THEA — Total Human Engagement Analytics — is a global intelligence platform that monitors the world's conversations across 150,000+ sources to deliver real-time trend detection, sentiment analysis, and preemptive crisis alerts, plus AI-drafted responses.",
      },
      {
        question: "Who is THEA for?",
        answer:
          "THEA is built for teams whose success depends on public perception: government and political campaigns, PR and communications agencies, brand and reputation managers, enterprise marketing teams, and newsrooms.",
      },
      {
        question: "How quickly can we get started?",
        answer:
          "Most teams are up and running in a single session. You add the entities you care about, connect an alert channel, and THEA begins surfacing trends and anomalies within minutes.",
      },
    ],
  },
  {
    category: "Platform & Data",
    items: [
      {
        question: "What data sources does THEA monitor?",
        answer:
          "THEA ingests data from major social networks, global news APIs covering tens of thousands of publications, decentralized networks and forums, and custom RSS feeds. It processes over 4 billion distinct data points daily.",
      },
      {
        question: "How fast is crisis detection?",
        answer:
          "THEA's streaming architecture evaluates inbound data in sub-second latency. When a critical mass of negative sentiment or anomalous volume occurs, alerts are dispatched within milliseconds — so you know before the broader market does.",
      },
      {
        question: "How many languages does THEA support?",
        answer:
          "THEA scores sentiment and resolves entities across 75+ languages simultaneously, so narratives forming in any language are understood alongside the global conversation.",
      },
      {
        question: "Can THEA mimic our corporate tone for statement drafting?",
        answer:
          "Yes. Enterprise deployments include a fine-tuning phase where THEA ingests your organization's historical press releases, brand guidelines, and executive speech patterns so generative outputs match your precise corporate voice.",
      },
    ],
  },
  {
    category: "Security",
    items: [
      {
        question: "Is our data and monitoring secure?",
        answer:
          "Yes. THEA operates under SOC 2 Type II and ISO 27001 practices. Your watchlists, internal data, and generated statements are siloed, encrypted at rest and in transit, and never used to train the base model.",
      },
      {
        question: "Who can access our workspace?",
        answer:
          "Access is limited to authorized members of your organization, with controls designed to prevent unauthorized use. Administrators manage membership and permissions.",
      },
    ],
  },
  {
    category: "Plans & Billing",
    items: [
      {
        question: "How is THEA priced?",
        answer:
          "THEA offers Professional, Business, and Political Party plans billed monthly or annually, with annual billing discounted. Each plan scales tracked entities, historical data access, and features. See the pricing page for details.",
      },
      {
        question: "Can I change plans later?",
        answer:
          "Yes. You can upgrade as your needs grow, and plan entitlements — such as tracked entities and historical data access — adjust accordingly.",
      },
    ],
  },
];

const ALL_QA: Qa[] = FAQ_GROUPS.flatMap((g) => g.items);

export default function FaqPage() {
  return (
    <PublicLayout>
      <Seo
        title="Frequently Asked Questions"
        description="Answers to common questions about the THEA intelligence platform — what it monitors, how fast detection is, language coverage, security, and pricing."
        path="/faq"
        jsonLd={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
          faqJsonLd(ALL_QA),
        ]}
      />

      <PageHero
        eyebrow="FAQ"
        eyebrowIcon={<HelpCircle className="h-4 w-4" />}
        title="Frequently asked questions"
        description="Everything you need to know about THEA. Can't find an answer? Explore the knowledge base or book a demo."
      />

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl space-y-14">
          {FAQ_GROUPS.map((group) => (
            <div key={group.category}>
              <h2 className="mb-6 font-display text-2xl font-bold text-white">{group.category}</h2>
              <Accordion type="single" collapsible className="w-full space-y-4">
                {group.items.map((qa, i) => (
                  <AccordionItem
                    key={qa.question}
                    value={`${group.category}-${i}`}
                    className="rounded-lg border border-white/10 bg-white/5 px-6 transition-all data-[state=open]:border-blue-500/50 data-[state=open]:bg-white/10"
                  >
                    <AccordionTrigger className="text-left text-lg hover:text-blue-400 hover:no-underline">
                      {qa.question}
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6 text-base leading-relaxed text-muted-foreground">
                      {qa.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}

          <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-8 text-center">
            <h2 className="mb-2 font-display text-xl font-bold text-white">Still have questions?</h2>
            <p className="mb-5 text-muted-foreground">
              Browse in-depth guides in the knowledge base or talk to our team.
            </p>
            <Link
              href="/knowledge-base"
              className="inline-flex items-center gap-2 font-medium text-blue-400 hover:text-blue-300"
            >
              Visit the Knowledge Base <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <CtaSection />
    </PublicLayout>
  );
}
