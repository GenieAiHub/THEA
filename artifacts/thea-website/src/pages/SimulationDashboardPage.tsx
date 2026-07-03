import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  Database,
  Network,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Radar,
  RotateCw,
  ArrowRight,
  Newspaper,
  Users,
  Landmark,
  FlaskConical,
  LineChart,
  TrendingUp,
  Globe2,
  Cpu,
  Leaf,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { IntelGlobe } from "@/components/simulation/IntelGlobe";

interface Phase {
  key: string;
  label: string;
  sub: string;
  icon: ReactNode;
  start: number;
}

const PHASES: Phase[] = [
  { key: "searching", label: "Searching", sub: "Scanning global data sources", icon: <Search className="w-4 h-4" />, start: 0 },
  { key: "collecting", label: "Collecting", sub: "Gathering relevant information", icon: <Database className="w-4 h-4" />, start: 20 },
  { key: "analyzing", label: "Analyzing", sub: "AI analyzing patterns & trends", icon: <Network className="w-4 h-4" />, start: 45 },
  { key: "summarizing", label: "Summarizing", sub: "Generating key insights", icon: <FileText className="w-4 h-4" />, start: 72 },
  { key: "completed", label: "Completed", sub: "Analysis complete", icon: <CheckCircle2 className="w-4 h-4" />, start: 100 },
];

const CENTER_LABEL: Record<string, string> = {
  searching: "Searching Worldwide Data",
  collecting: "Collecting Source Data",
  analyzing: "Analyzing Patterns & Trends",
  summarizing: "Summarizing Key Insights",
  completed: "Analysis Complete",
};

const SOURCES: { label: string; icon: ReactNode }[] = [
  { label: "News", icon: <Newspaper className="w-4 h-4" /> },
  { label: "Social Media", icon: <Users className="w-4 h-4" /> },
  { label: "Government", icon: <Landmark className="w-4 h-4" /> },
  { label: "Research", icon: <FlaskConical className="w-4 h-4" /> },
  { label: "Markets", icon: <LineChart className="w-4 h-4" /> },
  { label: "Public Data", icon: <Database className="w-4 h-4" /> },
];

const INSIGHTS: { label: string; target: number; icon: ReactNode }[] = [
  { label: "Economic Trends", target: 68, icon: <TrendingUp className="w-4 h-4" /> },
  { label: "Geopolitical Events", target: 52, icon: <Globe2 className="w-4 h-4" /> },
  { label: "Market Movements", target: 49, icon: <LineChart className="w-4 h-4" /> },
  { label: "Technology Advances", target: 61, icon: <Cpu className="w-4 h-4" /> },
  { label: "Environmental Changes", target: 44, icon: <Leaf className="w-4 h-4" /> },
];

const TOTAL_SOURCES = 12523;
const TOTAL_SECONDS = 45;

function phaseIndexFor(progress: number): number {
  if (progress >= 100) return 4;
  let idx = 0;
  for (let i = 0; i < 4; i++) {
    if (progress >= PHASES[i].start) idx = i;
  }
  return idx;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
      {children}
    </div>
  );
}

