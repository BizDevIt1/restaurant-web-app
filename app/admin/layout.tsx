import React from "react";
import type { Metadata } from "next";
import AdminAuthGuard from "./components/AdminAuthGuard";

export const metadata: Metadata = {
  title: "Admin Dashboard | Omnibites Restaurant Platform",
  description: "Enterprise multi-terminal restaurant control center",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminAuthGuard>{children}</AdminAuthGuard>;
}
