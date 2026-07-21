import { THEA_PRODUCTS } from "@/content/mmp-report";
import { motion } from "framer-motion";

export function SectionThea() {
  return (
    <section id="thea" className="scroll-mt-32">
      <div className="mb-12">
        <h2 className="text-3xl font-display font-bold text-white mb-4">THEA Product Suite</h2>
        <p className="text-slate-400 max-w-3xl">
          Inside the THEA offering. Uniqueness scores (1–10) indicate defensive depth and difficulty of replication.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {THEA_PRODUCTS.map((product, idx) => (
          <motion.div
            key={product.name}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (idx % 6) * 0.05, duration: 0.4 }}
            className="bg-[#060d26] border border-slate-800/80 rounded-xl p-6 hover:border-slate-700 transition-colors flex flex-col h-full"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-slate-200">{product.name}</h3>
              <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                <span className="text-[10px] uppercase font-mono text-slate-500">Uniqueness</span>
                <span className={`text-sm font-mono font-bold ${
                  product.uniqueness >= 8 ? 'text-rose-400' :
                  product.uniqueness >= 6 ? 'text-[#d4af37]' : 'text-slate-400'
                }`}>{product.uniqueness}/10</span>
              </div>
            </div>
            
            <div className="space-y-4 flex-1">
              <div>
                <div className="text-xs font-mono text-slate-500 uppercase mb-1">What it does</div>
                <p className="text-sm text-slate-300 leading-relaxed">{product.whatItDoes}</p>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800/50">
                <div className="text-xs font-mono text-slate-500 uppercase mb-1">Key Benefit</div>
                <p className="text-sm text-[#d4af37]/90 leading-relaxed italic">"{product.benefit}"</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