export function SimulationDashboardBody() {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(true);
  const [activeSource, setActiveSource] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setProgress((p) => (p >= 100 ? 100 : Math.min(100, p + (0.12 + Math.random() * 0.29))));
    }, 120);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (progress >= 100 && running) setRunning(false);
  }, [progress, running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setActiveSource((s) => (s + 1) % SOURCES.length), 1500);
    return () => clearInterval(id);
  }, [running]);

  const phaseIdx = phaseIndexFor(progress);
  const phase = PHASES[phaseIdx];
  const complete = progress >= 100;
  const scanned = Math.round((progress / 100) * TOTAL_SOURCES);
  const remainingSec = complete ? 0 : Math.max(0, Math.round(((100 - progress) / 100) * TOTAL_SECONDS));
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, "0");
  const ss = String(remainingSec % 60).padStart(2, "0");

  const utc = now.toISOString().slice(11, 19);
  const dateStr = now.toUTCString().slice(5, 16);

  const restart = () => {
    setProgress(0);
    setActiveSource(0);
    setRunning(true);
  };

  return (
    <div className="relative">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(96,165,250,0.35) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* Header strip */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10">
              <Radar className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-wide text-slate-100">
                GLOBAL DATA ANALYSIS
              </h1>
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                AI Powered · Real Time · Worldwide
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-right">
              <div className="font-mono text-sm tabular-nums text-slate-200">
                {utc} <span className="text-slate-500">UTC</span>
              </div>
              <div className="text-[11px] text-slate-500">{dateStr}</div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <span className="relative flex h-2 w-2">
                {running && (
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full ${complete ? "bg-emerald-400" : "bg-blue-400"} opacity-75`}
                  />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${complete ? "bg-emerald-400" : "bg-blue-400"}`}
                />
              </span>
              <span className="text-xs font-medium text-slate-300">
                AI ENGINE{" "}
                <span className={complete ? "text-emerald-400" : "text-blue-400"}>
                  {complete ? "COMPLETE" : "ACTIVE"}
                </span>
              </span>
            </div>
            <button
              onClick={restart}
              className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-600/10 px-3 py-2 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-600/20"
            >
              <RotateCw className="h-3.5 w-3.5" /> Run Again
            </button>
          </div>
        </div>

        {/* Grid */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,300px)]"
        >
          {/* Left — pipeline */}
          <Panel>
            <PanelTitle>Analysis Pipeline</PanelTitle>
            <div className="relative mt-5">
              {PHASES.map((ph, i) => {
                const state = i < phaseIdx ? "done" : i === phaseIdx ? "active" : "todo";
                return (
                  <div key={ph.key} className="relative flex gap-3 pb-6 last:pb-0">
                    {i < PHASES.length - 1 && (
                      <span
                        className={`absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px ${
                          i < phaseIdx ? "bg-blue-500/50" : "bg-slate-800"
                        }`}
                      />
                    )}
                    <div
                      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                        state === "done"
                          ? "border-blue-500/60 bg-blue-500/15 text-blue-300"
                          : state === "active"
                            ? "border-blue-400 bg-blue-500/20 text-blue-200"
                            : "border-slate-700 bg-slate-900 text-slate-600"
                      }`}
                    >
                      {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : ph.icon}
                      {state === "active" && (
                        <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-blue-400/40" />
                      )}
                    </div>
                    <div className="pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-600">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`text-sm font-medium ${state === "todo" ? "text-slate-500" : "text-slate-100"}`}
                        >
                          {ph.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{ph.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-[11px] uppercase tracking-widest text-slate-500">
                Estimated Time
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                {mm}:{ss}{" "}
                <span className="font-sans text-xs font-normal text-slate-500">remaining</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> Secure Connection
            </div>
          </Panel>

          {/* Center — globe */}
          <Panel className="flex flex-col items-center">
            <div className="relative mx-auto aspect-square w-[360px] max-w-full">
              <div className="absolute inset-0">
                <IntelGlobe size={360} />
              </div>
              <span className="ai-reticle" />
              <span className="ai-ping" />
              <span className="ai-ping ai-ping--delay" />
            </div>

            <div className="mt-4 w-full">
              <div className="flex items-end justify-between">
                <div className="text-sm font-medium uppercase tracking-wider text-slate-300">
                  {CENTER_LABEL[phase.key]}
                </div>
                <div className="font-display text-3xl font-bold tabular-nums text-blue-400">
                  {Math.round(progress)}%
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Scanning{" "}
                <span className="tabular-nums text-slate-300">{scanned.toLocaleString()}</span> of{" "}
                {TOTAL_SOURCES.toLocaleString()}+ sources across 195 countries
              </p>
            </div>

            <div className="mt-4 grid w-full grid-cols-3 gap-2 sm:grid-cols-6">
              {SOURCES.map((s, i) => {
                const on = i === activeSource && running;
                return (
                  <div
                    key={s.label}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors ${
                      on
                        ? "border-blue-500/50 bg-blue-600/10 text-blue-300"
                        : "border-slate-800 bg-slate-950/40 text-slate-500"
                    }`}
                  >
                    {s.icon}
                    <span className="text-[10px] leading-tight">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Right — live insight preview */}
          <Panel>
            <PanelTitle>Live Insight Preview</PanelTitle>
            <div className="mt-4 flex flex-col items-center text-center">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-blue-500/20" />
                {!complete && (
                  <>
                    <span className="ai-ping" />
                    <span className="ai-ping ai-ping--delay" />
                  </>
                )}
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full border ${
                    complete
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-blue-500/40 bg-blue-500/10"
                  }`}
                >
                  {complete ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-300" />
                  ) : (
                    <FileText className="h-6 w-6 text-blue-300" />
                  )}
                </div>
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-100">
                {complete ? "Insights Ready" : "AI is Generating Insights"}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {complete
                  ? "Key patterns and summaries have been extracted from global data."
                  : "Extracting key patterns and summaries from global data."}
              </p>
            </div>

            <div className="mt-6">
              <div className="mb-3 text-[11px] uppercase tracking-widest text-slate-500">
                Insight Categories
              </div>
              <div className="space-y-3">
                {INSIGHTS.map((it) => {
                  const val = Math.round((it.target * progress) / 100);
                  return (
                    <div key={it.label}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-400">
                          {it.icon}
                          {it.label}
                        </span>
                        <span className="tabular-nums text-slate-300">{val}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-[width] duration-200"
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {complete ? (
              <Link
                href="/intelligence"
                className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-blue-500/50 bg-blue-600/20 px-4 py-3 text-sm font-semibold text-blue-200 transition-colors hover:bg-blue-600/30"
              >
                View Result <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="mt-6 flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-600">
                <Lock className="h-4 w-4" /> View Result{" "}
                <span className="text-slate-700">(Available Once Complete)</span>
              </div>
            )}
          </Panel>
        </motion.div>
      </div>
  );
}

export default function SimulationDashboardPage() {
  return (
    <DashboardLayout title="Simulation Dashboard">
      <SimulationDashboardBody />
    </DashboardLayout>
  );
}
