"use client";

import React, { useState } from "react";
import { X, LayoutGrid, Check, Users } from "lucide-react";
import { TableStatus, OrderRecord } from "@/app/admin/types";

interface FloorMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: TableStatus[];
  selectedTable: number;
  onSelectTable: (tableId: number) => void;
  orders: OrderRecord[];
}

export default function FloorMatrixModal({
  isOpen,
  onClose,
  tables,
  selectedTable,
  onSelectTable,
  orders,
}: FloorMatrixModalProps) {
  const [sectionFilter, setSectionFilter] = useState<string>("all");

  if (!isOpen) return null;

  const sections = Array.from(new Set(tables.map((t) => t.section || "Main Dining")));

  const getRunningOrder = (table: TableStatus) => {
    return orders.find(
      (o) =>
        (o.tableId === table.id ||
          (table.activeOrderId && (o.id === table.activeOrderId || o.kotId === table.activeOrderId))) &&
        o.status !== "completed" &&
        o.status !== "cancelled"
    );
  };

  const filteredTables = tables.filter(
    (t) => sectionFilter === "all" || (t.section || "Main Dining") === sectionFilter
  );

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 no-print"
    >
      <div className="w-[95vw] max-w-2xl rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-2xl p-4 sm:p-6 space-y-4 max-h-[90vh] flex flex-col mx-auto animate-in zoom-in-95 duration-150 text-[var(--text-hi)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/25 text-[var(--gold)] flex items-center justify-center shrink-0">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-hi)]">
                Dining Room Floor Matrix
              </h3>
              <p className="text-xs font-mono text-[var(--text-lo)]">
                Select a table to assign or recall running order tab.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Filter Dropdown */}
        <div className="relative w-full sm:w-64">
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="w-full appearance-none bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] text-[var(--text-hi)] text-xs font-mono rounded-xl pl-3 pr-8 py-2 h-9 focus:outline-none transition-all shadow-inner cursor-pointer"
          >
            <option value="all" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
              All Sections ({tables.length})
            </option>
            {sections.map((sec) => {
              const count = tables.filter((t) => (t.section || "Main Dining") === sec).length;
              return (
                <option key={sec} value={sec} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                  {sec} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto pr-1 py-1">
          {filteredTables.map((t) => {
            const isSelected = t.id === selectedTable;
            const isOccupied = t.status === "seated" || t.status === "occupied";
            const isBilled = t.status === "billing";
            const isReserved = t.status === "reserved";
            const runningOrder = getRunningOrder(t);
            const runningAmount = runningOrder?.total ?? t.activeAmount;

            return (
              <div
                key={t.id}
                onClick={() => {
                  onSelectTable(t.id);
                  onClose();
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${isSelected
                    ? "border-[var(--gold)] bg-[var(--gold-dim)] shadow-md ring-1 ring-[var(--gold)]"
                    : isOccupied
                      ? "border-red-500/30 bg-red-500/5 hover:border-red-500/50"
                      : isBilled
                        ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                        : isReserved
                          ? "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50"
                          : "glass-panel hover:border-[var(--gold)]/40"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-[var(--text-hi)]">
                    {t.label}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[var(--text-lo)] truncate max-w-[70px]">
                    {t.section || "Main Dining"}
                  </span>
                  {runningAmount !== undefined && runningAmount > 0 && (
                    <span className="font-bold text-red-500">Rs {runningAmount.toLocaleString()}</span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-[var(--text-lo)]">
                    <Users className="w-2.5 h-2.5" />
                    {t.capacity}
                  </span>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isOccupied
                        ? "text-red-500 bg-red-500/15"
                        : isBilled
                          ? "text-amber-500 bg-amber-500/15"
                          : isReserved
                            ? "text-blue-500 bg-blue-500/15"
                            : "text-emerald-500 bg-emerald-500/15"
                      }`}
                  >
                    {isOccupied ? "Occupied" : isBilled ? "Billed" : isReserved ? "Reserved" : "Available"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[var(--border)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-xs text-[var(--text-lo)] font-medium border border-[var(--border)] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
