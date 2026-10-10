import { Metadata } from "next";
import ZReportClient from "./ZReportClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shift Z-Report | Staff POS Terminal",
  description: "Live shift closing financial register reconciliation and thermal Z-report",
};

export default function ZReportPage() {
  return <ZReportClient />;
}
