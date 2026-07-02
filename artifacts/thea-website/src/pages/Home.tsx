import React, { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { ChevronDown, Activity, Globe, ShieldAlert, FileText, Zap, Users, Lock, ChevronRight, BarChart3, Database, MessageSquare, Bell, Code, Building, Mic, Briefcase, Eye, GitPullRequest } from "lucide-react";
// @ts-ignore
import logo from "@assets/ChatGPT_Image_Jul_2,_2026,_05_06_19_AM_1782950524488.png";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const AnimatedBackground = () => {
  const prefersReducedMotion = typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background"></div>
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50"></div>
      {!prefersReducedMotion && Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-blue-500/10 blur-xl"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            scale: Math.random() * 2 + 1,
            opacity: Math.random() * 0.3,
          }}
          animate={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            opacity: Math.random() * 0.5 + 0.1,
          }}
          transition={{
            duration: Math.random() * 20 + 10,
            repeat: Infinity,
            repeatType: "reverse",
          }}
          style={{
            width: Math.random() * 300 + 100,
            height: Math.random() * 300 + 100,
          }}
        />
      ))}
    </div>
  );
};

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 backdrop-blur-md border-b border-white/5 bg-background/50">
      <div className="text-xl font-bold tracking-tighter text-white font-display">THEA</div>
      <div className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
        <a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a>
        <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
        <a href="#audiences" className="hover:text-white transition-colors">Audiences</a>
        <a href="#features" className="hover:text-white transition-colors">Features</a>
        <a
          href="/markets/"
          className="relative flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors font-semibold"
          data-testid="link-markets-nav"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          THEA Markets
        </a>
      </div>
      <Button variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300">
        Request Access
      </Button>
    </nav>
  );
};

const Hero = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <section className="relative min-h-[100dvh] flex flex-col items-center justify-center pt-20 overflow-hidden">
      <motion.div 
        style={{ y, opacity }}
        className="flex flex-col items-center z-10 w-full max-w-5xl mx-auto px-6"
      >
        <div className="relative w-64 h-64 md:w-96 md:h-96 mb-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <div className="relative w-full h-full">
              <img src={logo} alt="THEA Logo" className="w-full h-full object-contain" />
              <div
                className="ai-scan absolute flex items-center justify-center overflow-hidden rounded-full"
                style={{ left: "32%", top: "21%", width: "36%", height: "36%" }}
              >
                <div className="ai-eye-glow"></div>
                <div className="ai-radar"></div>
                <div className="ai-scanbar"></div>
                <span className="ai-ping"></span>
                <span className="ai-ping ai-ping--delay"></span>
                <div className="ai-reticle"></div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 font-display text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
            The All-Seeing Intelligence Eye
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
            Total Human Engagement Analytics. We watch the world's conversations and turn them into real-time insight, trend detection, and crisis alerts before they break.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-8 h-14 text-lg">
              Book a Demo
            </Button>
            <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 h-14 text-lg">
              Explore Capabilities
            </Button>
          </div>
        </motion.div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground"
      >
        <ChevronDown className="w-8 h-8 opacity-50" />
      </motion.div>
    </section>
  );
};

const Counter = ({ from, to, duration, suffix = "" }: { from: number, to: number, duration: number, suffix?: string }) => {
  const [count, setCount] = useState(from);
  const nodeRef = useRef<HTMLDivElement>(null);
  const inView = useInView(nodeRef, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!inView) return;
    let start: number | null = null;
    let rafId: number;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / (duration * 1000), 1);
      setCount(Math.floor(progress * (to - from) + from));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [inView, from, to, duration]);

  return <div ref={nodeRef} className="font-mono">{count.toLocaleString()}{suffix}</div>;
};

