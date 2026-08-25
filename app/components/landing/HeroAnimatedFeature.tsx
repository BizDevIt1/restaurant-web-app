"use client";

import React, { useState, useEffect } from "react";

export const HERO_FEATURE_PHRASES = [
  "POS & Online Ordering System",
  "Restaurant Management System",
  "Billing & Payments System",
  "Kitchen Display System",
  "Inventory Management System",
  "Multi-Branch Management System",
  "Franchise Management System",
  "Table & Waiter Ordering System",
  "Online Marketplace System",
  "Delivery Management System",
  "Customer Loyalty System",
  "Sales & Business Reports System",
];

interface HeroAnimatedFeatureProps {
  className?: string;
}

export default function HeroAnimatedFeature({
  className = "",
}: HeroAnimatedFeatureProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check user preference for reduced motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  // Continuous, non-interactive typewriter animation loop
  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedText(HERO_FEATURE_PHRASES[phraseIndex]);
      return;
    }

    const currentFullPhrase = HERO_FEATURE_PHRASES[phraseIndex];
    let timer: NodeJS.Timeout;

    if (!isDeleting) {
      // 1. Typing forward
      if (displayedText.length < currentFullPhrase.length) {
        timer = setTimeout(() => {
          setDisplayedText(currentFullPhrase.slice(0, displayedText.length + 1));
        }, 55); // 55ms per character typed
      } else {
        // Fully typed: dwell for 1.8 seconds
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 1800);
      }
    } else {
      // 2. Deleting backward
      if (displayedText.length > 0) {
        timer = setTimeout(() => {
          setDisplayedText(currentFullPhrase.slice(0, displayedText.length - 1));
        }, 30); // 30ms per character deleted
      } else {
        // Fully deleted: move to next phrase
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % HERO_FEATURE_PHRASES.length);
      }
    }

    return () => {
      clearTimeout(timer);
    };
  }, [displayedText, isDeleting, phraseIndex, prefersReducedMotion]);

  return (
    <span className={`inline select-none pointer-events-none ${className}`} aria-hidden="true">
      {displayedText}
      <span className="inline-block ml-0.5 text-[var(--gold)] opacity-90 animate-pulse font-normal">
        |
      </span>
    </span>
  );
}
