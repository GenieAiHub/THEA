import React, { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { 
  ChevronDown, Activity, Globe, ShieldAlert, FileText, 
  Database, BarChart3, Eye, Bell, MessageSquare, 
  Building, Mic, Briefcase, ChevronRight, Target,
  Radio, Shield, LineChart, Network
} from "lucide-react";
import { Link } from "wouter";
import { AreaChart, Area, ResponsiveContainer, LineChart as RechartsLineChart, Line } from "recharts";

// @ts-ignore
import logo from "@assets/thea-logo.png";
import { MARKETS_URL } from "@/lib/urls";
// @ts-ignore
import heroEarth from "@assets/generated_images/hero_earth.png";
// @ts-ignore
import radarSignals from "@assets/generated_images/radar_signals.png";
// @ts-ignore
import commandCenter from "@assets/generated_images/command_center.png";
// @ts-ignore
import neuralNetwork from "@assets/generated_images/neural_network.png";
// @ts-ignore
import glowingWorld from "@assets/generated_images/glowing_world.png";

import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

// --- Data Viz Mockups ---

const sentimentData = [
  { time: "00:00", value: 30 }, { time: "04:00", value: 45 }, { time: "08:00", value: 35 },
  { time: "12:00", value: 80 }, { time: "16:00", value: 65 }, { time: "20:00", value: 95 }
];

const SentimentWidget = () => (
  <motion.div 
    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}
    className="absolute -top-6 right-0 w-56 p-4 rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-[0_0_30px_rgba(59,130,246,0.15)] z-20"
  >
    <div className="flex justify-between items-center mb-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-medium text-white uppercase tracking-wider">Global Sentiment</span>
      </div>
      <span className="text-xs text-green-400 font-bold">+24%</span>
    </div>
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sentimentData}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </motion.div>
);

