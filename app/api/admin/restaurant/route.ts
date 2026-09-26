import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lcukmzldwsnkkfcogaug.supabase.co";
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("id");
    const ownerEmail = searchParams.get("email");
    const ownerId = searchParams.get("owner_id");

    let query = supabase.from("restaurants").select("*");

    if (restaurantId) {
      const numericId = parseInt(restaurantId.replace(/[^0-9]/g, ""), 10);
      query = query.eq("id", numericId || restaurantId);
    } else if (ownerId) {
      query = query.eq("owner_id", ownerId);
    } else if (ownerEmail) {
      query = query.eq("owner_email", ownerEmail.trim().toLowerCase());
    } else {
      // Default fallback: get the latest active restaurant
      query = query.order("id", { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.warn("[Fetch Tenant Restaurant Warning]:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({
        restaurant: null,
        message: "No matching restaurant found",
      });
    }

    return NextResponse.json(
      {
        restaurant: {
          id: data.id,
          brand_name: data.brand_name || "Omnibites Restaurant",
          logo_url: data.logo_url || data.brand_logo || null,
          city: data.city || "Lahore",
          cuisine: data.cuisine || "Fine Dining",
          hq_address: data.hq_address || "Main Boulevard",
          branches: data.branches || [],
          contact_person: data.contact_person || "Manager",
          phone: data.phone || "+92 300 0000000",
          owner_email: data.owner_email || "",
          assigned_plan: data.assigned_plan || "Enterprise Plus",
          initial_status: data.initial_status || "Active",
          enabled_modules: data.enabled_modules || [],
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to fetch restaurant details";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
