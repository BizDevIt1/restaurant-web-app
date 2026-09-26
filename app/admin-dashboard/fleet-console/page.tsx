import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import FleetConsoleClient from "@/app/admin/fleet-console/FleetConsoleClient";

export const metadata = {
  title: "Fleet Console & Rider Dispatch | Admin Dashboard",
  description: "Dedicated fleet management and live rider dispatch console",
};

export default async function AdminDashboardFleetConsolePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin-dashboard/fleet-console");
  }

  return <FleetConsoleClient />;
}
