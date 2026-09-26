"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { Receipt, TrendingUp, Calendar, Clock } from "lucide-react";
import { OrderRecord } from "../../types";

export type TimeRange = "1D" | "7D" | "1M" | "1Y";

interface DataPoint {
  label: string;
  fullLabel: string;
  value: number;
  showTick: boolean;
}

interface RevenueVelocityChartProps {
  orders: OrderRecord[];
}

export default function RevenueVelocityChart({ orders = [] }: RevenueVelocityChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1D");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Helper to safely parse dates across created_at, createdAt, and timestamp
  const parseOrderDate = useCallback((o: OrderRecord): Date | null => {
    const raw = (o as any).created_at || (o as any).createdAt || o.timestamp;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }, []);

  // Filter out cancelled orders
  const validOrders = useMemo(() => {
    return orders.filter((o) => o.status !== "cancelled");
  }, [orders]);

  // Aggregate data points based on selected timeRange
  const chartData = useMemo(() => {
    const now = new Date();

    if (timeRange === "1D") {
      // Operating hours from 10 AM to 11 PM
      const hours = [
        { h: 10, label: "10 AM" },
        { h: 11, label: "11 AM" },
        { h: 12, label: "12 PM" },
        { h: 13, label: "1 PM" },
        { h: 14, label: "2 PM" },
        { h: 15, label: "3 PM" },
        { h: 16, label: "4 PM" },
        { h: 17, label: "5 PM" },
        { h: 18, label: "6 PM" },
        { h: 19, label: "7 PM" },
        { h: 20, label: "8 PM" },
        { h: 21, label: "9 PM" },
        { h: 22, label: "10 PM" },
        { h: 23, label: "11 PM" },
      ];

      const points: DataPoint[] = hours.map(({ h, label }) => {
        let rev = 0;
        validOrders.forEach((o) => {
          const d = parseOrderDate(o);
          if (!d) return;
          const isToday =
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate();
          if (isToday && d.getHours() === h) {
            rev += o.total || 0;
          }
        });
        return {
          label,
          fullLabel: `${label} Today`,
          value: rev,
          showTick: true,
        };
      });

      return {
        title: "Today's Hourly Revenue",
        subtitle: "Dynamic revenue distribution by hour of settlement",
        points,
      };
    }

    if (timeRange === "7D") {
      // Past 7 days ending today
      const points: DataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);

        let rev = 0;
        validOrders.forEach((o) => {
          const orderDate = parseOrderDate(o);
          if (!orderDate) return;
          const od = new Date(orderDate);
          od.setHours(0, 0, 0, 0);
          if (od.getTime() === d.getTime()) {
            rev += o.total || 0;
          }
        });

        const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
        const fullDate = d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        points.push({
          label: i === 0 ? "Today" : dayName,
          fullLabel: fullDate,
          value: rev,
          showTick: true,
        });
      }

      return {
        title: "Past 7 Days Revenue",
        subtitle: "Daily gross revenue over the past week",
        points,
      };
    }

    if (timeRange === "1M") {
      // Past 30 days
      const points: DataPoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);

        let rev = 0;
        validOrders.forEach((o) => {
          const orderDate = parseOrderDate(o);
          if (!orderDate) return;
          const od = new Date(orderDate);
          od.setHours(0, 0, 0, 0);
          if (od.getTime() === d.getTime()) {
            rev += o.total || 0;
          }
        });

        const shortLabel = `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`;
        const fullDate = d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

        // Show tick roughly every 5 days or first/last to avoid overcrowding
        const showTick = i === 29 || i === 0 || i % 5 === 0;

        points.push({
          label: shortLabel,
          fullLabel: fullDate,
          value: rev,
          showTick,
        });
      }

      return {
        title: "Monthly Revenue Trend",
        subtitle: "Daily performance breakdown across the last 30 days",
        points,
      };
    }

    // 1Y - Yearly Mode (All 12 months of current year)
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const currentYear = now.getFullYear();
    const points: DataPoint[] = monthNames.map((mName, mIdx) => {
      let rev = 0;
      validOrders.forEach((o) => {
        const d = parseOrderDate(o);
        if (!d) return;
        if (d.getFullYear() === currentYear && d.getMonth() === mIdx) {
          rev += o.total || 0;
        }
      });

      return {
        label: mName,
        fullLabel: `${mName} ${currentYear}`,
        value: rev,
        showTick: true,
      };
    });

    return {
      title: "Annual Revenue Performance",
      subtitle: `Monthly revenue aggregate for ${currentYear}`,
      points,
    };
  }, [timeRange, validOrders, parseOrderDate]);

  const { points, title, subtitle } = chartData;

  const totalPeriodRevenue = useMemo(() => {
    return points.reduce((acc, p) => acc + p.value, 0);
  }, [points]);

  const maxVal = useMemo(() => {
    return Math.max(...points.map((p) => p.value), 0);
  }, [points]);

  const hasOrders = totalPeriodRevenue > 0;

  // SVG Coordinates setup
  const SVG_WIDTH = 800;
  const SVG_HEIGHT = 200;
  const PADDING_TOP = 25;
  const PADDING_BOTTOM = 25;
  const PADDING_X = 20;

  const usableWidth = SVG_WIDTH - PADDING_X * 2;
  const usableHeight = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  // Map data points to SVG coordinates
  const coords = useMemo(() => {
    if (points.length === 0) return [];
    const step = points.length > 1 ? usableWidth / (points.length - 1) : usableWidth;

    return points.map((p, idx) => {
      const x = PADDING_X + idx * step;
      // Invert Y so highest value is at top
      const ratio = maxVal > 0 ? p.value / maxVal : 0;
      const y = PADDING_TOP + usableHeight - ratio * usableHeight;
      return { x, y, ...p };
    });
  }, [points, usableWidth, usableHeight, maxVal, PADDING_X, PADDING_TOP]);

  // Build Catmull-Rom / Monotone Smooth Bezier Paths
  const { linePath, areaPath } = useMemo(() => {
    if (coords.length === 0) return { linePath: "", areaPath: "" };
    if (coords.length === 1) {
      const p = coords[0];
      return {
        linePath: `M ${p.x} ${p.y}`,
        areaPath: `M ${p.x} ${p.y} L ${p.x} ${SVG_HEIGHT - PADDING_BOTTOM} Z`,
      };
    }

    let d = `M ${coords[0].x},${coords[0].y}`;

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2 < coords.length ? i + 2 : coords.length - 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;

      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }

    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const bottomY = SVG_HEIGHT - PADDING_BOTTOM;

    const area = `${d} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;

    return { linePath: d, areaPath: area };
  }, [coords, SVG_HEIGHT, PADDING_BOTTOM]);

  // Mouse / Touch interaction handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      if (!svgRef.current || coords.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const relativeX = clientX - rect.left;
      const svgX = (relativeX / rect.width) * SVG_WIDTH;

      // Find nearest point
      let closestIdx = 0;
      let minDistance = Infinity;

      coords.forEach((pt, i) => {
        const dist = Math.abs(pt.x - svgX);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      });

      setHoveredIndex(closestIdx);
    },
    [coords, SVG_WIDTH]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  const hoveredPoint = hoveredIndex !== null ? coords[hoveredIndex] : null;

  return (
    <div className="glass-panel p-5 sm:p-6 rounded-2xl space-y-4 border border-[var(--border)] shadow-xl relative transition-colors duration-200">
      {/* Top Header with Title and Segmented Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border)]/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-extrabold text-base sm:text-lg text-[var(--text-hi)] tracking-tight">
              {title}
            </h3>
            {hasOrders && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <TrendingUp className="w-3 h-3" />
                Live
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-lo)] font-mono mt-0.5">{subtitle}</p>
        </div>

        {/* Financial Trading Ticker Timeframe Switcher (1D, 7D, 1M, 1Y) */}
        <div className="flex items-center gap-1 bg-[var(--surface-hi)]/80 border border-[var(--border)] p-1 rounded-xl self-start sm:self-auto overflow-x-auto no-scrollbar">
          {(["1D", "7D", "1M", "1Y"] as TimeRange[]).map((tf) => {
            const isActive = timeRange === tf;
            return (
              <button
                key={tf}
                type="button"
                onClick={() => {
                  setTimeRange(tf);
                  setHoveredIndex(null);
                }}
                className={`transition-all rounded-lg text-xs font-semibold cursor-pointer select-none ${
                  isActive
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2.5 py-1 shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 px-2 py-1 border border-transparent font-medium"
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>
      </div>

      {/* Metric Quick Stats Bar */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div>
          <span className="text-[var(--text-faint)] uppercase tracking-wider text-[10px]">
            Period Aggregate:
          </span>
          <span className="ml-2 font-bold text-[var(--gold)] text-sm sm:text-base">
            Rs {totalPeriodRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
        {hasOrders && (
          <div className="text-[var(--text-faint)] text-[11px]">
            Peak: <span className="text-[var(--text-hi)] font-semibold">Rs {maxVal.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Main SVG Area Chart Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        {!hasOrders ? (
          /* Empty State: No settled orders for selected timeframe */
          <div className="h-44 sm:h-52 flex flex-col items-center justify-center rounded-xl bg-[var(--surface-hi)]/20 border border-dashed border-[var(--border)] p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
              <Receipt className="w-5 h-5 text-amber-400 opacity-80" />
            </div>
            <p className="text-xs sm:text-sm font-mono font-bold text-[var(--text-hi)]">
              No settled orders found for this period
            </p>
            <p className="text-[11px] font-mono text-[var(--text-faint)] mt-1 max-w-sm">
              Settle bills at the POS counter or complete kitchen tickets to stream real-time revenue velocity.
            </p>
          </div>
        ) : (
          <div className="relative w-full">
            {/* Hover Tooltip Floating Banner */}
            {hoveredPoint && (
              <div
                className="absolute top-1 z-20 pointer-events-none transition-all duration-75 px-3 py-1.5 rounded-xl bg-[#14120e]/95 border border-amber-500/40 text-xs shadow-2xl backdrop-blur-md flex items-center gap-1.5 font-mono"
                style={{
                  left: `${Math.min(Math.max((hoveredPoint.x / SVG_WIDTH) * 100, 15), 85)}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-bold text-amber-400">
                  Rs {hoveredPoint.value.toLocaleString()}
                </span>
                <span className="text-neutral-400 text-[11px]">• {hoveredPoint.fullLabel}</span>
              </div>
            )}

            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full h-44 sm:h-52 overflow-visible cursor-crosshair touch-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseLeave}
            >
              <defs>
                {/* Smooth Area Amber Gradient */}
                <linearGradient id="revenueAmberGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="65%" stopColor="#f59e0b" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
                </linearGradient>

                {/* Subtle horizontal grid lines */}
                <pattern id="gridLinePattern" width="100" height="40" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" strokeOpacity="0.06" />
                </pattern>
              </defs>

              {/* Background Horizontal Guide Lines */}
              <g className="text-[var(--border)]" opacity={0.4}>
                <line x1={PADDING_X} y1={PADDING_TOP} x2={SVG_WIDTH - PADDING_X} y2={PADDING_TOP} stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" />
                <line x1={PADDING_X} y1={PADDING_TOP + usableHeight * 0.5} x2={SVG_WIDTH - PADDING_X} y2={PADDING_TOP + usableHeight * 0.5} stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" />
                <line x1={PADDING_X} y1={SVG_HEIGHT - PADDING_BOTTOM} x2={SVG_WIDTH - PADDING_X} y2={SVG_HEIGHT - PADDING_BOTTOM} stroke="currentColor" strokeWidth="1" />
              </g>

              {/* Gradient Area Fill */}
              {areaPath && (
                <path
                  d={areaPath}
                  fill="url(#revenueAmberGrad)"
                  className="transition-all duration-300"
                />
              )}

              {/* Amber Curve Stroke */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300 drop-shadow-[0_4px_8px_rgba(245,158,11,0.25)]"
                />
              )}

              {/* Interactive Crosshair & Indicator Dot */}
              {hoveredPoint && (
                <g>
                  {/* Vertical dashed crosshair */}
                  <line
                    x1={hoveredPoint.x}
                    y1={PADDING_TOP}
                    x2={hoveredPoint.x}
                    y2={SVG_HEIGHT - PADDING_BOTTOM}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    strokeOpacity="0.75"
                  />

                  {/* Active glowing point */}
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.y}
                    r="8"
                    fill="#f59e0b"
                    fillOpacity="0.25"
                    className="animate-ping"
                  />
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.y}
                    r="5"
                    fill="#f59e0b"
                    stroke="#14120e"
                    strokeWidth="2"
                    className="drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]"
                  />
                </g>
              )}

              {/* Peak points or discrete data points when count is small */}
              {coords.length <= 14 &&
                coords.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredIndex === i ? 5.5 : pt.value === maxVal && maxVal > 0 ? 3.5 : 2}
                    fill={pt.value === maxVal && maxVal > 0 ? "#f59e0b" : "#e3b13b"}
                    stroke="#14120e"
                    strokeWidth={1}
                    className="transition-all"
                  />
                ))}
            </svg>

            {/* X-Axis Labels (Responsive and clean without overflow) */}
            <div className="flex items-center justify-between px-2 pt-1 border-t border-[var(--border)]/40 text-[9px] sm:text-[10px] font-mono text-[var(--text-faint)] overflow-hidden">
              {coords.map((c, idx) => {
                if (!c.showTick) return null;
                const isHovered = hoveredIndex === idx;
                return (
                  <span
                    key={idx}
                    className={`truncate transition-colors ${
                      isHovered ? "text-amber-400 font-bold" : "hover:text-[var(--text-hi)]"
                    }`}
                  >
                    {c.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
