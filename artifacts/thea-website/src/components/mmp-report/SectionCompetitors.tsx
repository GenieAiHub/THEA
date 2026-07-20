import { COMPETITORS } from "@/content/mmp-report";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

export function SectionCompetitors() {
  return (
    <section id="competitors" className="scroll-mt-32">
      <div className="mb-12">
        <h2 className="text-3xl font-display font-bold text-white mb-4">Competitor Matrix</h2>
        <p className="text-slate-400 max-w-3xl">
          Strategic positioning, core strengths, and critical vulnerabilities across the top 8 challengers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {COMPETITORS.map((comp, idx) => (
          <motion.div
            key={comp.key}
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.05, duration: 0.4 }}
            className="bg-gradient-to-br from-slate-900/80 to-[#020617] border border-slate-800 rounded-xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-800 bg-slate-900/40">
              <h3 className="text-xl font-display font-semibold text-white mb-2">{comp.name}</h3>
              <p className="text-sm text-slate-400">{comp.focus}</p>
            </div>
            <div className="p-6 flex-1 flex flex-col gap-6">
              <div>
                <h4 className="text-xs font-mono text-emerald-500/80 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Check className="w-3 h-3" /> Strengths
                </h4>
                <ul className="space-y-2">
                  {comp.strengths.map((str, i) => (
                    <li key={i} className="text-sm text-slate-300 leading-snug flex items-start gap-2">
                      <span className="text-emerald-500/50 mt-1 opacity-50">•</span> {str}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-auto">
                <h4 className="text-xs font-mono text-rose-500/80 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <X className="w-3 h-3" /> Weaknesses
                </h4>
                <ul className="space-y-2">
                  {comp.weaknesses.map((wk, i) => (
                    <li key={i} className="text-sm text-slate-400 leading-snug flex items-start gap-2">
                      <span className="text-rose-500/50 mt-1 opacity-50">•</span> {wk}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
