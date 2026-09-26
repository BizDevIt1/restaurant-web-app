import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabaseServer";
import FleetConsoleClient from "./FleetConsoleClient";

export const metadata = {
  title: "Fleet Console & Rider Dispatch | Admin Dashboard",
  description: "Dedicated fleet management and live rider dispatch console",
};

export default async function FleetConsolePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin/fleet-console");
  }

  return <FleetConsoleClient />;
}
