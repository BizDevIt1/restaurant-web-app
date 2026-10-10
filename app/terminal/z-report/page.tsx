import { Metadata } from "next";
import ZReportClient from "../pos/z-report/ZReportClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shift Z-Report | Staff Terminal",
  description: "Live shift closing financial register reconciliation and thermal Z-report",
};

export default function TerminalZReportPage() {
  return <ZReportClient />;
}
