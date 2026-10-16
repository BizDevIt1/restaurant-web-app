"use client";

import React, { useState } from "react";
import { X, LayoutGrid, Check, Users, AlertTriangle } from "lucide-react";
import { TableStatus, OrderRecord } from "@/app/admin/types";
import { isTableMatchingIdentifier } from "@/lib/tableOccupancy";

interface FloorMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: TableStatus[];
  selectedTable: number;
  onSelectTable: (tableId: number) => void;
  orders?: any[];
}

export default function FloorMatrixModal({
  isOpen,
  onClose,
  tables,
  selectedTable,
  onSelectTable,
  orders = [],
}: FloorMatrixModalProps) {
  const [sectionFilter, setSectionFilter] = useState<string>("all");

  if (!isOpen) return null;

  const sections = Array.from(new Set(tables.map((t) => t.section || "Main Dining")));

  const getRunningOrder = (table: TableStatus) => {
    if (!orders || orders.length === 0) return undefined;
    return orders.find(
      (o) =>
        (isTableMatchingIdentifier(table, o.tableId) ||
          isTableMatchingIdentifier(table, o.tableName) ||
          (table.activeOrderId && (o.id === table.activeOrderId || o.kotId === table.activeOrderId))) &&
        o.status !== "cancelled" &&
        o.status !== "voided" &&
        o.status !== "archived" &&
        o.payment_status !== "paid" &&
        o.paymentStatus !== "paid"
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
                Select an available table for a new order. Occupied tables are locked until settled.
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
            const runningOrder = getRunningOrder(t);
            const isBilled = t.status === "billing";
            const isReserved = t.status === "reserved";
            const isOccupied =
              Boolean(runningOrder) ||
              t.status === "seated" ||
              t.status === "occupied" ||
              Boolean(t.activeOrderId);
            const runningAmount = runningOrder?.total ?? t.activeAmount;
            return (
              <div
                key={t.id}
                onClick={() => {
                  if (isOccupied) return;
                  onSelectTable(t.id);
                  onClose();
                }}
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2 select-none ${
                  isOccupied
                    ? "border-red-500/20 bg-red-500/5 opacity-55 cursor-not-allowed"
                    : isSelected
                    ? "border-[var(--gold)] bg-[var(--gold-dim)] shadow-md ring-1 ring-[var(--gold)] cursor-pointer"
                    : isBilled
                    ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 cursor-pointer"
                    : isReserved
                    ? "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 cursor-pointer"
                    : "glass-panel hover:border-[var(--gold)]/60 cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-[var(--text-hi)] flex items-center gap-1.5">
                    {t.label}
                    {isOccupied ? (
                      <span className="text-[10px] text-red-400" title="Table is occupied with active order">🔒</span>
                    ) : null}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[var(--text-lo)] truncate max-w-[70px]">
                    {t.section || "Main Dining"}
                  </span>
                  {runningAmount !== undefined && runningAmount > 0 && (
                    <span className="font-bold text-red-400">
                      Rs {runningAmount.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-[var(--text-lo)]">
                    <Users className="w-2.5 h-2.5" />
                    {t.capacity}
                  </span>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-1 ${
                      isOccupied
                        ? "text-red-400 bg-red-500/20 border border-red-500/30 font-bold"
                        : isBilled
                        ? "text-amber-400 bg-amber-500/20 border border-amber-500/30"
                        : isReserved
                        ? "text-blue-400 bg-blue-500/20 border border-blue-500/30"
                        : "text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 font-bold"
                    }`}
                  >
                    {isOccupied
                      ? "OCCUPIED"
                      : isBilled
                      ? "BILLED"
                      : isReserved
                      ? "RESERVED"
                      : "AVAILABLE"}
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
