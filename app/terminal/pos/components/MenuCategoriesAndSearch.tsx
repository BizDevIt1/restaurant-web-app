"use client";

import React from "react";
import { Search, X, ChevronDown, Sparkles } from "lucide-react";

export interface CategoryOption {
  id: string;
  label: string;
  count: number;
}

interface MenuCategoriesAndSearchProps {
  categories: CategoryOption[];
  selectedCategory: string;
  onSelectCategory: (catId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalFilteredCount: number;
}

export default function MenuCategoriesAndSearch({
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  totalFilteredCount,
}: MenuCategoriesAndSearchProps) {
  return (
    <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
      {/* Category Dropdown (styled identically to search bar) */}
      <div className="relative w-[44%] sm:w-60 shrink-0">
        <select
          value={selectedCategory}
          onChange={(e) => onSelectCategory(e.target.value)}
          className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-[var(--text-hi)] text-xs font-mono rounded-xl pl-3 pr-8 py-2.5 h-10 focus:outline-none transition-all shadow-inner cursor-pointer"
        >
          <option value="all" className="bg-[#1a1400] text-[var(--text-hi)]">
            All Categories ({totalFilteredCount})
          </option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id} className="bg-[#1a1400] text-[var(--text-hi)]">
              {cat.label} ({cat.count})
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
      </div>

      {/* Search Bar */}
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search dishes or items..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-[var(--text-hi)] placeholder:text-[var(--text-faint)] text-xs font-mono rounded-xl pl-9 pr-9 py-2.5 h-10 focus:outline-none transition-all shadow-inner"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--surface-hi)] text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
