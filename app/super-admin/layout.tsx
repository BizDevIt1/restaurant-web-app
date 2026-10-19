"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getActiveAuthSession } from "../../lib/auth";
import { getActiveUserSession } from "../../lib/tenantStore";
import { createClient } from "../../lib/supabase";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkSuperAdminSecurity() {
      try {
        const local = getActiveAuthSession() || getActiveUserSession();
        const localRole = (local?.role || "").toLowerCase().trim();

        if (local && (localRole === "super_admin" || localRole === "superadmin")) {
          if (isMounted) {
            setIsAuthorized(true);
            setIsLoading(false);
          }
          return;
        }

        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (user && !error) {
          const userEmail = (user.email || "").toLowerCase().trim();
          const metaRole = String(user.user_metadata?.role || user.app_metadata?.role || "").toLowerCase().trim();
          if (
            userEmail === "bizdevit.dm@gmail.com" ||
            metaRole === "super_admin" ||
            metaRole === "superadmin"
          ) {
            if (isMounted) {
              setIsAuthorized(true);
              setIsLoading(false);
            }
            return;
          }
        }

        // Access denied for super admin
        const redirectUrl = `/login?redirect=${encodeURIComponent(pathname || "/super-admin/dashboard")}`;
        router.replace(redirectUrl);
      } catch (err) {
        console.warn("[SuperAdminLayout] Session verification error:", err);
        router.replace("/login");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkSuperAdminSecurity();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  if (isLoading || !isAuthorized) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#08090c] text-white select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(245,166,35,0.2)]">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
          </div>
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-zinc-400">
            Verifying Master Platform Clearance...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
