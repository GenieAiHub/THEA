import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { CategoryChips } from "@/components/markets/CategoryChips";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ScanLine,
  Vote,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Wallet,
  TrendingUp,
  Trophy,
  Banknote,
} from "lucide-react";

const steps = [
  {
    icon: ScanLine,
    title: "THEA scans the trends",
    text: "Our AI continuously monitors news, social chatter and emerging topics to surface real-world questions worth predicting.",
  },
  {
    icon: Vote,
    title: "Pick your side",
    text: "Vote on any open market instantly — no account required. We tag your picks to this device so you always see where you stand.",
  },
  {
    icon: BarChart3,
    title: "Odds move live",
    text: "Every prediction shifts the market. Each percentage is the crowd's live implied odds for that outcome, updating in real time.",
  },
  {
    icon: CheckCircle2,
    title: "Markets resolve",
    text: "When the real-world outcome is confirmed, the market resolves and the winning outcome is locked in for everyone to see.",
  },
];

const moneySteps = [
  {
    icon: Wallet,
    title: "Fund one balance",
    text: "Deposit BTC, ETH, BSC-USDT or CG. Every deposit is converted to a single USD-pegged balance held securely by THEA.",
  },
  {
    icon: TrendingUp,
    title: "Trade the outcome",
    text: "Buy shares in the outcome you believe in. Prices are set automatically by demand — the more likely an outcome looks, the more its shares cost.",
  },
  {
    icon: Trophy,
    title: "Win and get paid",
    text: "If your outcome wins when the market resolves, each share you hold pays out $1.00 to your balance. If it loses, the shares expire.",
  },
  {
    icon: Banknote,
    title: "Withdraw anytime",
    text: "Cash out your balance in BSC-USDT. Deposits and withdrawals go live together, so your funds are never locked in.",
  },
];

const faqs = [
  {
    q: "Do I need an account to take part?",
    a: "No. You can vote on any open market anonymously — we tag your picks to your browser so you can follow the live results. An account is only needed to fund a wallet and trade for real money.",
  },
  {
    q: "How do I pay and earn?",
    a: "Deposit crypto (BTC, ETH, BSC-USDT or CG) to credit a single USD-pegged balance, then buy shares in the outcome you expect. Each winning share pays out $1.00 when the market resolves, and you can withdraw your balance in BSC-USDT.",
  },
  {
    q: "Is real-money trading live yet?",
    a: "It's rolling out in phases. Today, markets run as free opinion markets so you can take part with zero risk. Real-money trading and withdrawals launch together — we won't accept deposits until you can also cash out.",
  },
  {
    q: "What do the percentages mean?",
    a: "Each percentage is the market's current implied odds for that outcome — the crowd's live estimate of how likely it is to happen.",
  },
  {
    q: "Where do the markets come from?",
    a: "Most markets are generated automatically by THEA's AI as it scans trending topics. Some are curated by the team.",
  },
  {
    q: "What happens when a market closes?",
    a: "Closed markets stop accepting new positions. Once the real-world outcome is confirmed, the market resolves and winners are settled.",
  },
];

export default function HowItWorks() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-14 text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-4">
            How <span className="text-primary glow-text">THEA Markets</span> works
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            THEA turns the world's trending questions into live prediction markets. Vote for free
            today — and trade for real as we roll out deposits, payouts and withdrawals.
          </p>
        </header>

        <section className="mb-16">
          <h2 className="font-display font-bold text-2xl text-white mb-6">Get started in seconds</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="glass-panel rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-mono text-sm text-primary/70">0{i + 1}</span>
                  </div>
                  <h3 className="font-display font-bold text-xl text-white mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <h2 className="font-display font-bold text-2xl text-white">Playing for real money</h2>
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary uppercase tracking-wider">
              Rolling out
            </span>
          </div>
          <p className="text-muted-foreground mb-6 max-w-2xl">
            THEA Markets is custodial: we hold deposited funds and settle every payout. Here's the
            full loop once real-money trading is live.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {moneySteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="glass-panel rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-mono text-sm text-primary/70">0{i + 1}</span>
                  </div>
                  <h3 className="font-display font-bold text-xl text-white mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.text}</p>
                </div>
              );
            })}
          </div>
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
          <p className="text-muted-foreground mb-6">
            Explore live markets and make your first prediction — free.
          </p>
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
