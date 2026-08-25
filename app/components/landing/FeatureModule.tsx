"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { Check } from "lucide-react";

export interface FeatureModuleProps {
  id: string;
  moduleNumber: string;
  title: string;
  description: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean; // if true: text left, visual right on desktop
  index: number;
}

export default function FeatureModule({
  id,
  moduleNumber,
  title,
  description,
  bullets,
  visual,
  reverse = false,
}: FeatureModuleProps) {
  // Container stagger animation variants for bullets
  const listVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.15,
      },
    },
  };

  const bulletVariants: Variants = {
    hidden: { opacity: 0, x: -16, y: 8 },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.45, ease: "easeOut" },
    },
  };

  return (
    <div
      id={id}
      className="py-16 sm:py-24 lg:py-32 relative border-b border-[var(--border)]/40 last:border-b-0 overflow-hidden"
    >
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div
          className={`grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center ${
            reverse ? "lg:flex-row-reverse" : ""
          }`}
        >
          {/* Visual Column (Swaps order on desktop based on `reverse`, always top on mobile) */}
          <motion.div
            initial={{ opacity: 0, x: reverse ? 60 : -60, scale: 0.95 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className={`lg:col-span-6 w-full ${reverse ? "lg:order-2" : "lg:order-1"}`}
          >
            <div className="relative group">{visual}</div>
          </motion.div>

          {/* Text & Bullets Column */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`lg:col-span-6 w-full space-y-6 ${
              reverse ? "lg:order-1" : "lg:order-2"
            }`}
          >
            {/* Module Tag Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-mono font-bold uppercase tracking-wider text-[var(--gold)]">
              <span>{moduleNumber}</span>
            </div>

            {/* Title & One-line Description */}
            <div className="space-y-3">
              <h3 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-[var(--text-hi)] leading-tight">
                {title}
              </h3>
              <p className="text-[var(--text-lo)] text-base sm:text-lg leading-relaxed font-normal">
                {description}
              </p>
            </div>

            {/* Staggered Bullet Points List */}
            <motion.ul
              variants={listVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="space-y-3.5 pt-2"
            >
              {bullets.map((bullet, idx) => (
                <motion.li
                  key={idx}
                  variants={bulletVariants}
                  className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] hover:border-[var(--gold)]/50 hover:bg-[var(--surface-hi)] hover:shadow-lg hover:shadow-[var(--gold-dim)]/40 hover:-translate-y-0.5 transition-all duration-300 flex items-start gap-3.5 text-sm sm:text-base text-[var(--text-hi)] group/bullet cursor-default"
                >
                  <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/40 text-[var(--gold)] flex items-center justify-center shrink-0 mt-0.5 shadow-sm group-hover/bullet:border-[var(--gold)] group-hover/bullet:scale-110 transition-all duration-300">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="leading-snug text-[var(--text-hi)] font-medium group-hover/bullet:text-[var(--gold)] transition-colors duration-300">
                    {bullet}
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
