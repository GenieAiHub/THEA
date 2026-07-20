import { motion } from "framer-motion";

export function MmpHeader() {
  return (
    <header className="border-b border-slate-800/60 bg-[#020617]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="container mx-auto px-4 lg:px-8 h-20 flex items-center justify-between max-w-7xl">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-[#d4af37] flex items-center justify-center text-[#020617] font-bold tracking-tighter">
            //
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-[#d4af37] uppercase tracking-widest leading-none mb-1">
              Internal Briefing
            </span>
            <span className="text-slate-100 font-display font-medium tracking-tight leading-none text-lg">
              Project Navigator
            </span>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Classification
          </div>
          <div className="text-sm font-semibold text-rose-500 flex items-center gap-2 justify-end">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            CONFIDENTIAL
          </div>
        </div>
      </div>
    </header>
  );
}
