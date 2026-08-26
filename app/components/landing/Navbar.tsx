"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    // Check initial scroll position on mount
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Features", href: "/#features" },
    { name: "Product", href: "/#product" },
    { name: "Pricing", href: "/pricing" },
    { name: "How It Works", href: "/#how-it-works" },
    { name: "FAQ", href: "/faq" },
    { name: "About", href: "/about" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-300 pointer-events-none">
      <div
        className={`pointer-events-auto transition-all duration-300 ${scrolled
            ? "w-[calc(100%-1.5rem)] sm:w-[min(1240px,calc(100%-2rem))] mt-1.5 sm:mt-2 rounded-full bg-[var(--bg-deep)]/40 backdrop-blur-xl border border-[var(--border)] py-2.5 px-4 sm:px-6 shadow-2xl shadow-black/50"
            : "w-full rounded-none bg-transparent border-b border-transparent mt-0 py-4 sm:py-5 px-4 sm:px-6"
          }`}
      >
        <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-3 sm:gap-4">
          {/* Brand Mark */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 shrink-0 group focus:outline-none">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-[#241a06] text-base sm:text-lg bg-gradient-to-br from-[#e3b13b] via-[#f7f0dd] to-[#e04e17] shadow-lg shadow-[var(--gold-dim)] transition-transform duration-300 group-hover:scale-105">
              FN
            </div>
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-[var(--text-hi)] flex items-center gap-1.5">
                FoodNet
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] inline-block"></span>
              </span>
              <span className="font-mono text-[9px] sm:text-[10px] tracking-wider uppercase text-[var(--text-faint)] -mt-0.5 sm:-mt-1 font-medium">
                Restaurant OS · PK
              </span>
            </div>
          </Link>

          {/* Desktop Center Links */}
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="px-3.5 py-1.5 text-sm font-medium text-[var(--text-lo)] hover:text-[var(--gold)] transition-colors rounded-full hover:bg-[var(--gold-dim)]"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Right Action Buttons */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <Link
              href="/login"
              className="text-sm font-medium text-[var(--text-lo)] hover:text-[var(--gold)] transition-colors px-2 py-1.5 focus:outline-none"
            >
              Login
            </Link>
            <Link
              href="/pricing"
              className="btn-gold text-xs px-4 py-2"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] border border-[var(--border)] shrink-0 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[var(--bg-deep)]/95 border border-[var(--border)] backdrop-blur-xl px-5 sm:px-6 py-5 sm:py-6 mt-3 rounded-2xl space-y-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col space-y-2.5">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium text-[var(--text-lo)] hover:text-[var(--gold)] py-1.5 transition-colors border-b border-[var(--border)]/50"
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 text-sm font-medium text-[var(--text-lo)] hover:text-[var(--gold)] transition-colors"
              >
                Login
              </Link>
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-gold text-center py-2.5 text-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