const AlertStreamWidget = () => {
  const [alerts] = useState([
    { id: 1, text: "Anomalous volume spike: 'Supply Chain'", time: "Just now", severity: "high" },
    { id: 2, text: "Negative sentiment shift detected", time: "2m ago", severity: "medium" }
  ]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
      className="absolute -bottom-8 left-0 w-64 p-4 rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-[0_0_30px_rgba(59,130,246,0.15)] z-20"
    >
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-4 h-4 text-red-400" />
        <span className="text-xs font-medium text-white uppercase tracking-wider">Live Alerts</span>
      </div>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div key={alert.id} className="p-2 rounded bg-white/5 border border-white/5 flex flex-col gap-1">
            <span className="text-xs text-white line-clamp-1">{alert.text}</span>
            <span className="text-[10px] text-muted-foreground">{alert.time}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// --- Page Components ---

const Hero = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 800], [0, 200]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <section className="relative min-h-[100dvh] flex items-center justify-center pt-20 overflow-hidden">
      {/* Background with Generated Image */}
      <motion.div style={{ y, opacity }} className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-background/60 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent z-10" />
        <img src={heroEarth} alt="Earth from space" className="w-full h-full object-cover opacity-60" />
      </motion.div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center mt-12 md:mt-0">
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-left"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <Radio className="w-4 h-4" /> Global Intelligence Platform
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 font-display text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-blue-200 leading-[1.1]">
            The All-Seeing <br />Intelligence Eye
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-10 leading-relaxed font-light">
            Total Human Engagement Analytics. We watch the world's conversations and turn them into real-time insight, trend detection, and crisis alerts before they break.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-8 h-14 text-lg shadow-[0_0_20px_rgba(59,130,246,0.3)]" asChild>
              <Link href="/sign-up">Book a Demo</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 h-14 text-lg bg-black/20 backdrop-blur-sm" asChild>
              <a href="#capabilities">Explore Capabilities</a>
            </Button>
          </div>
        </motion.div>

        <div className="relative h-[400px] md:h-[500px] flex items-center justify-center mt-10 lg:mt-0">
          <div className="hidden md:block">
            <SentimentWidget />
            <AlertStreamWidget />
          </div>
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="relative w-72 h-72 md:w-[450px] md:h-[450px]"
          >
            <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full" />
            <img src={logo} alt="THEA Logo" className="w-full h-full object-contain relative z-10 logo-pulse" />
            <div
              className="ai-scan absolute flex items-center justify-center overflow-hidden rounded-full z-20"
              style={{ left: "32%", top: "21%", width: "36%", height: "36%" }}
            >
              <div className="ai-eye-glow"></div>
              <div className="ai-radar"></div>
              <div className="ai-scanbar"></div>
              <span className="ai-ping"></span>
              <span className="ai-ping ai-ping--delay"></span>
              <div className="ai-reticle"></div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground z-10"
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
    <section className="py-20 border-y border-white/5 bg-black/40 relative z-10 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-white/5">
          <div className="px-4">
            <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-2 flex justify-center drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Counter from={0} to={150} duration={2} suffix="K+" />
            </div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sources Monitored</div>
          </div>
          <div className="px-4">
            <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-2 flex justify-center drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Counter from={0} to={4} duration={2} suffix="B+" />
            </div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Data Points Daily</div>
          </div>
          <div className="px-4">
            <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-2 flex justify-center drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              &lt;<Counter from={100} to={200} duration={2} suffix="ms" />
            </div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Detection Latency</div>
          </div>
          <div className="px-4">
            <div className="text-4xl md:text-5xl font-bold text-blue-400 mb-2 flex justify-center drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Counter from={0} to={75} duration={2} suffix="+" />
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
      desc: "Understand exactly how the world feels. Our NLP engines parse millions of data points per second to quantify public emotion, extracting context, sarcasm, and nuanced sentiment beyond basic scores."
    },
    {
      icon: <ShieldAlert className="w-8 h-8 text-blue-400" />,
      title: "Preemptive Crisis Alerts",
      desc: "Don't get blindsided. THEA alerts your team the moment negative volume spikes around your entities, keywords, or executive leadership, routing critical intelligence directly to your command center."
    },
    {
      icon: <FileText className="w-8 h-8 text-blue-400" />,
      title: "AI-Drafted Statements",
      desc: "When seconds matter, THEA automatically generates context-aware talking points, press statements, and rebuttal drafts based on the live threat, matching your established voice and tone."
    }
  ];

  return (
    <section id="capabilities" className="scroll-mt-20 py-32 px-6 relative overflow-hidden bg-background">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-background z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-background to-transparent z-10" />
        <img src={glowingWorld} alt="" loading="lazy" className="w-full h-full object-cover mix-blend-screen" />
      </div>

      <div className="max-w-7xl mx-auto relative z-20">
        <div className="mb-20 max-w-4xl">
          <h2 className="text-4xl md:text-6xl font-bold mb-6 font-display">Perception is Reality.<br/><span className="text-blue-500 drop-shadow-[0_0_25px_rgba(59,130,246,0.4)]">Master Both.</span></h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
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
              className="p-10 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/5 hover:border-blue-500/50 transition-all group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-16 h-16 rounded-xl bg-blue-500/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all border border-blue-500/20">
                {f.icon}
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-blue-200 transition-colors">{f.title}</h3>
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
    <section id="how-it-works" className="scroll-mt-20 py-32 px-6 border-y border-white/5 relative overflow-hidden bg-background">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <img src={neuralNetwork} alt="" loading="lazy" className="w-full h-full object-cover mix-blend-screen" />
        <div className="absolute inset-0 bg-background/80" />
      </div>
      
      <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-16 items-center">
        <div className="mb-20 lg:mb-0">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display">The Intelligence Pipeline</h2>
          <p className="text-xl text-muted-foreground mb-8">
            How THEA transforms global noise into tactical clarity. A seamless sequence of ingestion, cognitive analysis, and generative response.
          </p>
          <div className="h-64 w-full rounded-2xl border border-white/10 bg-black/50 p-6 flex flex-col justify-end relative overflow-hidden">
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px]" />
             <ResponsiveContainer width="100%" height="100%">
               <RechartsLineChart data={sentimentData}>
                 <Line type="stepAfter" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: "#000", stroke: "#3b82f6", strokeWidth: 2 }} />
               </RechartsLineChart>
             </ResponsiveContainer>
          </div>
        </div>

        <div className="relative">
          <div className="hidden md:block absolute left-8 top-10 bottom-10 w-0.5 bg-gradient-to-b from-blue-500/50 via-blue-500/20 to-transparent"></div>
          
          <div className="space-y-8">
            {steps.map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative pl-0 md:pl-24 group"
              >
                <div className="hidden md:flex absolute left-0 top-0 w-16 h-16 rounded-full bg-background border border-blue-500/30 items-center justify-center z-10 shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:scale-110 transition-transform group-hover:border-blue-500/80">
                  {step.icon}
                </div>
                
                <div className="bg-black/40 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:bg-white/5 hover:border-white/20 transition-colors">
                  <div className="flex items-center gap-4 mb-2 md:hidden">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                      {step.icon}
                    </div>
                    <h3 className="text-xl font-bold">{step.title}</h3>
                  </div>
                  <h3 className="text-xl font-bold mb-2 hidden md:block text-white group-hover:text-blue-300 transition-colors">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
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
    <section id="audiences" className="py-32 px-6 relative bg-background">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <img src={commandCenter} alt="" loading="lazy" className="w-full h-full object-cover grayscale" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display drop-shadow-lg">Engineered For The Frontlines</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            If your operational success depends on public perception, THEA is your asymmetric advantage. Tailored intelligence for high-stakes environments.
          </p>
        </div>

        <div className="space-y-8">
          {audiences.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6 }}
              className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 lg:p-12 overflow-hidden relative group hover:border-blue-500/30 transition-all"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none scale-150 transform translate-x-8 -translate-y-8">
                {a.icon}
              </div>
              <div className="flex flex-col lg:flex-row gap-12">
                <div className="lg:w-1/3">
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
                    {a.icon}
                  </div>
                  <h3 className="text-3xl font-bold mb-4">{a.role}</h3>
                </div>
                <div className="lg:w-2/3 grid md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Target className="w-4 h-4"/> The Challenge</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">{a.problem}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Shield className="w-4 h-4"/> The THEA Advantage</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">{a.solution}</p>
                  </div>
                  <div className="md:col-span-2 p-6 rounded-xl bg-blue-950/20 border border-blue-500/20 mt-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-widest">Mission Debrief</h4>
                    </div>
                    <p className="text-base leading-relaxed italic text-blue-100/70">
                      "{a.example}"
                    </p>
                  </div>
                </div>
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
    { title: "Watchlist Tracking", desc: "Define complex Boolean queries for exact entity tracking. Monitor competitors, executives, product lines, and distinct industry terminology." },
    { title: "Severity-Graded Alerts", desc: "Not every spike is a crisis. THEA classifies alerts from Low (Information) to Critical (Immediate Action) to prevent alert fatigue." },
    { title: "What-If Simulation", desc: "Run predictive simulations on proposed statements to gauge likely public reaction before you hit publish." },
    { title: "White-Label Reporting", desc: "Export gorgeous, data-rich PDF and PPTX intelligence briefs branded for your agency or organization with a single click." },
    { title: "Enterprise API", desc: "Integrate THEA's cognitive engine directly into your existing dashboards, CRMs, or command center software via our robust REST API." },
    { title: "Custom Webhooks", desc: "Trigger automated workflows in Zapier, Slack, Teams, or proprietary systems the moment specific sentiment thresholds are breached." }
  ];

  return (
    <section id="features" className="py-32 px-6 bg-black/80 border-y border-white/5 relative">
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
              className="p-8 bg-white/[0.02] border border-white/10 rounded-xl hover:bg-white/[0.04] hover:border-blue-500/50 transition-all"
            >
              <h3 className="text-xl font-bold mb-3 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const MarketsPromo = () => {
  return (
    <section id="markets" className="scroll-mt-20 py-24 px-6 relative overflow-hidden border-b border-white/5 bg-background">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <img src={radarSignals} alt="" loading="lazy" className="w-full h-full object-cover mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-r from-background to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-12 bg-blue-950/20 border border-blue-500/20 rounded-3xl p-10 md:p-16 backdrop-blur-xl">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-6 border border-blue-500/30">
            <LineChart className="w-4 h-4" /> Introducing
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display text-white">THEA Markets</h2>
          <p className="text-lg text-blue-100/70 mb-8 leading-relaxed">
            The pulse of public opinion. Live prediction polls auto-generated from the trends THEA detects across the world's media — vote free, no stakes, pure signal.
          </p>
          <Button size="lg" className="bg-white text-black hover:bg-white/90 px-8" asChild>
            <a href={MARKETS_URL} data-testid="link-markets-promo">
              Explore THEA Markets <ChevronRight className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>
        <div className="w-full md:w-1/3 aspect-square relative flex items-center justify-center">
           <div className="absolute inset-0 bg-blue-500/20 blur-[80px] rounded-full animate-pulse" />
           <Network className="w-32 h-32 text-blue-400 relative z-10 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]" />
        </div>
      </div>
    </section>
  );
};

