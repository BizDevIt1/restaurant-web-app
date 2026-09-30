import { cookies } from "next/headers";
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

  // Server-side entitlement check
  if (user.id || user.email) {
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("enabled_modules")
      .or(`owner_id.eq.${user.id},owner_email.eq.${user.email}`)
      .limit(1)
      .maybeSingle();

    if (restaurant && Array.isArray(restaurant.enabled_modules)) {
      const modules = restaurant.enabled_modules.map((m: any) => String(m).toLowerCase().trim());
      const hasRider = modules.includes("rider_app") || modules.includes("rider") || modules.includes("dispatch");
      if (!hasRider) {
        redirect("/admin?locked=rider");
      }
    }
  }

  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("admin_sidebar_collapsed")?.value === "true";

  return <FleetConsoleClient initialCollapsed={isCollapsed} />;
}
