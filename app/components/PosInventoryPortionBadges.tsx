"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { PortionYieldResult } from "@/lib/posLedgerSync";

interface ItemPortionAvailabilityTextProps {
  displayText: string;
  textColorClass: string;
  className?: string;
}

export function ItemPortionAvailabilityText({
  displayText,
  textColorClass,
  className = "",
}: ItemPortionAvailabilityTextProps) {
  return (
    <p
      className={`text-[10px] sm:text-[11px] font-mono leading-tight mt-1 truncate ${textColorClass} ${className}`}
    >
      {displayText}
    </p>
  );
}

interface ItemStockStatusBadgeProps {
  isOutOfStock: boolean;
  portionCount: number;
  className?: string;
}

export function ItemStockStatusBadge({
  isOutOfStock,
  portionCount,
  className = "",
}: ItemStockStatusBadgeProps) {
  if (portionCount <= 0) {
    return (
      <span className={`badge-pill badge-danger ${className}`}>
        <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
        <span>OUT OF STOCK</span>
      </span>
    );
  }

  if (portionCount <= 5) {
    return (
      <span className={`badge-pill badge-warning ${className}`}>
        <span className="badge-dot animate-pulse" />
        <span>LOW STOCK ({portionCount})</span>
      </span>
    );
  }

  return (
    <span className={`badge-pill badge-success ${className}`}>
      <span className="badge-dot" />
      <span>IN STOCK ({portionCount})</span>
    </span>
  );
}

interface VariantPortionBadgeProps {
  yieldResult: PortionYieldResult;
  className?: string;
}

export function VariantPortionBadge({
  yieldResult,
  className = "",
}: VariantPortionBadgeProps) {
  const isOutOfStock = yieldResult.isOutOfStock || yieldResult.maxPortions <= 0;

  if (isOutOfStock) {
    return (
      <span className={`badge-pill badge-danger text-[9px] px-2 py-0.5 rounded-md ${className}`}>
        <span className="badge-dot" />
        <span>0 left (Out of Stock)</span>
      </span>
    );
  }

  if (yieldResult.maxPortions <= 5) {
    return (
      <span className={`badge-pill badge-warning text-[9px] px-2 py-0.5 rounded-md ${className}`}>
        <span className="badge-dot animate-pulse" />
        <span>{yieldResult.maxPortions} left</span>
      </span>
    );
  }

  return (
    <span className={`badge-pill badge-success text-[9px] px-2 py-0.5 rounded-md ${className}`}>
      <span className="badge-dot" />
      <span>{yieldResult.maxPortions} portions</span>
    </span>
  );
}

