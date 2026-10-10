import { Metadata } from "next";
import StaffProfileClient from "./StaffProfileClient";

export const metadata: Metadata = {
  title: "Staff Profile & Operational Identity | Omnibites POS",
  description: "Dedicated operational staff profile, shift schedule, opening float details, and terminal privileges",
};

export default function StaffProfilePage() {
  return <StaffProfileClient />;
}
