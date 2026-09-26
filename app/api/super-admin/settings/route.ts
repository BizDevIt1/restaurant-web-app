import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lcukmzldwsnkkfcogaug.supabase.co";
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET() {
  try {
    const supabase = getSupabase();
    // Try to get current super admin profile / user metadata
    const { data: users, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
    if (!error && users?.users) {
      const superAdminUser = users.users.find(
        (u) =>
          u.email === "bizdevit.dm@gmail.com" ||
          u.user_metadata?.role === "super_admin" ||
          u.app_metadata?.role === "super_admin"
      ) || users.users[0];

      if (superAdminUser) {
        const metadata = superAdminUser.user_metadata || {};
        const passwordFromMeta =
          metadata.current_password ||
          metadata.password ||
          metadata.plain_password ||
          metadata.admin_password ||
          "";

        return NextResponse.json({
          name: metadata.full_name || metadata.name || "Super Admin",
          email: superAdminUser.email || "bizdevit.dm@gmail.com",
          avatar_url: metadata.avatar_url || null,
          currency: metadata.currency || "USD",
          currency_symbol: metadata.currency_symbol || "$",
          current_password: passwordFromMeta,
        });
      }
    }
    return NextResponse.json({
      name: "Super Admin",
      email: "bizdevit.dm@gmail.com",
      currency: "USD",
      currency_symbol: "$",
      current_password: "",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to fetch settings";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, avatar_url, currency, currency_symbol, password } = body;
    const supabase = getSupabase();

    // If secret key is available, update user in Supabase Auth admin
    if (process.env.SUPABASE_SECRET_KEY) {
      const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
      if (users?.users) {
        const superAdminUser = users.users.find(
          (u) =>
            (email && u.email === email) ||
            u.email === "bizdevit.dm@gmail.com" ||
            u.user_metadata?.role === "super_admin" ||
            u.app_metadata?.role === "super_admin"
        ) || users.users[0];

        if (superAdminUser) {
          const updatePayload: Record<string, any> = {
            user_metadata: {
              ...superAdminUser.user_metadata,
              ...(name ? { full_name: name, name: name, display_name: name } : {}),
              ...(avatar_url !== undefined ? { avatar_url } : {}),
              ...(currency ? { currency } : {}),
              ...(currency_symbol ? { currency_symbol } : {}),
              ...(password ? {
                current_password: password,
                password: password,
                plain_password: password,
              } : {}),
            },
          };

          if (password) {
            updatePayload.password = password;
          }

          await supabase.auth.admin.updateUserById(superAdminUser.id, updatePayload);
        }
      }
    }

    return NextResponse.json({ success: true, name, email, currency, currency_symbol, current_password: password });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
