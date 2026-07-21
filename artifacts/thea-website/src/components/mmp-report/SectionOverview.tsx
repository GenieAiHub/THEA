import { MARKET_STATS, MARKET_TRENDS, MARKET_PROJECTION } from "@/content/mmp-report";
import { motion } from "framer-motion";

export function SectionOverview() {
  const maxVal = Math.max(...MARKET_PROJECTION.map(p => p.valueBillions));
  
  return (
    <section id="overview" className="scroll-mt-32">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl lg:text-7xl font-display font-bold text-white tracking-tight mb-6">
          THEA MMP Competitive<br/>Landscape & <span className="text-[#d4af37]">Gap Analysis</span>
        </h1>
        <p className="text-xl text-slate-400 font-light max-w-3xl leading-relaxed mb-16">
          A definitive assessment of the mobile measurement partner ecosystem, 
          identifying vulnerable incumbents and high-value product opportunities for immediate development.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {MARKET_STATS.map((stat, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl relative overflow-hidden group hover:border-[#d4af37]/50 transition-colors"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#d4af37]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-sm font-mono text-slate-500 uppercase tracking-wider mb-2">{stat.label}</div>
              <div className="text-4xl font-display font-semibold text-white mb-3">{stat.value}</div>
              <div className="text-sm text-slate-400 leading-snug">{stat.detail}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-2xl font-display font-semibold text-white mb-8 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-[#d4af37] rounded-sm"></span>
              Macro Trends Shaping the Market
            </h2>
            <div className="flex flex-col gap-6">
              {MARKET_TRENDS.map((trend, idx) => (
                <div key={idx} className="flex gap-4 group">
                  <div className="text-[#d4af37] font-mono text-sm mt-1 opacity-50 group-hover:opacity-100 transition-opacity">0{idx + 1}</div>
                  <div>
                    <h3 className="text-lg font-medium text-slate-200 mb-1">{trend.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{trend.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-8">
            <h3 className="text-sm font-mono text-slate-500 uppercase tracking-widest mb-8">
              MMP Market Projection (Billions USD)
            </h3>
            
            <div className="h-64 flex items-end justify-between gap-2">
              {MARKET_PROJECTION.map((point, idx) => {
                const heightPx = Math.round((point.valueBillions / maxVal) * 180);
                return (
                  <div key={point.year} className="flex flex-col items-center justify-end flex-1 group">
                    <div className="text-xs text-slate-400 mb-2 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                      ${point.valueBillions.toFixed(2)}B
                    </div>
                    <motion.div 
                      initial={{ height: 0 }}
                      whileInView={{ height: heightPx }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1, duration: 0.8, type: "spring" }}
                      className="w-full max-w-[48px] bg-gradient-to-t from-slate-800 to-slate-700 group-hover:to-[#d4af37]/80 rounded-t-md relative overflow-hidden transition-all duration-300"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10 opacity-0 group-hover:opacity-100" />
                    </motion.div>
                    <div className="text-sm text-slate-500 mt-4 font-mono">{point.year}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
