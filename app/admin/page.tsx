import { cookies } from "next/headers";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("admin_sidebar_collapsed")?.value === "true";

  return <AdminDashboardClient initialCollapsed={isCollapsed} />;
}
