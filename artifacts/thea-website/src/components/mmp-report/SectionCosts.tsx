import { motion } from "framer-motion";
import { COST_CATEGORIES, COST_TIER_ESTIMATES } from "@/content/mmp-report";

export function SectionCosts() {
  return (
    <section id="costs" className="scroll-mt-32">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold text-white mb-4">
          Third-Party AI Cost Model
        </h2>
        <p className="text-slate-400 max-w-2xl">
          The external AI and data spend required to power the intelligence layer, from unit
          pricing per category to blended monthly estimates at three customer scales.
        </p>
      </div>

      <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden mb-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800 text-xs font-mono uppercase text-slate-500 tracking-wider">
                <th className="p-4 font-medium min-w-[220px]">Cost category</th>
                <th className="p-4 font-medium min-w-[260px]">Used for</th>
                <th className="p-4 font-medium min-w-[200px]">Unit pricing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {COST_CATEGORIES.map(cat => (
                <tr key={cat.name} className="hover:bg-slate-800/20 transition-colors">
                  <td className="p-4 font-medium text-slate-200">{cat.name}</td>
                  <td className="p-4 text-sm text-slate-400">{cat.usedFor}</td>
                  <td className="p-4 text-sm font-mono text-[#d4af37]/90 whitespace-nowrap">
                    {cat.unitPricing}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {COST_TIER_ESTIMATES.map((tier, idx) => (
          <motion.div
            key={tier.tier}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: idx * 0.08 }}
            className={`rounded-xl border p-6 flex flex-col gap-4 ${
              idx === 1
                ? "bg-[#d4af37]/5 border-[#d4af37]/25"
                : "bg-slate-900/30 border-slate-800"
            }`}
          >
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1">
                {tier.tier}
              </div>
              <div className="text-lg font-display font-semibold text-white">{tier.customers}</div>
            </div>

            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">LLM APIs</dt>
                <dd className="text-slate-300 font-mono text-right">{tier.llmCosts}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">ML training & inference</dt>
                <dd className="text-slate-300 font-mono text-right">{tier.mlCosts}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Data infrastructure</dt>
                <dd className="text-slate-300 font-mono text-right">{tier.infraCosts}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Data licenses</dt>
                <dd className="text-slate-300 font-mono text-right">{tier.dataLicenses}</dd>
              </div>
            </dl>

            <div className="mt-auto pt-4 border-t border-slate-800/70">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                Total monthly
              </div>
              <div className="text-lg font-semibold text-[#d4af37]">{tier.totalMonthly}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
