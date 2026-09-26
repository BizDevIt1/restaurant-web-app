import { cookies } from "next/headers";
import SuperAdminClient from "../dashboard/SuperAdminClient";

export default async function PaymentsPage() {
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("sa_sidebar_collapsed")?.value === "true";

  return (
    <SuperAdminClient
      initialNav="Payments"
      initialCollapsed={isCollapsed}
    />
  );
}