const FAQ = () => {
  return (
    <section className="py-32 px-6 bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 font-display">System Inquiries</h2>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-4">
          <AccordionItem value="item-1" className="border border-white/10 px-6 rounded-lg bg-white/5 data-[state=open]:border-blue-500/50 data-[state=open]:bg-white/10 transition-all">
            <AccordionTrigger className="text-lg hover:no-underline hover:text-blue-400">What data sources does THEA monitor?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base leading-relaxed pt-2 pb-6">
              THEA ingests data from major social networks (X/Twitter, LinkedIn, TikTok, Facebook), global news APIs covering 150,000+ publications, decentralized networks (Mastodon, Reddit), localized forums, and custom RSS feeds. We process over 4 billion distinct data points daily.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2" className="border border-white/10 px-6 rounded-lg bg-white/5 data-[state=open]:border-blue-500/50 data-[state=open]:bg-white/10 transition-all">
            <AccordionTrigger className="text-lg hover:no-underline hover:text-blue-400">How fast is the crisis detection?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base leading-relaxed pt-2 pb-6">
              Our streaming architecture evaluates inbound data in sub-second latency. If a critical mass of negative sentiment or anomalous volume occurs, alerts are dispatched within milliseconds. You will know before the broader market does.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3" className="border border-white/10 px-6 rounded-lg bg-white/5 data-[state=open]:border-blue-500/50 data-[state=open]:bg-white/10 transition-all">
            <AccordionTrigger className="text-lg hover:no-underline hover:text-blue-400">Can THEA mimic our corporate tone for statement drafting?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base leading-relaxed pt-2 pb-6">
              Yes. Enterprise deployments include a fine-tuning phase where THEA ingests your organization's historical press releases, brand guidelines, and executive speech patterns to ensure all generative outputs match your precise corporate voice.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4" className="border border-white/10 px-6 rounded-lg bg-white/5 data-[state=open]:border-blue-500/50 data-[state=open]:bg-white/10 transition-all">
            <AccordionTrigger className="text-lg hover:no-underline hover:text-blue-400">Is our data and monitoring secure?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-base leading-relaxed pt-2 pb-6">
              Absolutely. We operate under strict SOC2 Type II and ISO 27001 compliance. Your watchlists, internal data, and generated statements are siloed, encrypted at rest and in transit, and never used to train the base model.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
};

const CTA = () => {
  return (
    <section className="py-32 px-6 relative overflow-hidden bg-blue-950/20 border-t border-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-background to-background pointer-events-none" />
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 className="text-5xl md:text-6xl font-bold mb-8 font-display text-white drop-shadow-md">Command The Narrative</h2>
        <p className="text-xl md:text-2xl text-blue-100/70 mb-10 max-w-2xl mx-auto">
          Deploy the world's most advanced intelligence engine and turn global data into an asymmetric advantage.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-10 h-16 text-xl shadow-[0_0_30px_rgba(59,130,246,0.4)]" asChild>
            <Link href="/pricing">Book Enterprise Demo</Link>
          </Button>
          <Button size="lg" variant="outline" className="border-white/20 hover:bg-white/10 hover:text-white px-10 h-16 text-xl" asChild>
            <Link href="/sign-up">Create Account</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  return (
    <PublicLayout>
      <Seo
        title="THEA — The All-Seeing Intelligence Eye"
        description="THEA (Total Human Engagement Analytics) monitors 150,000+ global sources in real time to deliver trend detection, sentiment analysis, and preemptive crisis alerts — with AI-drafted responses."
        path="/"
        jsonLd={[organizationJsonLd(), websiteJsonLd()]}
      />
      <Hero />
      <Metrics />
      <Capabilities />
      <HowItWorks />
      <Audiences />
      <PlatformFeatures />
      <MarketsPromo />
      <FAQ />
      <CTA />
    </PublicLayout>
  );
}
