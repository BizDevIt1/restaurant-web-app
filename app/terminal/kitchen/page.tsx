import { Metadata } from "next";
import KitchenTerminalClient from "./KitchenTerminalClient";

export const metadata: Metadata = {
  title: "Kitchen KDS Terminal | OmniBites",
  description: "Live kitchen display system for chef ticket sequencing, reverse cook timers, and order preparation",
};

export default function KitchenTerminalPage() {
  return <KitchenTerminalClient />;
}
