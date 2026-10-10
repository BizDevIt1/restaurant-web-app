"use client";

import React from "react";
import PosTerminalClient from "@/app/terminal/pos/PosTerminalClient";
import { MenuItem, CartItem, TableStatus, OrderRecord, StaffMember } from "../../types";

export interface PosViewProps {
  menuItems?: MenuItem[];
  cart?: CartItem[];
  handleAddToCart?: (item: MenuItem) => void;
  handleUpdateCartQty?: (itemId: string, delta: number) => void;
  orderChannel?: "dine_in" | "takeaway" | "delivery";
  setOrderChannel?: (ch: "dine_in" | "takeaway" | "delivery") => void;
  selectedTable?: number;
  setSelectedTable?: (id: number) => void;
  tables?: TableStatus[];
  setTables?: React.Dispatch<React.SetStateAction<TableStatus[]>>;
  paymentMethod?: "cash" | "card" | "raast";
  setPaymentMethod?: (p: "cash" | "card" | "raast") => void;
  cartSubtotal?: number;
  taxAmount?: number;
  taxRatePercent?: number;
  discountPercent?: number;
  discountAmount?: number;
  cartTotal?: number;
  handleSendToKitchen?: (deliveryMeta?: { customerName?: string; customerPhone?: string; deliveryZone?: string }) => void;
  onSettleOrder?: (order: OrderRecord) => void;
  setCart?: React.Dispatch<React.SetStateAction<CartItem[]>>;
  orders?: OrderRecord[];
  staffList?: StaffMember[];
  showToast?: (msg: string) => void;
}

/**
 * Unified Admin POS View
 * Renders the exact same Point of Sale register workspace, functions, catalog, modifiers,
 * ticket pane, payment tenders, thermal receipt printing, and floor matrix as the POS Terminal.
 */
export default function PosView(_props?: PosViewProps) {
  return <PosTerminalClient embedded={true} />;
}
