import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { breadcrumbJsonLd } from "@/lib/seo";
import { useAuth } from "@/context/AuthContext";

const PLANS = [
  {
    name: "Professional",
    key: "professional",
    segment: "For Professionals & Consultants",
    priceMonthly: 99,
    priceAnnual: 79,
    description: "Essential intelligence for independent PR consultants and reputation managers.",
    features: [
      "Real-time media & narrative monitoring",
      "Basic trend intelligence",
      "Up to 5 active tracked entities",
      "Daily sentiment alerts via email",
      "Scheduled intelligence digest emails",
      "30-day historical data access",
    ],
  },
  {
    name: "Business",
    key: "business",
    segment: "For Brands & Enterprises",
    priceMonthly: 499,
    priceAnnual: 399,
    recommended: true,
    description: "Comprehensive reputation defense and competitor tracking for corporate teams.",
    features: [
      "Everything in Professional",
      "Preemptive crisis alerts (Slack/Teams)",
      "Competitor narrative tracking",
      "Up to 25 active tracked entities",
      "AI-drafted holding statements",
      "Expanded social coverage: TikTok, Telegram, YouTube & more",
      "1-year historical data access",
      "Custom white-label reporting",
    ],
  },
  {
    name: "Political Party",
    key: "political",
    segment: "For Parties & Campaigns",
    priceMonthly: 1999,
    priceAnnual: 1599,
    description: "Unrestricted operational intelligence for high-stakes political campaigns.",
    features: [
      "Everything in Business",
      "Geo-targeted sentiment vectors",
      "Opponent disinformation tracking",
      "Unlimited active tracked entities",
      "Simulated response forecasting",
      "THEA Access — biometric access control for events & HQs",
      "Full API access for command centers",
      "Dedicated intelligence analyst",
    ],
  },
];

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const [isAnnual, setIsAnnual] = useState(true);

  const handleCTA = (planKey: string) => {
    const interval = isAnnual ? "annual" : "monthly";
    // New visitors sign up first; existing users go straight to method selection.
    if (!isSignedIn) {
      setLocation(`/sign-up?plan=${planKey}&interval=${interval}`);
      return;
    }
    setLocation(`/checkout?plan=${planKey}&interval=${interval}`);
  };

  return (
    <PublicLayout>
      <Seo
        title="Pricing — Intelligence at Scale"
        description="THEA pricing plans for professionals, brands, and political campaigns. Compare Professional, Business, and Political Party tiers billed monthly or annually."
        path="/pricing"
        jsonLd={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />

      <section className="relative px-6 pb-24 pt-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 font-display">
              Intelligence at scale.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Stop reacting to the narrative. Start shaping it. Choose the right intelligence package for your mission.
            </p>
            
            <div className="flex items-center justify-center gap-4">
              <Label htmlFor="billing-toggle" className={`text-sm font-medium ${!isAnnual ? 'text-white' : 'text-muted-foreground'}`}>
                Monthly
              </Label>
              <Switch
                id="billing-toggle"
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
                className="data-[state=checked]:bg-blue-600"
              />
              <Label htmlFor="billing-toggle" className={`text-sm font-medium flex items-center gap-2 ${isAnnual ? 'text-white' : 'text-muted-foreground'}`}>
                Annually
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
                  Save 20%
                </span>
              </Label>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              All plans can be paid by card, PayPal, or cryptocurrency.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {PLANS.map((plan, i) => {
              const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;

              return (
                <motion.div
                  key={plan.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className={`relative flex flex-col p-8 rounded-3xl bg-white/5 border backdrop-blur-sm transition-colors
                    ${plan.recommended 
                      ? 'border-blue-500 shadow-[0_0_40px_-10px_rgba(37,99,235,0.3)]' 
                      : 'border-white/10 hover:border-white/20'}`}
                >
                  {plan.recommended && (
                    <div className="absolute -top-4 left-0 right-0 flex justify-center">
                      <div className="bg-blue-600 text-white text-xs font-bold uppercase tracking-wider py-1 px-4 rounded-full">
                        Recommended
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-2xl font-bold font-display mb-1">{plan.name}</h3>
                    <p className="text-sm text-blue-400 font-medium h-5">{plan.segment}</p>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex items-baseline text-white">
                      <span className="text-3xl font-bold">$</span>
                      <span className="text-5xl font-bold tracking-tight">{price.toLocaleString()}</span>
                      <span className="text-muted-foreground ml-2">/ mo</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {isAnnual ? `Billed $${(price * 12).toLocaleString()} annually` : 'Billed monthly'}
                    </p>
                  </div>

                  <p className="text-muted-foreground mb-8 text-sm leading-relaxed h-10">
                    {plan.description}
                  </p>

                  <Button 
                    className={`w-full h-12 text-base mb-8 ${plan.recommended ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-white text-black hover:bg-gray-200'}`}
                    onClick={() => handleCTA(plan.key)}
                  >
                    Get Started <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>

                  <div className="space-y-4 flex-1">
                    <div className="text-sm font-medium text-white mb-2">What's included:</div>
                    {plan.features.map((feature, j) => (
                      <div key={j} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-blue-400 shrink-0" />
                        <span className="text-sm text-slate-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
