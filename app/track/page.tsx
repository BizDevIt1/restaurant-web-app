import React from "react";
import CustomerOrderTracking from "../components/CustomerOrderTracking";
import Link from "next/link";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";

export const metadata = {
  title: "Track Your Order | OmniBites Dining",
  description: "Enter your order number to track preparation and live reverse countdown in real-time.",
};

export default function TrackIndexPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-hi)] flex flex-col antialiased">
      {/* Top Header */}
      <header className="border-b border-[var(--border)] bg-[var(--surface-hi)]/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-mono font-bold text-[var(--gold)] hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Restaurant Home</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)]">
              <UtensilsCrossed className="w-3.5 h-3.5" />
            </div>
            <span className="font-display font-black text-sm tracking-tight">
              OmniBites <span className="text-[var(--gold)]">Live Track</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto py-8 sm:py-12">
        <div className="text-center space-y-2 px-4 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
            <span>REAL-TIME KITCHEN TELEMETRY</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Live Order Status &amp; Prep Timer
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] max-w-md mx-auto">
            Direct reverse countdown from the chef station with real-time food prep progress.
          </p>
        </div>

        <CustomerOrderTracking />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-6 text-center text-xs font-mono text-[var(--text-faint)]">
        Powered by OmniBites Enterprise Kitchen Display System (KDS)
      </footer>
    </div>
  );
}
