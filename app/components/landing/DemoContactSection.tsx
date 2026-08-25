"use client";

import React, { useState } from "react";

export default function DemoContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    restaurantName: "",
    city: "Lahore",
    contact: "",
    branches: "1",
    interestedIn: "Complete POS + KDS + Online Ordering",
    requiredFeatures: "",
    whatsappOptIn: true,
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="demo" className="py-20 md:py-28 relative">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] p-8 sm:p-12 relative overflow-hidden shadow-2xl">
          {/* Subtle Ambient Radial */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-[var(--gold-dim)] rounded-full blur-3xl opacity-30"></div>
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[var(--orange-dim)] rounded-full blur-3xl opacity-20"></div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10 items-start">
            {/* Left Column: Direct Pitch & Contact Info */}
            <div className="lg:col-span-5 space-y-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
                Book Your Demo
              </div>

              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
                Transform Your Restaurant Operations Today
              </h2>

              <p className="text-[var(--text-lo)] text-sm sm:text-base leading-relaxed">
                Schedule a live 1-on-1 walkthrough tailored to your menu, physical counter setup, kitchen workflow, and delivery logistics.
              </p>

              <div className="space-y-4 pt-2">
                {/* Location */}
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                  <div className="w-9 h-9 rounded-lg bg-[var(--surface-hi)] text-[var(--gold)] flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[11px] font-mono text-[var(--text-faint)]">Headquarters</div>
                    <div className="text-xs sm:text-sm font-semibold text-[var(--text-hi)]">
                      Gujranwala, Punjab, Pakistan
                    </div>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                  <div className="w-9 h-9 rounded-lg bg-[var(--olive-dim)] text-[var(--olive)] flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[11px] font-mono text-[var(--text-faint)]">Direct WhatsApp</div>
                    <div className="text-xs sm:text-sm font-mono font-bold text-[var(--text-hi)]">
                      +92 300 1234567
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                  <div className="w-9 h-9 rounded-lg bg-[var(--surface-hi)] text-[var(--gold)] flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[11px] font-mono text-[var(--text-faint)]">Inquiries &amp; Enterprise</div>
                    <div className="text-xs sm:text-sm font-mono font-bold text-[var(--text-hi)]">
                      contact@foodnet.pk
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Form */}
            <div className="lg:col-span-7 p-6 sm:p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
              {submitted ? (
                <div className="text-center py-12 space-y-4 animate-in fade-in duration-300">
                  <div className="w-16 h-16 rounded-full bg-[var(--olive-dim)] text-[var(--olive)] border border-[var(--olive)]/40 flex items-center justify-center mx-auto text-2xl font-bold">
                    ✓
                  </div>
                  <h3 className="font-display font-bold text-2xl text-[var(--text-hi)]">
                    Thank you, {formData.name}!
                  </h3>
                  <p className="text-sm text-[var(--text-lo)] max-w-md mx-auto leading-relaxed">
                    Our Pakistan onboarding team has received your request for <b>{formData.restaurantName}</b> ({formData.city}). We will connect with you via WhatsApp within 2 hours.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="btn-ghost px-6 py-2.5 text-xs font-semibold mt-4"
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-lo)] mb-1.5">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Tariq Mehmood"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] transition-colors"
                      />
                    </div>

                    {/* Restaurant Name */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-lo)] mb-1.5">
                        Restaurant / Brand Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Royal Grill &amp; Karahi"
                        value={formData.restaurantName}
                        onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* City */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-lo)] mb-1.5">
                        City in Pakistan *
                      </label>
                      <select
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--gold)] transition-colors"
                      >
                        <option value="Karachi">Karachi</option>
                        <option value="Lahore">Lahore</option>
                        <option value="Islamabad">Islamabad</option>
                        <option value="Gujranwala">Gujranwala</option>
                        <option value="Faisalabad">Faisalabad</option>
                        <option value="Multan">Multan</option>
                        <option value="Sialkot">Sialkot</option>
                        <option value="Rawalpindi">Rawalpindi</option>
                        <option value="Peshawar">Peshawar</option>
                        <option value="Other">Other City</option>
                      </select>
                    </div>

                    {/* Phone / Email */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-lo)] mb-1.5">
                        WhatsApp Number / Phone *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="0300 1234567"
                        value={formData.contact}
                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] transition-colors font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Number of Branches */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-lo)] mb-1.5">
                        Number of Branches
                      </label>
                      <select
                        value={formData.branches}
                        onChange={(e) => setFormData({ ...formData, branches: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--gold)] transition-colors font-mono"
                      >
                        <option value="1">1 Branch</option>
                        <option value="2-3">2 – 3 Branches</option>
                        <option value="4-10">4 – 10 Branches</option>
                        <option value="10+">10+ Franchise Chain</option>
                      </select>
                    </div>

                    {/* Interested In */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-lo)] mb-1.5">
                        Interested In
                      </label>
                      <select
                        value={formData.interestedIn}
                        onChange={(e) => setFormData({ ...formData, interestedIn: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--gold)] transition-colors"
                      >
                        <option value="Complete POS + KDS + Online Ordering">Complete OS Suite</option>
                        <option value="POS & Billing Only">POS &amp; Billing Only</option>
                        <option value="Kitchen Display System (KDS)">Kitchen Display System (KDS)</option>
                        <option value="Online Marketplace & Delivery">Online Marketplace &amp; Delivery</option>
                        <option value="Inventory & Recipe Management">Inventory &amp; Recipe Management</option>
                      </select>
                    </div>
                  </div>

                  {/* Required Features */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-lo)] mb-1.5">
                      Specific Requirements or Current Hardware (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. We have 2 thermal printers and want recipe inventory tracking..."
                      value={formData.requiredFeatures}
                      onChange={(e) => setFormData({ ...formData, requiredFeatures: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] text-xs text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] transition-colors resize-none"
                    />
                  </div>

                  {/* WhatsApp Opt-in */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <input
                      type="checkbox"
                      id="wa-opt"
                      checked={formData.whatsappOptIn}
                      onChange={(e) => setFormData({ ...formData, whatsappOptIn: e.target.checked })}
                      className="w-4 h-4 rounded bg-[var(--bg-soft)] border-[var(--border)] accent-[var(--olive)] cursor-pointer"
                    />
                    <label htmlFor="wa-opt" className="text-xs text-[var(--text-lo)] cursor-pointer">
                      Receive demo link and instant pricing breakdown via WhatsApp
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full btn-gold py-3 text-sm font-bold shadow-lg shadow-[var(--gold-glow)] mt-2"
                  >
                    Request Free 1-on-1 Walkthrough &amp; Trial
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
