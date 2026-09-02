import { cookies } from "next/headers";
import SuperAdminClient from "../../dashboard/SuperAdminClient";

export default async function NewSubscriptionPlanPage() {
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("sa_sidebar_collapsed")?.value === "true";

  return (
    <SuperAdminClient
      initialNav="Subscriptions & Plans"
      initialPlanMode="new"
      initialCollapsed={isCollapsed}
    />
  );
}
