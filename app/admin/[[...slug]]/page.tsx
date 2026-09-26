import { cookies } from "next/headers";
import AdminDashboardClient from "../AdminDashboardClient";

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export default async function AdminCatchAllPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || [];

  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("admin_sidebar_collapsed")?.value === "true";

  return <AdminDashboardClient initialCollapsed={isCollapsed} initialSlug={slug} />;
}
