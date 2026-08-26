"use client";

import React, { useEffect } from "react";
import Navbar from "./components/landing/Navbar";
import HeroOrbit from "./components/landing/HeroOrbit";
import ProblemSolution from "./components/landing/ProblemSolution";
import Demo from "./components/landing/Demo";
import FeatureGrid from "./components/landing/FeatureGrid";
import HowItWorks from "./components/landing/HowItWorks";
import WhoItsFor from "./components/landing/WhoItsFor";
import ProductShowcase from "./components/landing/ProductShowcase";
import RoiSection from "./components/landing/RoiSection";
import EarlyPartners from "./components/landing/EarlyPartners";
import IntegrationsGrid from "./components/landing/IntegrationsGrid";
import SecuritySection from "./components/landing/SecuritySection";
import FaqAccordion from "./components/landing/FaqAccordion";
import AboutManifesto from "./components/landing/AboutManifesto";
import FinalCta from "./components/landing/FinalCta";
import Footer from "./components/landing/Footer";
import WhatsAppFloat from "./components/landing/WhatsAppFloat";

export default function Home() {
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
      {/* 1. Navbar */}
      <Navbar />

      <main className="flex-1">
        {/* 2. Hero Orbit */}
        <div className="reveal-init">
          <HeroOrbit />
        </div>

        {/* 3. Problem Solution */}
        <div className="reveal-init">
          <ProblemSolution />
        </div>

        {/* 5. Live Demo Section (Moved right after Problem Solution) */}
        <div className="reveal-init">
          <Demo />
        </div>

        {/* 6. Feature Grid */}
        <div className="reveal-init">
          <FeatureGrid />
        </div>

        {/* 7. How It Works */}
        <div className="reveal-init">
          <HowItWorks />
        </div>

        {/* 8. Who It's For */}
        <div className="reveal-init">
          <WhoItsFor />
        </div>

        {/* 9. Product Showcase */}
        <div className="reveal-init">
          <ProductShowcase />
        </div>

        {/* 10. ROI Section */}
        <div className="reveal-init">
          <RoiSection />
        </div>

        {/* 11. Early Partners */}
        <div className="reveal-init">
          <EarlyPartners />
        </div>

        {/* 12. Integrations Grid */}
        <div className="reveal-init">
          <IntegrationsGrid />
        </div>

        {/* 13. Security Section */}
        <div className="reveal-init">
          <SecuritySection />
        </div>

        {/* 14. FAQ Accordion */}
        <div className="reveal-init">
          <FaqAccordion />
        </div>

        {/* 15. About Manifesto */}
        <div className="reveal-init">
          <AboutManifesto />
        </div>

        {/* 16. Final CTA */}
        <div className="reveal-init">
          <FinalCta />
        </div>
      </main>

      {/* 16. Footer */}
      <Footer />

      {/* WhatsApp Floating Action Button */}
      <WhatsAppFloat />
    </div>
  );
}
