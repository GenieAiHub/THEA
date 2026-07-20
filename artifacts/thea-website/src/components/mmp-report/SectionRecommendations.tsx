import { motion } from "framer-motion";
import { RECOMMENDATIONS } from "@/content/mmp-report";

export function SectionRecommendations() {
  return (
    <section id="recommendations" className="scroll-mt-32">
      <div className="mb-10">
        <div className="text-xs font-mono uppercase tracking-[0.3em] text-[#d4af37] mb-3">
          The verdict
        </div>
        <h2 className="text-3xl font-display font-bold text-white mb-4">
          Recommended Starting Point
        </h2>
        <p className="text-slate-400 max-w-2xl">
          Of the fourteen gaps, three combine low competition, clear demand, and a credible
          path to revenue. Build them in this order.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {RECOMMENDATIONS.map((rec, idx) => (
          <motion.div
            key={rec.rank}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: idx * 0.1 }}
            className={`relative rounded-xl border p-6 lg:p-8 overflow-hidden ${
              rec.rank === 1
                ? "bg-gradient-to-br from-[#d4af37]/10 via-slate-900/40 to-slate-900/40 border-[#d4af37]/40"
                : "bg-slate-900/30 border-slate-800"
            }`}
          >
            <div className="flex items-start gap-6">
              <div
                className={`shrink-0 w-14 h-14 rounded-full border flex items-center justify-center font-display text-2xl font-bold ${
                  rec.rank === 1
                    ? "border-[#d4af37]/60 text-[#d4af37] bg-[#d4af37]/10"
                    : "border-slate-700 text-slate-300 bg-slate-900/60"
                }`}
              >
                {rec.rank}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h3 className="text-xl font-display font-semibold text-white">{rec.name}</h3>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 border border-slate-800 rounded px-2 py-0.5">
                    Gap #{rec.gapPriority}
                  </span>
                </div>
                <p className="text-sm lg:text-base text-slate-300 leading-relaxed">
                  {rec.rationale}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
