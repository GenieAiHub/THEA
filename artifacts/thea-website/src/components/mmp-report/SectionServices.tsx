import { useState, useMemo } from "react";
import { SERVICE_CATALOGUE, DEMAND_TIER_LABELS, DemandTier, CompetitorKey, COMPETITORS } from "@/content/mmp-report";

const VENDOR_LABELS: Record<CompetitorKey, string> = {
  thea: "THEA",
  ...Object.fromEntries(COMPETITORS.map(c => [c.key, c.name])),
} as Record<CompetitorKey, string>;
import { motion } from "framer-motion";
import { Search } from "lucide-react";

const TIER_COLORS: Record<DemandTier, string> = {
  high: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  emerging: "bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export function SectionServices() {
  const [filter, setFilter] = useState<DemandTier | "all">("all");
  const [search, setSearch] = useState("");

  const filteredServices = useMemo(() => {
    return SERVICE_CATALOGUE.filter(s => {
      const matchTier = filter === "all" || s.demand === filter;
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                          s.description.toLowerCase().includes(search.toLowerCase());
      return matchTier && matchSearch;
    });
  }, [filter, search]);

  return (
    <section id="services" className="scroll-mt-32">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-white mb-4">Full Service Catalogue</h2>
          <p className="text-slate-400 max-w-2xl">
            Comprehensive capability mapping across {SERVICE_CATALOGUE.length} discrete market offerings.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search catalogue..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md py-2 pl-9 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 transition-all"
            />
          </div>
          
          <div className="flex bg-slate-900 p-1 rounded-md border border-slate-800 w-full sm:w-auto overflow-x-auto">
            <button 
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${filter === "all" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}
            >
              All
            </button>
            {(Object.entries(DEMAND_TIER_LABELS) as [DemandTier, string][]).map(([key, label]) => (
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
      </div>

      <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800 text-xs font-mono uppercase text-slate-500 tracking-wider">
                <th className="p-4 font-medium min-w-[200px]">Capability</th>
                <th className="p-4 font-medium w-32">Demand</th>
                <th className="p-4 font-medium min-w-[300px]">Description & Driver</th>
                <th className="p-4 font-medium min-w-[200px]">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No capabilities match your criteria.
                  </td>
                </tr>
              ) : (
                filteredServices.map((service, idx) => (
                  <motion.tr 
                    key={service.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="p-4">
                      <div className="font-medium text-slate-200">{service.name}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${TIER_COLORS[service.demand]}`}>
                        {DEMAND_TIER_LABELS[service.demand]}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-300 mb-1">{service.description}</div>
                      <div className="text-xs text-[#d4af37]/80 italic">{service.keyDriver}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {service.offeredBy.map(vendor => (
                          <span key={vendor} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {VENDOR_LABELS[vendor] ?? vendor}
                          </span>
                        ))}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
