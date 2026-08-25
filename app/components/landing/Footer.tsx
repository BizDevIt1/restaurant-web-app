"use client";

import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--bg-deep)] border-t border-[var(--border)] pt-16 pb-12 text-[var(--text-lo)] text-xs">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[var(--border)]/60">
          {/* Col 1: Brand */}
          <div className="lg:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-extrabold text-[#241a06] text-sm bg-gradient-to-br from-[#e3b13b] to-[#e04e17]">
                OB
              </div>
              <span className="font-display font-extrabold text-lg text-[var(--text-hi)]">
                Omnibites
              </span>
            </Link>
            <p className="text-xs text-[var(--text-lo)] leading-relaxed">
              The unified operating system for restaurants, cloud kitchens, and franchise networks.
            </p>
            <div className="font-mono text-[11px] text-[var(--text-faint)]">
              Restaurant Operating System Platform
            </div>
          </div>

          {/* Col 2: Product */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[var(--text-hi)]">
              Product
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#features" className="hover:text-[var(--gold)] transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#product" className="hover:text-[var(--gold)] transition-colors">
                  Screenshots &amp; Mockup
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-[var(--gold)] transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-[var(--gold)] transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Company */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[var(--text-hi)]">
              Company
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#about" className="hover:text-[var(--gold)] transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/#demo" className="hover:text-[var(--gold)] transition-colors">
                  Blog &amp; Resources
                </Link>
              </li>
              <li>
                <a href="mailto:contact@omnibites.com" className="hover:text-[var(--gold)] transition-colors">
                  Contact Support
                </a>
              </li>
              <li>
                <Link href="/#demo" className="hover:text-[var(--gold)] transition-colors">
                  Founding Partners
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Account */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[var(--text-hi)]">
              Account
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#demo" className="hover:text-[var(--gold)] transition-colors">
                  View Demo
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-[var(--gold)] transition-colors">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 5: Legal */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[var(--text-hi)]">
              Legal
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#demo" className="hover:text-[var(--gold)] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/#demo" className="hover:text-[var(--gold)] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/#demo" className="hover:text-[var(--gold)] transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/#demo" className="hover:text-[var(--gold)] transition-colors">
                  Security Standards
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs font-mono text-[var(--text-faint)]">
          <div>
            &copy; {new Date().getFullYear()} Omnibites Technologies Inc. All rights reserved.
          </div>
          <div className="text-[var(--text-lo)] font-medium">
            Multi-currency &amp; multi-language ready
          </div>
        </div>
      </div>
    </footer>
  );
}
