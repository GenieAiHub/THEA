import { useEffect } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { MmpHeader } from "@/components/mmp-report/MmpHeader";
import { MmpFooter } from "@/components/mmp-report/MmpFooter";
import { MmpNavigation } from "@/components/mmp-report/MmpNavigation";
import { SectionOverview } from "@/components/mmp-report/SectionOverview";
import { SectionThea } from "@/components/mmp-report/SectionThea";
import { SectionCompetitors } from "@/components/mmp-report/SectionCompetitors";
import { SectionServices } from "@/components/mmp-report/SectionServices";
import { SectionGaps } from "@/components/mmp-report/SectionGaps";
import { SectionCosts } from "@/components/mmp-report/SectionCosts";
import { SectionRecommendations } from "@/components/mmp-report/SectionRecommendations";

export default function MmpReportPage() {
  useEffect(() => {
    document.title = "CONFIDENTIAL | THEA MMP — Competitive Landscape & Gap Analysis";
  }, []);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-[#d4af37] selection:text-black">
      {/* Top progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-[#d4af37] origin-left z-50 shadow-[0_0_10px_rgba(212,175,55,0.5)]"
        style={{ scaleX }}
      />
      
      <MmpHeader />
      
      <div className="container mx-auto px-4 lg:px-8 py-12 flex flex-col xl:flex-row gap-12 items-start max-w-7xl">
        {/* Sticky Sidebar Navigation */}
        <aside className="hidden xl:block w-64 shrink-0 sticky top-24">
          <MmpNavigation />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col gap-32">
          <SectionOverview />
          <SectionThea />
          <SectionCompetitors />
          <SectionServices />
          <SectionGaps />
          <SectionCosts />
          <SectionRecommendations />
        </main>
      </div>

      <MmpFooter />
    </div>
  );
}