const Metrics = () => {
  return (
    <section className="py-20 border-y border-white/5 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-white/5">
          <div className="px-4">
            <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-2 flex justify-center">
              <Counter from={0} to={150} duration={2} suffix="K+" />
            </div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sources Monitored</div>
          </div>
          <div className="px-4">
            <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-2 flex justify-center">
              <Counter from={0} to={4} duration={2} suffix="B+" />
            </div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Data Points Daily</div>
          </div>
          <div className="px-4">
            <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-2 flex justify-center">
              &lt;<Counter from={100} to={200} duration={2} suffix="ms" />
            </div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Detection Latency</div>
          </div>
          <div className="px-4">
            <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-2 flex justify-center">
              <Counter from={0} to={75} duration={2} />
            </div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Languages Supported</div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Capabilities = () => {
  const features = [
    {
      icon: <Activity className="w-8 h-8 text-blue-400" />,
      title: "Real-Time Trend Detection",
      desc: "Identify emerging narratives across global social platforms and news outlets before they reach critical mass. THEA spots the ripples before the wave, calculating velocity and vector of conversation shifts."
    },
    {
      icon: <Globe className="w-8 h-8 text-blue-400" />,
      title: "Global Sentiment Analysis",
      desc: "Understand exactly how the world feels. Our NLP engines parse millions of data points per second to quantify public emotion, extracting context, sarcasm, and nuanced sentiment beyond basic positive/negative scores."
    },
    {
      icon: <ShieldAlert className="w-8 h-8 text-blue-400" />,
      title: "Preemptive Crisis Alerts",
      desc: "Don't get blindsided. THEA alerts your team the moment negative volume spikes around your entities, keywords, or executive leadership, routing critical intelligence directly to your command center."
    },
    {
      icon: <FileText className="w-8 h-8 text-blue-400" />,
      title: "AI-Drafted Statements",
      desc: "When seconds matter, THEA automatically generates context-aware talking points, press statements, and rebuttal drafts based on the live threat, matching your organization's established voice and tone."
    }
  ];

  return (
    <section id="capabilities" className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <div className="mb-20 text-center max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 font-display">Perception is Reality.<br/><span className="text-blue-500">Master Both.</span></h2>
          <p className="text-xl text-muted-foreground">
            THEA doesn't just aggregate data; it understands it. Our proprietary neural networks map the global conversation landscape to give you decisive tactical advantages in the information space.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="p-10 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-16 h-16 rounded-xl bg-blue-500/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform border border-blue-500/20">
                {f.icon}
              </div>
              <h3 className="text-2xl font-bold mb-4">{f.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    {
      title: "Collect",
      desc: "Continuous ingestion from global news APIs, major social networks, decentralized forums, subreddits, and thousands of RSS feeds in real-time.",
      icon: <Database className="w-6 h-6 text-blue-400" />
    },
    {
      title: "Analyze",
      desc: "Deep NLP processing evaluates emotional resonance, extracts entities, and scores sentiment across 75+ languages simultaneously.",
      icon: <BarChart3 className="w-6 h-6 text-blue-400" />
    },
    {
      title: "Detect",
      desc: "Anomaly detection models identify sudden spikes in conversation volume or severe negative sentiment shifts against baseline norms.",
      icon: <Eye className="w-6 h-6 text-blue-400" />
    },
    {
      title: "Alert",
      desc: "Intelligent routing pushes severity-graded alerts to your team via Webhook, Slack, Email, or SMS within milliseconds of an event triggering.",
      icon: <Bell className="w-6 h-6 text-blue-400" />
    },
    {
      title: "Act",
      desc: "Generative AI instantly drafts proposed public statements, internal memos, and social media responses tailored to mitigate the specific narrative.",
      icon: <MessageSquare className="w-6 h-6 text-blue-400" />
    }
  ];

  return (
    <section id="how-it-works" className="py-32 px-6 bg-blue-950/10 border-y border-white/5 relative overflow-hidden">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-[600px] bg-blue-500/5 blur-[150px] rounded-full pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-20">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display">The Intelligence Pipeline</h2>
          <p className="text-xl text-muted-foreground max-w-2xl">
            How THEA transforms global noise into tactical clarity. A seamless sequence of ingestion, cognitive analysis, and generative response.
          </p>
        </div>

        <div className="relative">
          <div className="hidden md:block absolute left-8 top-10 bottom-10 w-0.5 bg-gradient-to-b from-blue-500/50 via-blue-500/20 to-transparent"></div>
          
          <div className="space-y-12">
            {steps.map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative pl-0 md:pl-24"
              >
                <div className="hidden md:flex absolute left-0 top-0 w-16 h-16 rounded-full bg-background border border-blue-500/30 items-center justify-center z-10 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                  {step.icon}
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-4 mb-4 md:hidden">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                      {step.icon}
                    </div>
                    <h3 className="text-2xl font-bold">{step.title}</h3>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 hidden md:block">{step.title}</h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const Audiences = () => {
  const audiences = [
    {
      role: "Government & Political",
      icon: <Building className="w-8 h-8 text-blue-400" />,
      problem: "Public sentiment shifts rapidly, and missing an emerging oppositional narrative can derail legislative efforts or campaign momentum.",
      solution: "THEA tracks electorate sentiment geographically, monitors opposition narratives, and alerts campaigns to disinformation before it goes viral.",
      example: "During a debate, THEA instantly detected a localized negative spike regarding a specific policy answer, drafting clarification talking points for post-debate spin rooms."
    },
    {
      role: "PR & Comms Agencies",
      icon: <Mic className="w-8 h-8 text-blue-400" />,
      problem: "Managing dozens of client brands manually requires massive analyst teams and still results in delayed reporting of critical events.",
      solution: "Deliver unparalleled value by providing clients with preemptive crisis alerts and automated daily intelligence briefings generated across all monitored entities.",
      example: "An agency used THEA to alert a Fortune 500 client about a coordinated boycott attempt forming on a niche forum 14 hours before mainstream news picked it up."
    },
    {
      role: "Brand & Reputation Managers",
      icon: <Briefcase className="w-8 h-8 text-blue-400" />,
      problem: "Brand crises often start small. By the time leadership is aware, the narrative is already entrenched in the public consciousness.",
      solution: "Safeguard corporate identity with continuous monitoring of executive mentions, brand sentiment vectors, and competitor controversy.",
      example: "When a product defect rumor surfaced online, THEA immediately alerted the reputation manager and generated a preemptive holding statement for customer service teams."
    },
    {
      role: "Enterprise Marketing Teams",
      icon: <Activity className="w-8 h-8 text-blue-400" />,
      problem: "Campaign effectiveness is hard to measure in real-time, and missing cultural trends means lost opportunities for engagement.",
      solution: "Optimize campaign messaging on the fly. THEA identifies trending topics related to your vertical, allowing marketing to inject the brand into relevant conversations.",
      example: "A retail brand leveraged THEA's trend detection to pivot a major ad spend toward an emerging cultural meme, doubling engagement metrics over the weekend."
    },
    {
      role: "Newsrooms & Media",
      icon: <Globe className="w-8 h-8 text-blue-400" />,
      problem: "Journalists are overwhelmed by the sheer volume of social noise, making it difficult to find verified breaking stories or gauge public reaction accurately.",
      solution: "Discover stories at the source. THEA acts as an automated assignment editor, highlighting anomalous data clusters that indicate real-world events.",
      example: "A major news desk utilized THEA's geolocation anomalies to dispatch reporters to the site of an unannounced protest hours ahead of competing networks."
    }
  ];

  return (
    <section id="audiences" className="py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display">Engineered For The Frontlines</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            If your operational success depends on public perception, THEA is your asymmetric advantage. Tailored intelligence for high-stakes environments.
          </p>
        </div>

        <div className="space-y-16">
          {audiences.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className={`flex flex-col md:flex-row gap-10 items-center ${i % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}
            >
              <div className="w-full md:w-1/2 p-10 bg-white/5 border border-white/10 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-20 pointer-events-none">
                  {a.icon}
                </div>
                <div className="w-16 h-16 rounded-xl bg-blue-500/20 flex items-center justify-center mb-8 border border-blue-500/30">
                  {a.icon}
                </div>
                <h3 className="text-3xl font-bold mb-6">{a.role}</h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2">The Challenge</h4>
                    <p className="text-muted-foreground">{a.problem}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2">The THEA Advantage</h4>
                    <p className="text-muted-foreground">{a.solution}</p>
                  </div>
                </div>
              </div>
              
              <div className="w-full md:w-1/2 p-8 border-l-2 border-blue-500/30 pl-8 md:pl-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Mission Debrief</h4>
                </div>
                <p className="text-xl leading-relaxed italic text-muted-foreground">
                  "{a.example}"
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const PlatformFeatures = () => {
  const features = [
    {
      title: "Watchlist Tracking",
      desc: "Define complex Boolean queries for exact entity tracking. Monitor competitors, executives, product lines, and distinct industry terminology."
    },
    {
      title: "Severity-Graded Alerts",
      desc: "Not every spike is a crisis. THEA classifies alerts from Low (Information) to Critical (Immediate Action) to prevent alert fatigue."
    },
    {
      title: "What-If Simulation",
      desc: "Run predictive simulations on proposed statements to gauge likely public reaction before you hit publish."
    },
    {
      title: "White-Label Reporting",
      desc: "Export gorgeous, data-rich PDF and PPTX intelligence briefs branded for your agency or organization with a single click."
    },
    {
      title: "Enterprise API",
      desc: "Integrate THEA's cognitive engine directly into your existing dashboards, CRMs, or command center software via our robust REST API."
    },
    {
      title: "Custom Webhooks",
      desc: "Trigger automated workflows in Zapier, Slack, Teams, or proprietary systems the moment specific sentiment thresholds are breached."
    }
  ];

  return (
    <section id="features" className="py-32 px-6 bg-black/50 border-y border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display">A Comprehensive Intelligence Suite</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Beyond the core engine, THEA provides the enterprise tooling necessary to operationalize data at scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 bg-background border border-white/10 rounded-xl hover:border-blue-500/50 transition-colors"
            >
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FAQ = () => {
  return (
    <section className="py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display">System Inquiries</h2>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-4">
          <AccordionItem value="item-1" className="border border-white/10 px-6 rounded-lg bg-white/5 data-[state=open]:border-blue-500/50">
            <AccordionTrigger className="text-lg hover:no-underline hover:text-blue-400">What data sources does THEA monitor?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base leading-relaxed">
              THEA ingests data from major social networks (X/Twitter, LinkedIn, TikTok, Facebook), global news APIs covering 150,000+ publications, decentralized networks (Mastodon, Reddit), localized forums, and custom RSS feeds. We process over 4 billion distinct data points daily.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2" className="border border-white/10 px-6 rounded-lg bg-white/5 data-[state=open]:border-blue-500/50">
            <AccordionTrigger className="text-lg hover:no-underline hover:text-blue-400">How fast is the crisis detection?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base leading-relaxed">
              Our streaming architecture evaluates inbound data in sub-second latency. If a critical mass of negative sentiment or anomalous volume occurs, alerts are dispatched within milliseconds. You will know before the broader market does.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3" className="border border-white/10 px-6 rounded-lg bg-white/5 data-[state=open]:border-blue-500/50">
            <AccordionTrigger className="text-lg hover:no-underline hover:text-blue-400">Can THEA mimic our corporate tone for statement drafting?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base leading-relaxed">
              Yes. Enterprise deployments include a fine-tuning phase where THEA ingests your organization's historical press releases, brand guidelines, and executive speech patterns to ensure all generative outputs match your precise corporate voice.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4" className="border border-white/10 px-6 rounded-lg bg-white/5 data-[state=open]:border-blue-500/50">
            <AccordionTrigger className="text-lg hover:no-underline hover:text-blue-400">Is our data and monitoring secure?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base leading-relaxed">
              Absolutely. We operate under strict SOC2 Type II and ISO 27001 compliance. Your watchlists, internal data, and generated statements are siloed, encrypted at rest and in transit, and never used to train the base model.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
};

const MarketsPromo = () => {
  return (
    <section className="py-32 px-6 relative overflow-hidden" id="markets">
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="relative border border-blue-500/30 rounded-2xl p-10 md:p-16 bg-gradient-to-br from-blue-950/40 to-background overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/20 blur-[100px] rounded-full"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-400 text-xs font-semibold uppercase tracking-widest mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                New &amp; Live
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display">
                THEA <span className="text-blue-400">Markets</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
                The pulse of public opinion. Live prediction polls auto-generated from the trends THEA detects across the world's media — vote free, no stakes, pure signal.
              </p>
              <a href="/markets/" data-testid="link-markets-promo">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-8 h-14 text-lg">
                  Explore Markets <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
            </div>
            <div className="flex-1 w-full space-y-3">
              {[
                { q: "Will AI content exceed 50% of social posts by 2027?", pct: 68 },
                { q: "Which sector leads Q3 market gains?", pct: 41 },
                { q: "New global temperature record this summer?", pct: 83 },
              ].map((item, i) => (
                <div key={i} className="border border-white/10 rounded-lg p-4 bg-white/5 backdrop-blur-sm">
                  <div className="text-sm font-medium text-white mb-2">{item.q}</div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400" style={{ width: `${item.pct}%` }}></div>
                  </div>
                  <div className="text-xs text-blue-400 mt-1.5 font-mono">{item.pct}% consensus</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const CTA = () => {
  return (
    <section className="py-40 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-blue-600/10"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 blur-[120px] rounded-full z-0"></div>
      
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 className="text-5xl md:text-7xl font-bold mb-8 font-display">See What They Are Saying.</h2>
        <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          Join the world's most elite organizations relying on THEA for total situational awareness. Stop reacting. Start anticipating.
        </p>
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Button size="lg" className="bg-white text-black hover:bg-gray-200 px-10 h-16 text-xl rounded-full">
            Request Enterprise Access <ChevronRight className="ml-2 w-6 h-6" />
          </Button>
          <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 px-10 h-16 text-xl rounded-full">
            View API Documentation
          </Button>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="border-t border-white/10 py-16 px-8 bg-background">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col items-center md:items-start">
          <div className="font-display font-bold text-3xl tracking-tighter mb-2">THEA</div>
          <div className="text-sm text-muted-foreground">
            Total Human Engagement Analytics
          </div>
        </div>
        
        <div className="flex gap-8 text-sm text-muted-foreground">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Security</a>
        </div>
        
        <div className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} THEA Intelligence. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default function Home() {
  return (
    <div className="min-h-[100dvh] text-foreground selection:bg-blue-500/30">
      <AnimatedBackground />
      <Navbar />
      <main>
        <Hero />
        <Metrics />
        <Capabilities />
        <HowItWorks />
        <Audiences />
        <PlatformFeatures />
        <MarketsPromo />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
