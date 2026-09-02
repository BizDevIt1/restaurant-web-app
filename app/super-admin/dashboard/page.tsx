import { cookies } from "next/headers";
import SuperAdminClient from "./SuperAdminClient";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("sa_sidebar_collapsed")?.value === "true";

  return <SuperAdminClient initialCollapsed={isCollapsed} />;
}
