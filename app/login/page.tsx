"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";
import WhatsAppFloat from "../components/landing/WhatsAppFloat";

export default function LoginPage() {
  const [role, setRole] = useState<"owner" | "branch">("owner");
  const [identifier, setIdentifier] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState<{ type: "idle" | "success" | "error"; message?: string }>({
    type: "idle",
  });

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
        rootMargin: "0px 0px -40px 0px",
        threshold: 0.1,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleDemoFill = (type: "owner" | "branch") => {
    setRole(type);
    if (type === "owner") {
      setIdentifier("owner@monal.pk");
      setPassword("••••••••••");
      setBranchCode("");
    } else {
      setIdentifier("pos.counter1@saltnpepper.pk");
      setBranchCode("LHE-GULBERG-01");
      setPassword("••••••••••");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginStatus({ type: "idle" });

    setTimeout(() => {
      setIsLoading(false);
      setLoginStatus({
        type: "success",
        message: "Authenticated successfully! Redirecting to FoodNet Terminal...",
      });
    }, 1200);
  };

  return (
    <div className="relative min-h-screen flex flex-col pt-16">
      {/* 1. Header Navbar */}
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 md:py-20 px-4 sm:px-6 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] sm:w-[700px] h-[350px] bg-gradient-to-r from-[var(--gold)]/15 via-[var(--orange)]/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="w-full max-w-[480px] mx-auto reveal-init">
          {/* Card Container */}
          <div className="glass-panel-static p-6 sm:p-8 rounded-[24px] border border-[var(--border-hi)] shadow-2xl shadow-black/70 relative">
            {/* Top Brand & Badge */}
            <div className="text-center space-y-3 mb-6">
              <Link href="/" className="inline-flex items-center gap-2.5 group focus:outline-none mb-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-[#241a06] text-lg bg-gradient-to-br from-[#e3b13b] via-[#f7f0dd] to-[#e04e17] shadow-lg shadow-[var(--gold-dim)] transition-transform duration-300 group-hover:scale-105">
                  FN
                </div>
                <div className="text-left flex flex-col">
                  <span className="font-display font-extrabold text-xl tracking-tight text-[var(--text-hi)] flex items-center gap-1.5">
                    FoodNet
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] inline-block"></span>
                  </span>
                  <span className="font-mono text-[9px] tracking-wider uppercase text-[var(--text-faint)] -mt-1 font-medium">
                    Restaurant OS · PK
                  </span>
                </div>
              </Link>

              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-hi)] tracking-tight">
                Welcome Back
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-lo)] max-w-sm mx-auto">
                Sign in to manage your branches, live POS billing counters, and online orders.
              </p>
            </div>

            {/* Role Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg-deep)]/80 border border-[var(--border)] mb-6">
              <button
                type="button"
                onClick={() => setRole("owner")}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  role === "owner"
                    ? "bg-[var(--gold)] text-[#241a06] shadow-md shadow-[var(--gold-dim)]"
                    : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                }`}
              >
                Owner / Head Office
              </button>
              <button
                type="button"
                onClick={() => setRole("branch")}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  role === "branch"
                    ? "bg-[var(--gold)] text-[#241a06] shadow-md shadow-[var(--gold-dim)]"
                    : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                }`}
              >
                Branch / POS Terminal
              </button>
            </div>

            {/* Quick Demo Helper Pills */}
            <div className="flex items-center justify-between gap-2 mb-6 p-2.5 rounded-xl bg-[var(--surface-hi)]/60 border border-[var(--border)]">
              <span className="text-[11px] font-mono text-[var(--text-faint)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse"></span>
                Demo mode:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoFill("owner")}
                  className="text-[11px] font-medium text-[var(--gold)] hover:underline focus:outline-none"
                >
                  Fill Owner
                </button>
                <span className="text-[var(--border-hi)] text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => handleDemoFill("branch")}
                  className="text-[11px] font-medium text-[var(--gold)] hover:underline focus:outline-none"
                >
                  Fill POS Staff
                </button>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Branch Code (Only shown when Branch role is selected) */}
              {role === "branch" && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider font-mono">
                    Branch Identifier / Terminal ID
                  </label>
                  <input
                    type="text"
                    required
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value)}
                    placeholder="e.g. LHE-GULBERG-01"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-deep)]/70 border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] font-mono transition-colors"
                  />
                </div>
              )}

              {/* Email or Phone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider font-mono">
                  {role === "owner" ? "Email Address / Owner Phone" : "Staff User ID / Email"}
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={role === "owner" ? "owner@restaurant.pk or 03001234567" : "pos.cashier@branch.pk"}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-deep)]/70 border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider font-mono">
                    Password / PIN
                  </label>
                  <Link
                    href="/#demo"
                    className="text-xs font-medium text-[var(--gold)] hover:underline focus:outline-none"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[var(--bg-deep)]/70 border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] focus:outline-none"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[var(--bg-deep)] border-[var(--border)] text-[var(--gold)] focus:ring-[var(--gold)] cursor-pointer accent-[#e3b13b]"
                />
                <label htmlFor="remember" className="text-xs text-[var(--text-lo)] cursor-pointer select-none">
                  Keep this POS terminal / browser logged in
                </label>
              </div>

              {/* Success Alert */}
              {loginStatus.type === "success" && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium animate-in fade-in duration-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {loginStatus.message}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-gold py-3 text-sm font-bold shadow-lg shadow-[var(--gold-glow)] flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    Verifying Credentials...
                  </>
                ) : (
                  <>
                    Sign In to {role === "owner" ? "Head Office Portal" : "Branch Terminal"}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Bottom Register CTA */}
            <div className="mt-6 pt-5 border-t border-[var(--border)]/60 text-center">
              <p className="text-xs text-[var(--text-lo)]">
                Don&apos;t have a FoodNet OS account?{" "}
                <Link href="/pricing" className="text-[var(--gold)] font-semibold hover:underline">
                  Get Started / Register Restaurant
                </Link>
              </p>
            </div>

            {/* Security Guarantee Strip */}
            <div className="mt-4 text-center">
              <span className="font-mono text-[10px] text-[var(--text-faint)] flex items-center justify-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                256-Bit Encrypted · Hosted locally in Pakistan
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Footer */}
      <Footer />

      {/* WhatsApp Floating Action Button */}
      <WhatsAppFloat />
    </div>
  );
}
