import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { CategoryChips } from "@/components/markets/CategoryChips";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScanLine, Vote, BarChart3, CheckCircle2, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: ScanLine,
    title: "THEA scans the trends",
    text: "Our AI continuously monitors news, social chatter, and emerging topics to surface questions worth asking.",
  },
  {
    icon: Vote,
    title: "You cast your opinion",
    text: "Pick the outcome you believe in. One vote per market — no money, no stakes, just your genuine read.",
  },
  {
    icon: BarChart3,
    title: "Sentiment builds live",
    text: "Watch percentages shift in real time as the crowd weighs in. Every vote moves the needle.",
  },
  {
    icon: CheckCircle2,
    title: "Markets resolve",
    text: "When the outcome is known, the market resolves and the winning option is highlighted for all to see.",
  },
];

const faqs = [
  {
    q: "Is this real-money betting?",
    a: "No. THEA Markets is opinion-only. You trade opinions, not money. There are no wagers, deposits, or payouts — just a live read on what the crowd thinks.",
  },
  {
    q: "Where do the markets come from?",
    a: "Most markets are generated automatically by THEA's AI as it scans trending topics. Some are added manually by the team.",
  },
  {
    q: "Can I vote more than once?",
    a: "Each participant gets one vote per market. Once you've voted, you'll see the live results for that market.",
  },
  {
    q: "What do the percentages mean?",
    a: "Each percentage shows the share of votes an option has received so far. They update live as more people participate.",
  },
  {
    q: "What happens when a market closes?",
    a: "Closed markets stop accepting votes. Resolved markets additionally highlight the confirmed outcome.",
  },
];

export default function HowItWorks() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-14 text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-4">
            Trade opinions, <span className="text-primary glow-text">not money</span>.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            THEA Markets turns the world's trending questions into live prediction polls. Here's how it
            works.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="glass-panel rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-mono text-sm text-primary/70">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="font-display font-bold text-xl text-white mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.text}</p>
              </div>
            );
          })}
        </section>

        <section className="mb-16">
          <h2 className="font-display font-bold text-2xl text-white mb-6">Browse by category</h2>
          <CategoryChips />
        </section>

        <section className="mb-16">
          <h2 className="font-display font-bold text-2xl text-white mb-6">Frequently asked</h2>
          <Accordion type="single" collapsible className="glass-panel rounded-2xl px-6">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border/50">
                <AccordionTrigger className="text-left font-display text-white hover:text-primary hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="text-center glass-panel rounded-2xl p-10">
          <h2 className="font-display font-bold text-3xl text-white mb-3">Ready to weigh in?</h2>
          <p className="text-muted-foreground mb-6">Explore live markets and cast your first opinion.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Explore Markets <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </div>
    </Layout>
  );
}
