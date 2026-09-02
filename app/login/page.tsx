"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import Navbar from "../components/Navbar";
import WhatsAppFloat from "../components/WhatsAppFloat";
import { useSplash } from "../components/SplashScreen";

export default function LoginPage() {
  const router = useRouter();
  const { triggerSplash, hideSplash, isVisible: isSplashVisible } = useSplash();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Trigger splash screen to cover authentication process
    triggerSplash(3000);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        hideSplash();
        const displayMsg =
          error.message.toLowerCase().includes("invalid login credentials") ||
          error.message.toLowerCase().includes("invalid credentials")
            ? "Incorrect email or password. Please try again."
            : error.message;
        setErrorMessage(displayMsg);
        setTimeout(() => {
          setErrorMessage(null);
        }, 3200);
        return;
      }

      if (data?.session || data?.user) {
        const userRole = data.user?.user_metadata?.role;
        const userEmail = email.trim().toLowerCase();

        if (userRole === "restaurant_admin") {
          router.push("/admin");
        } else if (userRole === "super_admin") {
          router.push("/super-admin/dashboard");
        } else {
          try {
            const { data: restData } = await supabase
              .from("restaurants")
              .select("id, owner_email")
              .eq("owner_email", userEmail)
              .limit(1)
              .maybeSingle();

            if (restData) {
              router.push("/admin");
            } else {
              router.push("/super-admin/dashboard");
            }
          } catch {
            router.push("/admin");
          }
        }
        router.refresh();
      } else {
        hideSplash();
      }
    } catch (err: unknown) {
      hideSplash();
      const message = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setErrorMessage(message);
      setTimeout(() => {
        setErrorMessage(null);
      }, 3200);
    }
  };

  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    triggerSplash(1200);
    setShowForgotModal(true);
    setForgotSuccess(null);
    setForgotError(null);
    if (email) setForgotEmail(email);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    // Trigger splash screen
    triggerSplash(1200);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setForgotError(error.message);
      } else {
        setForgotSuccess("Password reset instructions sent to your email.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send reset link.";
      setForgotError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* 1. Header Navbar */}
      <Navbar />

      {/* Floating Error Tooltip on Invalid Login */}
      {errorMessage && (
        <div className="fixed top-[88px] right-6 sm:right-8 z-50 flex items-center px-4 py-2 rounded-full bg-[#ef4444]/15 backdrop-blur-2xl border border-[#ef4444]/40 text-[#ef4444] shadow-xl shadow-black/40 animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-none select-none">
          <span className="text-xs sm:text-sm font-semibold tracking-tight">
            {errorMessage}
          </span>
        </div>
      )}

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
                  <button
                    type="button"
                    onClick={handleForgotPasswordClick}
                    className="text-xs text-[var(--gold)] hover:underline cursor-pointer focus:outline-none"
                  >
                    Forgot password?
                  </button>
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
                disabled={isSplashVisible}
                className="w-full btn-gold py-3 text-sm font-bold shadow-lg shadow-[var(--gold-glow)] mt-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Sign In</span>
              </button>
            </form>

            {/* Switch to Sign Up */}
            <div className="pt-2 text-center text-xs text-[var(--text-lo)] border-t border-[var(--border)]/60">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                onClick={(e) => {
                  e.preventDefault();
                  triggerSplash(1200);
                  router.push("/signup");
                }}
                className="text-[var(--gold)] font-semibold hover:underline"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[var(--bg-deep)] border border-[var(--border)] rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 relative">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-4 right-4 p-2 text-[var(--text-faint)] hover:text-[var(--text-hi)] rounded-lg hover:bg-[var(--surface-hi)] transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="space-y-2">
                <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                  Reset Password
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-lo)]">
                  Enter your email address and we will send you instructions to reset your password.
                </p>
              </div>

              {forgotError && (
                <div className="p-3 rounded-xl bg-[var(--orange-dim)] border border-[var(--orange)]/40 text-[var(--text-hi)] text-xs">
                  {forgotError}
                </div>
              )}

              {forgotSuccess && (
                <div className="p-3 rounded-xl bg-[#25d366]/15 border border-[#25d366]/40 text-[var(--text-hi)] text-xs">
                  {forgotSuccess}
                </div>
              )}

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="owner@restaurant.pk"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn-gold px-5 py-2.5 text-xs font-bold shadow-md shadow-[var(--gold-glow)] cursor-pointer disabled:opacity-60"
                  >
                    {forgotLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* WhatsApp Floating Action Button */}
      <WhatsAppFloat />
    </div>
  );
}
