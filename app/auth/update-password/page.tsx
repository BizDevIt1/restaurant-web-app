"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Store,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // Check active session on mount
  useEffect(() => {
    const supabase = createClient();

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      } catch (err) {
        console.error("[Session Check Error]:", err);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();

    // Listen to Auth State Changes (when Supabase exchanges invite token in URL hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
        setIsCheckingSession(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Automatic redirect countdown upon success
  useEffect(() => {
    if (redirectCountdown === null) return;

    if (redirectCountdown === 0) {
      router.push("/super-admin/dashboard");
      return;
    }

    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [redirectCountdown, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    if (!password) {
      setErrorMessage("Please enter a new password.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please verify.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      // Update password for currently authenticated invited user
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage("Password set successfully! Your restaurant account is now active.");
      setRedirectCountdown(3);
    } catch (err: unknown) {
      console.error("[Password Update Error]:", err);
      const msg = err instanceof Error ? err.message : "Failed to update password. Please request a new invite link.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const isPasswordLongEnough = password.length >= 8;
  const doPasswordsMatch = password.length > 0 && password === confirmPassword;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#0d0a08] text-[var(--text-hi)] px-4 sm:px-6 py-12 selection:bg-amber-500/30 selection:text-amber-300">
      {/* Background Ambient Glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[400px] bg-[radial-gradient(circle_at_center,rgba(227,177,59,0.14)_0%,rgba(224,78,23,0.06)_45%,transparent_70%)] pointer-events-none -z-10 blur-3xl"
        aria-hidden="true"
      />

      <div className="w-full max-w-md">
        {/* Main Card Container */}
        <div className="bg-[#140f0c]/90 backdrop-blur-2xl border border-[var(--border-hi)] rounded-3xl p-7 sm:p-9 shadow-2xl shadow-black/80 space-y-6 relative overflow-hidden">
          {/* Subtle Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

          {/* Header & Branding */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-semibold uppercase tracking-wider">
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>Restaurant Owner Portal</span>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h1 className="font-display font-black text-2xl sm:text-3xl text-[var(--text-hi)] tracking-tight">
                Accept Invitation
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1">
                Create a secure password to access your restaurant control center.
              </p>
            </div>

            {userEmail && (
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-[var(--border)] text-xs text-[var(--text-lo)] font-mono flex items-center justify-center gap-1.5">
                <span className="text-[var(--text-faint)]">Account:</span>
                <span className="text-amber-400 font-medium truncate">{userEmail}</span>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs animate-in fade-in zoom-in-95 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage ? (
            <div className="space-y-5 py-4 text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="font-display font-bold text-lg text-[var(--text-hi)]">
                  Account Ready!
                </h3>
                <p className="text-xs text-[var(--text-lo)] leading-relaxed">
                  {successMessage}
                </p>
                {redirectCountdown !== null && (
                  <p className="text-xs font-mono text-amber-400 font-semibold pt-1">
                    Redirecting in {redirectCountdown}s...
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => router.push("/super-admin/dashboard")}
                className="w-full btn-gold py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <span>Go to Dashboard Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider font-mono text-[var(--text-hi)]">
                  New Password <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter at least 8 characters"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/[0.05] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider font-mono text-[var(--text-hi)]">
                  Confirm Password <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/[0.05] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Indicator */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-[var(--border)] space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      isPasswordLongEnough
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/10 text-[var(--text-faint)]"
                    }`}
                  >
                    {isPasswordLongEnough ? "✓" : "•"}
                  </div>
                  <span
                    className={
                      isPasswordLongEnough
                        ? "text-emerald-400 font-medium"
                        : "text-[var(--text-faint)]"
                    }
                  >
                    At least 8 characters
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      doPasswordsMatch
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/10 text-[var(--text-faint)]"
                    }`}
                  >
                    {doPasswordsMatch ? "✓" : "•"}
                  </div>
                  <span
                    className={
                      doPasswordsMatch
                        ? "text-emerald-400 font-medium"
                        : "text-[var(--text-faint)]"
                    }
                  >
                    Passwords match
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !isPasswordLongEnough || !doPasswordsMatch}
                className="w-full btn-gold py-3.5 text-xs font-bold shadow-lg shadow-[var(--gold-glow)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 rounded-xl transition-all"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#342c14] border-t-transparent rounded-full animate-spin" />
                    <span>Setting Password...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Set Password &amp; Activate Account</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Navigation */}
          <div className="pt-2 text-center text-xs text-[var(--text-lo)] border-t border-[var(--border)]/60 flex items-center justify-between">
            <Link
              href="/login"
              className="text-[var(--text-faint)] hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              <span>← Back to Sign In</span>
            </Link>

            <span className="font-mono text-[10px] text-[var(--text-faint)]">
              Omnibites SaaS Security
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
