import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadMmpReportPdf } from "@/lib/mmp-report-pdf";

export function MmpHeader() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadMmpReportPdf();
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Sorry, the PDF could not be generated. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

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
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            data-testid="button-download-pdf"
            className="inline-flex items-center gap-2 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-sm font-medium text-[#d4af37] transition-colors hover:bg-[#d4af37]/20 hover:border-[#d4af37]/70 disabled:opacity-60 disabled:cursor-wait"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">{downloading ? "Preparing…" : "Download PDF"}</span>
          </button>
          <div className="text-right hidden md:block">
            <div className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              Classification
            </div>
            <div className="text-sm font-semibold text-rose-500 flex items-center gap-2 justify-end">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              CONFIDENTIAL
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
