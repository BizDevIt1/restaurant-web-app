"use client";

import React, { useEffect } from "react";
import Navbar from "../components/Navbar";
import PricingSection from "../components/PricingSection";
import Footer from "../components/Footer";
import WhatsAppFloat from "../components/WhatsAppFloat";

export default function PricingPage() {
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
        {/* 2. Pricing Section */}
        <div className="reveal-init">
          <PricingSection />
        </div>
      </main>

      {/* 3. Footer (Same) */}
      <Footer />

      {/* WhatsApp Floating Action Button */}
      <WhatsAppFloat />
    </div>
  );
}
