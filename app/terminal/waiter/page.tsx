import { Metadata } from "next";
import WaiterTerminalClient from "./WaiterTerminalClient";

export const metadata: Metadata = {
  title: "Waiter Floor Station | OmniBites",
  description: "Live order-ready notifications and kitchen pass pickup dispatch for floor staff",
};

export default function WaiterTerminalPage() {
  return <WaiterTerminalClient />;
}
