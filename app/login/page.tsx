"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";
import WhatsAppFloat from "../components/landing/WhatsAppFloat";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // No backend functionality right now
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* 1. Header Navbar */}
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-start sm:justify-center pt-24 sm:pt-32 md:pt-36 pb-12 sm:pb-16 px-4 sm:px-6">
        {/* Ambient Glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[radial-gradient(circle_at_center,var(--gold-dim)_0%,transparent_70%)] pointer-events-none -z-10 opacity-70"
          aria-hidden="true"
        />

        <div className="w-full max-w-md">
          {/* Card Container */}
          <div className="bg-[var(--bg-deep)]/85 backdrop-blur-2xl border border-[var(--border)] rounded-2xl sm:rounded-3xl p-7 sm:p-9 shadow-2xl space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#e3b13b] to-[#e04e17] text-[#241a06] font-display font-extrabold text-lg shadow-lg shadow-[var(--gold-glow)] mb-2">
                FN
              </div>
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-[var(--text-hi)]">
                Welcome Back
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-lo)]">
                Sign in to manage your restaurant
              </p>
            </div>

            {/* Simple Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@restaurant.pk"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider">
                    Password
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => e.preventDefault()}
                    className="text-xs text-[var(--gold)] hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
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

              {/* Remember Me */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[var(--surface-hi)] border-[var(--border)] text-[var(--gold)] focus:ring-[var(--gold)]"
                />
                <label htmlFor="rememberMe" className="text-xs text-[var(--text-lo)] select-none cursor-pointer">
                  Remember this device
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full btn-gold py-3 text-sm font-bold shadow-lg shadow-[var(--gold-glow)] mt-2"
              >
                Sign In
              </button>
            </form>

            {/* Switch to Sign Up */}
            <div className="pt-2 text-center text-xs text-[var(--text-lo)] border-t border-[var(--border)]/60">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-[var(--gold)] font-semibold hover:underline">
                Create Account
              </Link>
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
