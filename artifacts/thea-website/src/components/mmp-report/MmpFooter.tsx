export function MmpFooter() {
  return (
    <footer className="border-t border-slate-800/60 bg-[#040a1c] py-12 mt-32">
      <div className="container mx-auto px-4 lg:px-8 max-w-7xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-[#d4af37] flex items-center justify-center text-[#020617] font-bold text-xs tracking-tighter">
            //
          </div>
          <span className="text-slate-400 font-display text-sm">
            End of Briefing Document
          </span>
        </div>
        <div className="text-slate-600 text-xs font-mono uppercase tracking-widest text-center md:text-right">
          Strictly Confidential <br className="hidden md:block"/> Do Not Distribute
        </div>
      </div>
    </footer>
  );
}
