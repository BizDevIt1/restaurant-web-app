import { Metadata } from "next";
import UnifiedOrdersPage from "./UnifiedOrdersPage";

export const metadata: Metadata = {
  title: "Order Management Hub | Staff POS Terminal",
  description: "Consolidated live orders, active KOT tickets, held checks, and direct settlement pipeline",
};

export default function Page() {
  return <UnifiedOrdersPage />;
}
