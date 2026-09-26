"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface ResponsiveSelectOption {
  id: string;
  label: string;
  count?: number | string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
}

interface ResponsiveSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (ResponsiveSelectOption | string)[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  labelPrefix?: string;
  size?: "sm" | "md";
}

export default function ResponsiveSelect({
  value,
  onChange,
  options,
  placeholder = "Select option...",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  labelPrefix = "",
  size = "md",
}: ResponsiveSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options
  const normalizedOptions: ResponsiveSelectOption[] = options.map((opt) => {
    if (typeof opt === "string") {
      return { id: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((opt) => opt.id === value);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const py = size === "sm" ? "py-1.5" : "py-2.5";
  const textSz = size === "sm" ? "text-[11px]" : "text-xs";

  return (
    <div ref={containerRef} className={`relative w-full max-w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-[var(--gold)] ${textSz} rounded-xl pl-3.5 pr-8 ${py} focus:outline-none font-medium cursor-pointer shadow-sm transition-all flex items-center justify-between gap-2 text-left truncate ${buttonClassName} ${
          isOpen ? "border-[var(--gold)] ring-1 ring-[var(--gold)]/30" : ""
        }`}
      >
        <span className="truncate flex items-center gap-1.5">
          {labelPrefix && <span className="text-[var(--text-faint)] font-mono">{labelPrefix}</span>}
          {selectedOption?.icon}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          {selectedOption?.count !== undefined && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] shrink-0 ml-1">
              {selectedOption.count}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--gold)] transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Responsive Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute left-0 top-full mt-1.5 min-w-full w-full max-w-[calc(100vw-2rem)] z-50 rounded-xl bg-[var(--bg-deep)] border border-[var(--gold)]/30 shadow-2xl backdrop-blur-2xl p-1 max-h-60 overflow-y-auto space-y-0.5 animate-in fade-in zoom-in-95 duration-150 scrollbar-thin ${menuClassName}`}
          style={{ boxSizing: "border-box" }}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 ${textSz} rounded-lg flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
                  isSelected
                    ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold border border-[var(--gold)]/30"
                    : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                }`}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {opt.count !== undefined && (
                    <span
                      className={`text-[10.5px] font-mono px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? "bg-[var(--gold)]/20 text-[var(--gold)] font-bold"
                          : "bg-[var(--surface-hi)] text-[var(--text-faint)]"
                      }`}
                    >
                      {opt.count}
                    </span>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
