"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface SplashContextType {
  isVisible: boolean;
  triggerSplash: (duration?: number, onComplete?: () => void) => void;
  hideSplash: () => void;
}

const SplashContext = createContext<SplashContextType | undefined>(undefined);

/**
 * Hook to access the Splash Screen trigger and state anywhere in the application.
 */
export function useSplash() {
  const context = useContext(SplashContext);
  if (!context) {
    throw new Error("useSplash must be used within a SplashProvider");
  }
  return context;
}

interface SplashProviderProps {
  children: React.ReactNode;
  defaultDuration?: number; // default 1200ms (1.2 seconds)
  autoPlayOnMount?: boolean; // default true for initial site load / browser reload
}

/**
 * Global Client-Side Provider for Omnibites Splash Screen.
 * Initializes with isVisible=true on initial load to prevent Flash of Unstyled Content (FOUC).
 */
export function SplashProvider({
  children,
  defaultDuration = 1200,
  autoPlayOnMount = true,
}: SplashProviderProps) {
  // Start with true on mount to avoid initial landing page flash before splash starts
  const [isVisible, setIsVisible] = useState(autoPlayOnMount);
  const [currentDuration, setCurrentDuration] = useState(defaultDuration);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef<(() => void) | undefined>(undefined);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const hideSplash = useCallback(() => {
    clearTimer();
    setIsVisible(false);
    if (onCompleteRef.current) {
      const callback = onCompleteRef.current;
      onCompleteRef.current = undefined;
      callback();
    }
  }, []);

  const triggerSplash = useCallback(
    (duration = defaultDuration, onComplete?: () => void) => {
      clearTimer();
      onCompleteRef.current = onComplete;
      setCurrentDuration(duration);
      setIsVisible(true);

      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        if (onCompleteRef.current) {
          const callback = onCompleteRef.current;
          onCompleteRef.current = undefined;
          callback();
        }
      }, duration);
    },
    [defaultDuration]
  );

  // Auto-dismiss on initial site load / browser reload after defaultDuration
  useEffect(() => {
    if (autoPlayOnMount) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, defaultDuration);
    }
    return () => clearTimer();
  }, [autoPlayOnMount, defaultDuration]);

  return (
    <SplashContext.Provider value={{ isVisible, triggerSplash, hideSplash }}>
      {children}
      <SplashScreen isVisible={isVisible} duration={currentDuration} />
    </SplashContext.Provider>
  );
}

interface SplashScreenProps {
  isVisible: boolean;
  duration?: number;
}

/**
 * Reusable Omnibites Splash Screen overlay with espresso and gold-amber glow aesthetics.
 */
export function SplashScreen({ isVisible, duration = 1200 }: SplashScreenProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="omnibites-splash-overlay"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden select-none pointer-events-auto bg-[#140c0c]"
          style={{
            background: "radial-gradient(ellipse 75% 65% at 50% 45%, #241d10 0%, #140c0c 75%)",
          }}
          aria-live="polite"
          role="status"
          aria-label="Loading Omnibites Restaurant"
        >
          {/* Glowing Amber & Espresso Ambient Auras */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10 overflow-hidden">
            {/* Outer pulsating amber aura */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0.4 }}
              animate={{ scale: [0.9, 1.15, 0.95], opacity: [0.4, 0.7, 0.45] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-[360px] h-[360px] sm:w-[500px] sm:h-[500px] rounded-full bg-[radial-gradient(circle,rgba(245,166,35,0.28)_0%,rgba(224,78,23,0.12)_45%,transparent_70%)] blur-3xl"
            />
            {/* Core warm gold-amber halo */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0.6 }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.65, 0.95, 0.65] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-[190px] h-[190px] sm:w-[240px] sm:h-[240px] rounded-full bg-[radial-gradient(circle,rgba(245,166,35,0.48)_0%,rgba(227,177,59,0.22)_50%,transparent_70%)] blur-2xl"
            />
          </div>

          {/* Centered Brand Presentation */}
          <motion.div
            initial={{ opacity: 0.9, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center text-center px-4"
          >
            {/* Logo Container with Gold-Amber Aura */}
            <div className="relative flex items-center justify-center mb-5">
              {/* Logo Card with Glassmorphism (kept at original compact square size) */}
              <div className="relative w-[76px] h-[76px] sm:w-[88px] sm:h-[88px] p-1.5 sm:p-2 rounded-2xl bg-[rgba(255,255,255,0.035)] border border-[rgba(247,231,190,0.18)] backdrop-blur-xl shadow-[0_0_45px_rgba(245,166,35,0.35)] flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="Omnibites Logo"
                  width={96}
                  height={96}
                  priority
                  className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(245,166,35,0.6)]"
                />
              </div>
            </div>

            {/* Brand Title: Omnibites */}
            <div className="flex items-center font-display font-extrabold text-3xl sm:text-4xl md:text-5xl tracking-tight leading-none">
              <span className="text-[#f7f0dd]">Omni</span>
              <span className="text-[#f5a623] drop-shadow-[0_0_18px_rgba(245,166,35,0.55)]">bites</span>
            </div>

            {/* Subtitle: RESTAURANT */}
            <span className="font-mono text-[10px] sm:text-xs tracking-[0.35em] uppercase text-[#8d8067] mt-2 font-semibold">
              Restaurant
            </span>

            {/* Smooth 1.2s Amber Progress Track */}
            <div className="mt-8 w-36 sm:w-44 h-1 bg-[rgba(247,231,190,0.12)] rounded-full overflow-hidden p-[1px]">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: duration / 1000, ease: [0.25, 1, 0.5, 1] }}
                className="h-full bg-gradient-to-r from-[#e3b13b] via-[#f5a623] to-[#e04e17] rounded-full shadow-[0_0_12px_#f5a623]"
              />
            </div>
          </motion.div>

          {/* Bottom Center Branding: powered by: */}
          <div className="absolute bottom-5 sm:bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1.5 pointer-events-none z-20">
            <span className="font-mono text-[9.5px] sm:text-[10.5px] tracking-wider text-[#9d9078] font-medium">
              Powered By:
            </span>

            {/* Logo container with rounded border radius, visible border and transparent glass styling */}
            <div className="relative px-4 py-2 rounded-2xl bg-[rgba(255,255,255,0.035)] border border-[rgba(247,231,190,0.2)] backdrop-blur-xl shadow-[0_0_25px_rgba(0,0,0,0.5)] flex items-center justify-center">
              <Image
                src="/branding-logo.png"
                alt="Branding Logo"
                width={180}
                height={60}
                priority
                className="h-8 sm:h-9.5 w-auto object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SplashScreen;
