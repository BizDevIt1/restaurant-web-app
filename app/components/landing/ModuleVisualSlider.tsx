"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export interface SliderImage {
  src: string;
  alt: string;
  badge?: string;
}

export interface ModuleVisualSliderProps {
  images: SliderImage[];
  title: string;
}

export default function ModuleVisualSlider({ images, title }: ModuleVisualSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer to only auto-advance when slider is visible in viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInView(entry.isIntersecting);
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-advance timer (3.2 seconds) when in view
  useEffect(() => {
    if (!isInView || images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3200);

    return () => clearInterval(interval);
  }, [isInView, images.length]);

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  const activeImage = images[currentIndex] || images[0];

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[16/10] min-h-[280px] sm:min-h-[380px] rounded-2xl sm:rounded-3xl border border-[var(--border-hi)] overflow-hidden shadow-2xl bg-[#140c0c] select-none group"
    >
      {/* Framer Motion Crossfade + Slight Slide Animation between Images */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -15 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0 w-full h-full"
        >
          <Image
            src={activeImage.src}
            alt={activeImage.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority={currentIndex === 0}
          />
        </motion.div>
      </AnimatePresence>

      {/* Subtle Dark Gradient Overlay at Bottom for readability */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none z-10" />

      {/* Bottom Controls Bar & Position Dots */}
      <div className="absolute bottom-4 inset-x-4 z-20 flex items-center justify-between gap-4">
        {/* Active Alt Description Snippet */}
        <p className="text-xs sm:text-sm font-medium text-white/90 truncate drop-shadow-md max-w-[70%]">
          {activeImage.alt}
        </p>

        {/* Position Dot Indicators */}
        <div className="flex items-center gap-1.5 shrink-0 bg-black/40 px-2.5 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => handleDotClick(idx)}
              aria-label={`Go to ${title} slide ${idx + 1}`}
              className={`transition-all duration-300 cursor-pointer focus:outline-none ${
                idx === currentIndex
                  ? "w-6 h-2 rounded-full bg-[var(--gold)] shadow-md shadow-[var(--gold-glow)]"
                  : "w-2 h-2 rounded-full bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
