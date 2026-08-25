"use client";

import React, { useState } from "react";

export default function ProductShowcase() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    "POS Screen",
    "Kitchen Display",
    "Admin Dashboard",
    "Marketplace",
    "Inventory",
    "Reports",
  ];

  return (
    <section id="product" className="py-20 md:py-28 relative bg-[var(--bg-deep)]/60 border-y border-[var(--border)]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            Live Interface Mockup
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Explore the Omnibites Operating System
          </h2>
          <p className="text-[var(--text-lo)] text-base sm:text-lg">
            Switch between modules below to see how seamlessly Omnibites handles frontline billing, kitchen tickets, online marketplace, and backend financial control.
          </p>
        </div>

        {/* 6-Tab Switcher */}
        <div className="flex items-center justify-center mb-10 overflow-x-auto pb-2 scrollbar-none">
          <div className="inline-flex items-center p-1.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] backdrop-blur-md gap-1">
            {tabs.map((tab, idx) => (
              <button
                key={tab}
                onClick={() => setActiveTab(idx)}
                className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  activeTab === idx
                    ? "bg-gradient-to-r from-[#e3b13b] to-[#c99624] text-[#241a06] shadow-md shadow-[var(--gold-glow)]"
                    : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Device Frame Mock */}
        <div className="max-w-4xl mx-auto rounded-2xl bg-[var(--bg-soft)] border border-[var(--border-hi)] shadow-2xl overflow-hidden shadow-black/80 transition-all duration-300">
          {/* Chrome Top Bar */}
          <div className="bg-[var(--bg-deep)] px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--rust)] opacity-80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-[var(--gold)] opacity-80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-[var(--olive)] opacity-80 inline-block"></span>
            </div>

            <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] px-3 py-1 rounded-md text-[11px] font-mono text-[var(--text-lo)]">
              <svg className="w-3.5 h-3.5 text-[var(--gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>app.omnibites.pk/live/{tabs[activeTab].toLowerCase().replace(/\s+/g, "-")}</span>
            </div>

            <div className="font-mono text-xs text-[var(--olive)] font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--olive)] animate-live-dot"></span>
              LIVE SYNC
            </div>
          </div>

          {/* Screen Content Container */}
          <div className="p-4 sm:p-6 min-h-[420px] bg-[var(--bg-deep)]/90">
            {/* TAB 1: POS Screen */}
            {activeTab === 0 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-xs font-bold border border-[var(--gold)]/30">
                      TABLE #04
                    </span>
                    <span className="text-xs text-[var(--text-lo)]">Waiter: Hamza A.</span>
                  </div>
                  <div className="font-mono text-xs text-[var(--text-lo)]">
                    Order Ref: <span className="text-[var(--text-hi)] font-bold">#PK-9042</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Item List */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                      <div>
                        <div className="font-display text-xs sm:text-sm font-bold text-[var(--text-hi)]">
                          2x Gourmet Beef Smash Burger
                        </div>
                        <div className="text-[11px] text-[var(--text-lo)]">+ Extra Cheddar, + Jalapeno</div>
                      </div>
                      <div className="font-mono text-xs sm:text-sm font-bold text-[var(--text-hi)]">
                        ₨1,900
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                      <div>
                        <div className="font-display text-xs sm:text-sm font-bold text-[var(--text-hi)]">
                          1x Loaded Truffle Fries
                        </div>
                        <div className="text-[11px] text-[var(--text-lo)]">Garlic mayo dip</div>
                      </div>
                      <div className="font-mono text-xs sm:text-sm font-bold text-[var(--text-hi)]">
                        ₨650
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                      <div>
                        <div className="font-display text-xs sm:text-sm font-bold text-[var(--text-hi)]">
                          2x Mint Lemonade Cooler
                        </div>
                        <div className="text-[11px] text-[var(--text-lo)]">Less sugar</div>
                      </div>
                      <div className="font-mono text-xs sm:text-sm font-bold text-[var(--text-hi)]">
                        ₨500
                      </div>
                    </div>
                  </div>

                  {/* Bill Summary & Tenders */}
                  <div className="p-3.5 rounded-xl bg-[var(--bg-soft)] border border-[var(--border-hi)] space-y-3">
                    <div className="space-y-1.5 text-xs text-[var(--text-lo)] border-b border-[var(--border)] pb-2.5">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-mono text-[var(--text-hi)]">₨3,050</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sales Tax (16%)</span>
                        <span className="font-mono text-[var(--text-hi)]">₨488</span>
                      </div>
                      <div className="flex justify-between font-bold text-[var(--text-hi)] pt-1 text-sm">
                        <span>Bill Total</span>
                        <span className="font-mono text-[var(--gold)] text-base font-extrabold">₨3,538</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-mono uppercase text-[var(--text-faint)]">Tender Payment:</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button className="py-2 px-1 rounded bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-semibold text-[var(--text-hi)] hover:border-[var(--gold)] flex items-center justify-center gap-1">
                          💵 Cash
                        </button>
                        <button className="py-2 px-1 rounded bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-semibold text-[var(--gold)] hover:border-[var(--gold)] flex items-center justify-center gap-1">
                          ⚡ JazzCash
                        </button>
                        <button className="py-2 px-1 rounded bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-semibold text-[var(--olive)] hover:border-[var(--olive)] flex items-center justify-center gap-1">
                          🟢 Easypaisa
                        </button>
                        <button className="py-2 px-1 rounded bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-semibold text-[var(--text-lo)] hover:border-[var(--text-hi)] flex items-center justify-center gap-1">
                          💳 Card
                        </button>
                      </div>
                      <button className="w-full btn-gold py-2 text-xs font-bold mt-2">
                        Print Thermal Receipt (Urdu/Eng)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Kitchen Display */}
            {activeTab === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] text-xs font-mono">
                  <span className="text-[var(--text-lo)]">Active Kitchen Queue: <b className="text-[var(--gold)]">3 Orders</b></span>
                  <span className="text-[var(--olive)]">KDS Station: Main Grill &amp; Fryer</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Ticket 1 */}
                  <div className="p-3.5 rounded-xl bg-[var(--bg-soft)] border-2 border-[var(--rust)]/60 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                      <span className="font-mono text-xs font-bold text-[var(--text-hi)]">#1180 · Dine-In T2</span>
                      <span className="font-mono text-xs text-[var(--rust)] font-bold animate-pulse">08:42 RUSH</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-[var(--text-lo)]">
                      <li className="flex items-center gap-2">
                        <input type="checkbox" className="accent-[var(--olive)]" />
                        <span className="text-[var(--text-hi)] font-medium">1x Beef Double Stack</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <input type="checkbox" className="accent-[var(--olive)]" />
                        <span className="text-[var(--text-hi)] font-medium">1x Garlic Wings (6pcs)</span>
                      </li>
                    </ul>
                    <button className="w-full py-1.5 rounded bg-[var(--olive)]/20 border border-[var(--olive)]/40 text-[var(--olive)] font-mono text-xs font-bold hover:bg-[var(--olive)] hover:text-[#140c0c] transition-colors">
                      Mark Complete ✓
                    </button>
                  </div>

                  {/* Ticket 2 */}
                  <div className="p-3.5 rounded-xl bg-[var(--bg-soft)] border border-[var(--gold)]/50 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                      <span className="font-mono text-xs font-bold text-[var(--text-hi)]">#1181 · Takeaway</span>
                      <span className="font-mono text-xs text-[var(--gold)] font-bold">04:15 PREP</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-[var(--text-lo)]">
                      <li className="flex items-center gap-2">
                        <input type="checkbox" className="accent-[var(--olive)]" />
                        <span className="text-[var(--text-hi)] font-medium">2x Crispy Zinger Burger</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <input type="checkbox" className="accent-[var(--olive)]" />
                        <span className="text-[var(--text-hi)] font-medium">2x Regular Fries</span>
                      </li>
                    </ul>
                    <button className="w-full py-1.5 rounded bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] font-mono text-xs hover:border-[var(--gold)] transition-colors">
                      In Progress...
                    </button>
                  </div>

                  {/* Ticket 3 */}
                  <div className="p-3.5 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                      <span className="font-mono text-xs font-bold text-[var(--text-hi)]">#1182 · Delivery #8</span>
                      <span className="font-mono text-xs text-[var(--text-lo)]">00:30 NEW</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-[var(--text-lo)]">
                      <li className="flex items-center gap-2">
                        <input type="checkbox" className="accent-[var(--olive)]" />
                        <span className="text-[var(--text-hi)] font-medium">1x Chicken Karahi Full</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <input type="checkbox" className="accent-[var(--olive)]" />
                        <span className="text-[var(--text-hi)] font-medium">4x Roghani Naan</span>
                      </li>
                    </ul>
                    <button className="w-full py-1.5 rounded bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] font-mono text-xs hover:border-[var(--gold)] transition-colors">
                      Accept &amp; Fire 🔥
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Admin Dashboard */}
            {activeTab === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-[11px] text-[var(--text-lo)]">Today&apos;s Gross Sales</div>
                    <div className="font-mono text-base sm:text-lg font-bold text-[var(--gold)] mt-0.5">
                      ₨184,500
                    </div>
                    <div className="text-[10px] font-mono text-[var(--olive)]">↑ 24% vs yesterday</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-[11px] text-[var(--text-lo)]">Completed Orders</div>
                    <div className="font-mono text-base sm:text-lg font-bold text-[var(--text-hi)] mt-0.5">
                      142 Orders
                    </div>
                    <div className="text-[10px] font-mono text-[var(--text-faint)]">Avg ₨1,299/bill</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-[11px] text-[var(--text-lo)]">Active Branches</div>
                    <div className="font-mono text-base sm:text-lg font-bold text-[var(--text-hi)] mt-0.5">
                      3 / 3 Online
                    </div>
                    <div className="text-[10px] font-mono text-[var(--olive)]">Lahore · Karachi · Isb</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-[11px] text-[var(--text-lo)]">Kitchen SLA Avg</div>
                    <div className="font-mono text-base sm:text-lg font-bold text-[var(--olive)] mt-0.5">
                      11m 45s
                    </div>
                    <div className="text-[10px] font-mono text-[var(--olive)]">Target &lt; 15m</div>
                  </div>
                </div>

                {/* Sales Hourly Bar Chart Strip */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-display font-semibold text-[var(--text-hi)]">Hourly Sales Velocity (PKR)</span>
                    <span className="font-mono text-[var(--text-lo)] text-[11px]">Peak: 8:00 PM – 10:00 PM</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1.5 items-end h-24 pt-4">
                    {[15, 22, 18, 30, 45, 60, 50, 75, 95, 100, 85, 40].map((h, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 group">
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-[var(--gold)] to-[var(--orange)] opacity-85 group-hover:opacity-100 transition-opacity"
                          style={{ height: `${h}%` }}
                        ></div>
                        <span className="text-[8px] font-mono text-[var(--text-faint)]">{12 + i}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Marketplace */}
            {activeTab === 3 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--olive)]"></span>
                    <span className="text-xs font-semibold text-[var(--text-hi)]">Customer Ordering App · Gulberg Lahore</span>
                  </div>
                  <span className="font-mono text-xs text-[var(--gold)] font-bold">Delivery ETA: 25-35 mins</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
                    <div className="w-full h-20 rounded-lg bg-[var(--bg-soft)] flex items-center justify-center text-3xl">
                      🍔
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-xs text-[var(--text-hi)]">Firehouse Double Beef</div>
                        <div className="text-[10px] text-[var(--text-lo)]">Smoked gouda &amp; bbq aioli</div>
                      </div>
                      <div className="font-mono text-xs font-bold text-[var(--gold)]">₨950</div>
                    </div>
                    <button className="w-full btn-gold py-1 text-[11px] font-bold">
                      Add to Cart +
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
                    <div className="w-full h-20 rounded-lg bg-[var(--bg-soft)] flex items-center justify-center text-3xl">
                      🍗
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-xs text-[var(--text-hi)]">Peri-Peri Tender Strip</div>
                        <div className="text-[10px] text-[var(--text-lo)]">Served with seasoned fries</div>
                      </div>
                      <div className="font-mono text-xs font-bold text-[var(--gold)]">₨820</div>
                    </div>
                    <button className="w-full btn-gold py-1 text-[11px] font-bold">
                      Add to Cart +
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
                    <div className="w-full h-20 rounded-lg bg-[var(--bg-soft)] flex items-center justify-center text-3xl">
                      🥤
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-xs text-[var(--text-hi)]">Cold Brew Caramel</div>
                        <div className="text-[10px] text-[var(--text-lo)]">Fresh espresso &amp; foam</div>
                      </div>
                      <div className="font-mono text-xs font-bold text-[var(--gold)]">₨450</div>
                    </div>
                    <button className="w-full btn-gold py-1 text-[11px] font-bold">
                      Add to Cart +
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--bg-soft)] border border-[var(--border)] flex items-center justify-between text-xs font-mono">
                  <span>Cart: <b>2 Items (₨1,770)</b></span>
                  <span className="text-[var(--gold)] font-bold">Checkout with JazzCash / Easypaisa →</span>
                </div>
              </div>
            )}

            {/* TAB 5: Inventory */}
            {activeTab === 4 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] text-xs">
                  <span className="font-semibold text-[var(--text-hi)]">Raw Ingredient Stock &amp; Recipe Ledger</span>
                  <span className="font-mono text-[var(--rust)] font-bold">2 Items Below Reorder Level</span>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[var(--text-hi)]">Prime Beef Patties (150g)</div>
                      <div className="text-[11px] text-[var(--text-lo)] font-mono">Unit Cost: ₨240 / patty · Deducts 1 per burger</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[var(--text-hi)]">148 pcs</div>
                      <div className="text-[10px] font-mono text-[var(--olive)]">Healthy Stock</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--rust-dim)]/30 border border-[var(--rust)]/40 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[var(--text-hi)]">Brioche Buns (Fresh Daily)</div>
                      <div className="text-[11px] text-[var(--rust)] font-mono">⚠️ Low Stock alert (Threshold: 50 pcs)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[var(--rust)]">28 pcs left</div>
                      <button className="text-[10px] font-mono text-[var(--gold)] underline mt-0.5">
                        Auto Reorder 100 pcs
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[var(--text-hi)]">Cooking Oil (Canola 16L Tin)</div>
                      <div className="text-[11px] text-[var(--text-lo)] font-mono">Unit Cost: ₨8,400 / tin · 4 Tins in Storage</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[var(--text-hi)]">4 Tins</div>
                      <div className="text-[10px] font-mono text-[var(--olive)]">Adequate (6 days)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: Reports */}
            {activeTab === 5 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] text-xs">
                  <span className="font-semibold text-[var(--text-hi)]">End-of-Day Financial &amp; Payment Settlement</span>
                  <span className="font-mono text-[var(--text-lo)]">Period: Today (PKT)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-[11px] text-[var(--text-lo)]">JazzCash QR &amp; App</div>
                    <div className="font-mono text-base font-bold text-[var(--gold)] mt-0.5">₨78,400</div>
                    <div className="text-[10px] font-mono text-[var(--text-faint)]">42.5% of total volume</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-[11px] text-[var(--text-lo)]">Easypaisa Mobile</div>
                    <div className="font-mono text-base font-bold text-[var(--olive)] mt-0.5">₨51,200</div>
                    <div className="text-[10px] font-mono text-[var(--text-faint)]">27.7% of total volume</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-[11px] text-[var(--text-lo)]">Cash on Delivery &amp; Till</div>
                    <div className="font-mono text-base font-bold text-[var(--text-hi)] mt-0.5">₨54,900</div>
                    <div className="text-[10px] font-mono text-[var(--text-faint)]">29.8% of total volume</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)]">
                  <div className="text-xs font-semibold text-[var(--text-hi)] mb-2">Top Grossing Dishes Today (PKR)</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-lo)]">1. Classic Cheeseburger Combo</span>
                      <span className="font-mono font-bold text-[var(--text-hi)]">₨42,600 (36 sold)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-lo)]">2. Special Chicken Handi (Half)</span>
                      <span className="font-mono font-bold text-[var(--text-hi)]">₨34,500 (23 sold)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-lo)]">3. Crispy Club Sandwich</span>
                      <span className="font-mono font-bold text-[var(--text-hi)]">₨22,800 (38 sold)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
