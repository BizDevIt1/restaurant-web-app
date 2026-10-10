import { Metadata } from "next";
import ManagerTerminalClient from "./ManagerTerminalClient";

export const metadata: Metadata = {
  title: "Manager Terminal | OmniBites",
  description: "Shift oversight, manager overrides, void approvals, daily audits, and inventory procurement alerts",
};

export default function ManagerTerminalPage() {
  return <ManagerTerminalClient />;
}
