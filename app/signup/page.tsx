"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import Navbar from "../components/Navbar";
import WhatsAppFloat from "../components/WhatsAppFloat";
import { useSplash } from "../components/SplashScreen";

export default function SignUpPage() {
  const router = useRouter();
  const { triggerSplash, hideSplash, isVisible: isSplashVisible } = useSplash();
  const [fullName, setFullName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Trigger splash screen to cover account creation
    triggerSplash(3000);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName,
            restaurant_name: restaurantName,
          },
        },
      });

      if (error) {
        hideSplash();
        setErrorMessage(error.message);
        return;
      }

      if (data?.session) {
        router.push("/super-admin/dashboard");
        router.refresh();
      } else {
        hideSplash();
        setSuccessMessage("Account created successfully! Please check your email for confirmation.");
      }
    } catch (err: unknown) {
      hideSplash();
      const message = err instanceof Error ? err.message : "Failed to create account. Please try again.";
      setErrorMessage(message);
    }
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
              <Image
                src="/logo.png"
                alt="Omnibites"
                width={52}
                height={52}
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain mx-auto mb-2"
              />
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-[var(--text-hi)]">
                Create Account
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-lo)] flex items-center justify-center gap-1">
                <span>Start managing your restaurant with</span>
                <span className="font-semibold">
                  <span className="text-[#f7f0dd]">Omni</span>
                  <span className="text-[#f5a623]">bites</span>
                </span>
              </p>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-[var(--orange-dim)] border border-[var(--orange)]/40 text-[var(--text-hi)] text-xs flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[var(--orange)] mt-1 shrink-0 animate-pulse"></span>
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Success Message Alert */}
            {successMessage && (
              <div className="p-3.5 rounded-xl bg-[#25d366]/15 border border-[#25d366]/40 text-[var(--text-hi)] text-xs flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#25d366] mt-1 shrink-0"></span>
                <span className="leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* Simple Sign Up Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ali Khan"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors"
                />
              </div>

              {/* Restaurant Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  required
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Spice Grill Lahore"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors"
                />
              </div>

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
                <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSplashVisible}
                className="w-full btn-gold py-3 text-sm font-bold shadow-lg shadow-[var(--gold-glow)] mt-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Create Account</span>
              </button>
            </form>

            {/* Switch to Login */}
            <div className="pt-2 text-center text-xs text-[var(--text-lo)] border-t border-[var(--border)]/60">
              Already have an account?{" "}
              <Link
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  triggerSplash(1200);
                  router.push("/login");
                }}
                className="text-[var(--gold)] font-semibold hover:underline"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* WhatsApp Floating Action Button */}
      <WhatsAppFloat />
    </div>
  );
}
