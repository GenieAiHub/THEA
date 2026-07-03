import type { ReactNode } from "react";
import { motion } from "framer-motion";

type PageHeroProps = {
  eyebrow?: string;
  eyebrowIcon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
};

/** Consistent hero header for content/landing pages. Owns its top padding so it
 *  clears the fixed navbar. */
export function PageHero({ eyebrow, eyebrowIcon, title, description, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden px-6 pt-40 pb-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        {eyebrow && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400">
            {eyebrowIcon}
            {eyebrow}
          </div>
        )}
        <h1 className="mb-6 bg-gradient-to-br from-white via-white to-blue-200 bg-clip-text font-display text-4xl font-bold leading-[1.1] tracking-tight text-transparent md:text-6xl">
          {title}
        </h1>
        {description && (
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {description}
          </p>
        )}
        {children && <div className="mt-10">{children}</div>}
      </motion.div>
    </section>
  );
}
