"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getActiveAuthSession } from "../../../lib/auth";
import { getActiveUserSession } from "../../../lib/tenantStore";
import { createClient } from "../../../lib/supabase";

function getDesignatedTerminal(role: string): string {
  switch (role) {
    case "waiter":
    case "server":
      return "/terminal/waiter";
    case "chef":
    case "kitchen":
    case "kitchen_staff":
    case "cook":
    case "kds":
      return "/terminal/kitchen";
    case "rider":
      return "/terminal/rider";
    case "cashier":
      return "/terminal/pos";
    case "manager":
      return "/terminal/manager";
    default:
      return "/terminal/pos";
  }
}

export default function AdminAuthGuard({
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

    async function checkAdminSecurity() {
      try {
        // 1. Check local session
        const authSession = getActiveAuthSession();
        const userSession = getActiveUserSession();
        const active = authSession || userSession;

        if (active) {
          // If staff member tries to access /admin, redirect them to designated terminal
          if (active.userType === "STAFF") {
            const staffRole = (
              active.staffRole ||
              (active as any).role ||
              "cashier"
            ).toLowerCase().trim();
            router.replace(getDesignatedTerminal(staffRole));
            return;
          }

          if (isMounted) {
            setIsAuthorized(true);
            setIsLoading(false);
          }
          return;
        }

        // 2. Fallback check Supabase Auth session directly
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (user && !error) {
          if (isMounted) {
            setIsAuthorized(true);
            setIsLoading(false);
          }
          return;
        }

        // 3. No valid session: force replace route to /login immediately
        const redirectUrl = `/login?redirect=${encodeURIComponent(pathname || "/admin")}`;
        router.replace(redirectUrl);
      } catch (err) {
        console.warn("[AdminAuthGuard] Session verification error:", err);
        const redirectUrl = `/login?redirect=${encodeURIComponent(pathname || "/admin")}`;
        router.replace(redirectUrl);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkAdminSecurity();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  // Prevent rendering any child component until session and role verification fully resolve as valid
  if (isLoading || !isAuthorized) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--bg-deep,#08090c)] text-[var(--text-hi,#ffffff)] select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--gold-dim,rgba(227,177,59,0.1))] border border-[var(--gold,#e3b13b)]/30 flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(227,177,59,0.2)]">
            <ShieldCheck className="w-6 h-6 text-[var(--gold,#e3b13b)]" />
          </div>
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--text-lo,#9ca3af)]">
            Verifying Admin Access...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
