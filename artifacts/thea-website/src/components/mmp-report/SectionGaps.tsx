import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { MARKET_GAPS, GAP_TIER_LABELS, GapTier } from "@/content/mmp-report";

const TIER_STYLES: Record<GapTier, { badge: string; ring: string }> = {
  hot: {
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    ring: "border-rose-500/30",
  },
  warm: {
    badge: "bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/20",
    ring: "border-[#d4af37]/30",
  },
  future: {
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ring: "border-blue-500/30",
  },
};

function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Difficulty ${level} of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= level ? "text-[#d4af37] fill-[#d4af37]" : "text-slate-700"}`}
        />
      ))}
    </div>
  );
}

export function SectionGaps() {
  const [filter, setFilter] = useState<GapTier | "all">("all");

  const filteredGaps = useMemo(
    () => MARKET_GAPS.filter(g => filter === "all" || g.tier === filter),
    [filter],
  );

  return (
    <section id="gaps" className="scroll-mt-32">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white mb-4">Market Gaps</h2>
          <p className="text-slate-400 max-w-2xl">
            Fourteen opportunities the incumbents have left open, ranked by priority — a
            combination of market size, competitive whitespace, and feasibility.
          </p>
        </div>

        <div className="flex bg-slate-900 p-1 rounded-md border border-slate-800 w-full sm:w-auto overflow-x-auto self-start md:self-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${filter === "all" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}
          >
            All
          </button>
          {(Object.entries(GAP_TIER_LABELS) as [GapTier, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${filter === key ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {filteredGaps.map((gap, idx) => {
          const styles = TIER_STYLES[gap.tier];
          return (
            <motion.article
              key={gap.priority}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: Math.min(idx * 0.04, 0.3) }}
              className={`bg-slate-900/30 border ${styles.ring} rounded-xl p-6 lg:p-8 hover:bg-slate-900/50 transition-colors`}
            >
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="font-mono text-2xl font-bold text-white/90 tabular-nums">
                  {String(gap.priority).padStart(2, "0")}
                </span>
                <h3 className="text-xl font-display font-semibold text-white flex-1 min-w-[200px]">
                  {gap.name}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${styles.badge}`}
                >
                  {GAP_TIER_LABELS[gap.tier]}
                </span>
                <DifficultyStars level={gap.difficulty} />
              </div>

              <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                    What's missing
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{gap.whatsMissing}</p>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                    What to build
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{gap.whatToBuild}</p>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-slate-800/70 grid sm:grid-cols-2 gap-x-8 gap-y-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mr-2">
                    Clients
                  </span>
                  <span className="text-sm text-slate-300">{gap.clients}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mr-2">
                    Revenue model
                  </span>
                  <span className="text-sm text-[#d4af37]/90">{gap.revenueModel}</span>
                </div>
                {gap.aiCost && (
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mr-2">
                      AI cost
                    </span>
                    <span className="text-sm text-slate-400">{gap.aiCost}</span>
                  </div>
                )}
                {gap.whyRanked && (
                  <div className="sm:col-span-2 bg-[#d4af37]/5 border border-[#d4af37]/15 rounded-lg px-4 py-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#d4af37] mr-2">
                      Why ranked #{gap.priority}
                    </span>
                    <span className="text-sm text-slate-300">{gap.whyRanked}</span>
                  </div>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
