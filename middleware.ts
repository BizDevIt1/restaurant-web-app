import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicRoute(pathname: string): boolean {
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/faq") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/terms-and-conditions") ||
    pathname.startsWith("/track") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return true;
  }
  // Public non-admin API routes
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/admin") && !pathname.startsWith("/api/super-admin")) {
    return true;
  }
  return false;
}

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass public routes & static assets immediately
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Intercept protected route patterns
  const isAdminPath = pathname.startsWith("/admin");
  const isTerminalPath = pathname.startsWith("/terminal");
  const isSuperAdminPath = pathname.startsWith("/super-admin");

  if (!isAdminPath && !isTerminalPath && !isSuperAdminPath) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. Initialize Supabase SSR Client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lcukmzldwsnkkfcogaug.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy";

  let supabaseUser = null;
  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data } = await supabase.auth.getUser();
    supabaseUser = data?.user || null;
  } catch {
    supabaseUser = null;
  }

  // Check Omni Session Cookies
  const hasAdminCookie = request.cookies.get("omni_admin_session")?.value === "1";
  const hasStaffCookie = request.cookies.get("omni_staff_session")?.value === "1";
  const omniRoleCookie = (request.cookies.get("omni_session_role")?.value || "").toLowerCase().trim();

  const isAuthenticated = Boolean(supabaseUser || hasAdminCookie || hasStaffCookie);

  // 3. Unauthenticated Access: Immediately redirect to /login with callback URL
  if (!isAuthenticated) {
    const redirectTarget = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?redirect=${redirectTarget}`, request.url));
  }

  // 4. Resolve Active User Role
  let role = "admin";
  if (supabaseUser) {
    const userEmail = (supabaseUser.email || "").toLowerCase().trim();
    const metaRole = String(supabaseUser.user_metadata?.role || supabaseUser.app_metadata?.role || "").toLowerCase().trim();
    if (
      userEmail === "bizdevit.dm@gmail.com" ||
      metaRole === "super_admin" ||
      metaRole === "superadmin" ||
      omniRoleCookie === "super_admin"
    ) {
      role = "super_admin";
    } else if (hasStaffCookie && omniRoleCookie) {
      role = omniRoleCookie;
    } else {
      role = omniRoleCookie || "admin";
    }
  } else if (hasStaffCookie) {
    role = omniRoleCookie || "cashier";
  } else if (hasAdminCookie) {
    role = omniRoleCookie || "admin";
  }

  // 5. Role-Based Path Verification (RBAC)

  // A. Super Admin Routes (/super-admin/:path*)
  if (isSuperAdminPath) {
    if (role !== "super_admin") {
      if (role === "admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.redirect(new URL(getDesignatedTerminal(role), request.url));
    }
    return response;
  }

  // B. Admin Routes (/admin/:path*)
  // Allow ONLY users with role === 'admin' or role === 'super_admin'.
  // If a terminal role (e.g. waiter) tries to access /admin/*, redirect them to their designated terminal.
  if (isAdminPath) {
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.redirect(new URL(getDesignatedTerminal(role), request.url));
    }
    return response;
  }

  // C. Terminal Routes (/terminal/:path*)
  if (isTerminalPath) {
    // Admin and super_admin have full oversight on all terminals
    if (role === "admin" || role === "super_admin") {
      return response;
    }

    // Role-specific terminal checks
    if (pathname.startsWith("/terminal/pos") || pathname.startsWith("/terminal/z-report")) {
      // Allow ONLY admin, super_admin, or cashier (or manager)
      if (role !== "cashier" && role !== "manager") {
        return NextResponse.redirect(new URL(getDesignatedTerminal(role), request.url));
      }
    } else if (pathname.startsWith("/terminal/waiter")) {
      // Allow ONLY admin, super_admin, or waiter (or server)
      if (role !== "waiter" && role !== "server") {
        return NextResponse.redirect(new URL(getDesignatedTerminal(role), request.url));
      }
    } else if (pathname.startsWith("/terminal/kitchen")) {
      // Allow ONLY admin, super_admin, or kitchen_staff (chef, cook, kitchen, kds)
      const isKitchenRole =
        role === "chef" ||
        role === "cook" ||
        role === "kitchen" ||
        role === "kitchen_staff" ||
        role === "kds";
      if (!isKitchenRole) {
        return NextResponse.redirect(new URL(getDesignatedTerminal(role), request.url));
      }
    } else if (pathname.startsWith("/terminal/rider")) {
      // Allow ONLY admin, super_admin, or rider
      if (role !== "rider") {
        return NextResponse.redirect(new URL(getDesignatedTerminal(role), request.url));
      }
    } else if (pathname === "/terminal" || pathname === "/terminal/") {
      // If hitting base /terminal, automatically direct to their designated terminal
      return NextResponse.redirect(new URL(getDesignatedTerminal(role), request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|css|js)$).*)",
  ],
};
