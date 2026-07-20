import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const SECTIONS = [
  { id: "overview", label: "Market Overview" },
  { id: "appsflyer", label: "AppsFlyer Suite" },
  { id: "competitors", label: "Competitor Matrix" },
  { id: "services", label: "Service Catalogue" },
  { id: "gaps", label: "Market Gaps" },
  { id: "costs", label: "AI Cost Model" },
  { id: "recommendations", label: "Recommendations" },
];

export function MmpNavigation() {
  const [activeId, setActiveId] = useState("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="flex flex-col gap-2">
      <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">
        Table of Contents
      </h4>
      {SECTIONS.map(({ id, label }, idx) => {
        const isActive = activeId === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            className={`text-sm font-medium transition-all duration-300 py-2 border-l-2 pl-4 -ml-[2px] ${
              isActive
                ? "text-[#d4af37] border-[#d4af37]"
                : "text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-600"
            }`}
          >
            <span className="text-[10px] font-mono opacity-50 mr-2">0{idx + 1}</span>
            {label}
          </a>
        );
      })}
    </nav>
  );
}
