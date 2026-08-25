"use client";

import React, { useEffect } from "react";
import Navbar from "../components/landing/Navbar";
import AboutHero from "../components/landing/AboutHero";
import FounderSection from "../components/landing/FounderSection";
import AboutManifesto from "../components/landing/AboutManifesto";
import Footer from "../components/landing/Footer";
import WhatsAppFloat from "../components/landing/WhatsAppFloat";

export default function AboutPage() {
  useEffect(() => {
    // Scroll reveal observer
    const elements = document.querySelectorAll(".reveal-init");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -60px 0px",
        threshold: 0.1,
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* 1. Header Navbar (Same) */}
      <Navbar />

      <main className="flex-1">
        {/* 2. Centered About Hero with Scroll Animation */}
        <div className="reveal-init">
          <AboutHero />
        </div>

        {/* 3. Founder & Company Story Split Cards */}
        <div className="reveal-init">
          <FounderSection />
        </div>

        {/* 4. About Manifesto Section (Mission & 4 Stat Cards) */}
        <div className="reveal-init">
          <AboutManifesto />
        </div>
      </main>

      {/* 5. Footer (Same) */}
      <Footer />

      {/* WhatsApp Floating Action Button */}
      <WhatsAppFloat />
    </div>
  );
}
