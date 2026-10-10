import { Metadata } from "next";
import RiderTerminalClient from "./RiderTerminalClient";

export const metadata: Metadata = {
  title: "Rider Dispatch Terminal | OmniBites",
  description: "Live delivery dispatch and courier tracking portal for drop-off status updates and COD collection",
};

export default function RiderTerminalPage() {
  return <RiderTerminalClient />;
}
