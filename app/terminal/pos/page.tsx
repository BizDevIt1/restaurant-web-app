import { Metadata } from "next";
import PosTerminalClient from "./PosTerminalClient";

export const metadata: Metadata = {
  title: "POS Terminal | Staff Counter",
  description: "Point of Sale order dispatch and billing counter terminal",
};

export default function PosTerminalPage() {
  return <PosTerminalClient />;
}
