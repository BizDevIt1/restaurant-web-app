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
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Features", href: "/#features" },
    { name: "Product", href: "/#product" },
    { name: "Pricing", href: "/pricing" },
    { name: "How it works", href: "/#how-it-works" },
    { name: "FAQ", href: "/#faq" },
    { name: "About", href: "/about" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--bg-deep)]/90 backdrop-blur-md border-b border-[var(--border)] py-3 shadow-xl shadow-black/40"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Brand Mark */}
        <Link href="/" className="flex items-center gap-1.5 group focus:outline-none">
          <Image
            src="/logo.png"
            alt="Omnibites Logo"
            width={64}
            height={64}
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain -mr-1 transition-transform duration-300 group-hover:scale-105"
            priority
          />
          <div className="flex flex-col">
            <span className="font-display font-extrabold text-2xl sm:text-[26px] tracking-tight flex items-center">
              <span className="text-[#f7f0dd]">Omni</span>
              <span className="text-[#f5a623]">bites</span>
            </span>
            <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--text-faint)] -mt-1 font-medium">
              Restaurant
            </span>
          </div>
        </Link>

        {/* Desktop Center Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] px-4 py-1.5 rounded-full backdrop-blur-md">
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
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/#demo"
            className="btn-ghost text-xs px-4 py-2"
          >
            Book a Demo
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
          className="lg:hidden p-2 rounded-lg text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] border border-[var(--border)]"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[var(--bg-deep)]/95 border-b border-[var(--border)] backdrop-blur-xl px-6 py-6 mt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col space-y-3">
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

          <div className="pt-3 flex flex-col gap-3">
            <Link
              href="/#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="btn-ghost text-center py-2.5 text-sm"
            >
              Book a Demo
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
    </header>
  );
}
