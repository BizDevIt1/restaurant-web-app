import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabaseServer";
import AdminDashboardClient from "../AdminDashboardClient";

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

export default async function AdminCatchAllPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || [];

  // Server-side authentication check using Supabase SSR
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const slugPath = slug.length > 0 ? `/admin/${slug.join("/")}` : "/admin";
    redirect(`/login?redirect=${encodeURIComponent(slugPath)}`);
  }

  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("admin_sidebar_collapsed")?.value === "true";

  return <AdminDashboardClient initialCollapsed={isCollapsed} initialSlug={slug} />;
}
