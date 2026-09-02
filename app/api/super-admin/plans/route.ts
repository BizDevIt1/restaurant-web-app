import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with secret key for full DB access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lcukmzldwsnkkfcogaug.supabase.co";
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ plans: data || [] });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to fetch plans";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, price, interval, numeric_limit, features, is_popular } = body;

    if (!name) {
      return NextResponse.json({ error: "Plan name is required" }, { status: 400 });
    }

    // Parse numeric price
    const numericPrice = typeof price === "number"
      ? price
      : parseInt(String(price).replace(/[^0-9]/g, ""), 10) || 0;

    const payload = {
      name: String(name).trim(),
      price: numericPrice,
      interval: String(interval || "Monthly").trim(),
      numeric_limit: String(numeric_limit || "1 Branch").trim(),
      features: Array.isArray(features) ? features.join("\n") : String(features || "").trim(),
      is_popular: Boolean(is_popular),
    };

    const { data, error } = await supabase
      .from("subscription_plans")
      .insert([payload])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, plan: data });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create plan in Supabase";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, price, interval, numeric_limit, features, is_popular } = body;

    const numericId = typeof id === "number" ? id : parseInt(String(id).replace(/[^0-9]/g, ""), 10);

    if (!numericId) {
      return NextResponse.json({ error: "Valid numeric plan ID is required for editing" }, { status: 400 });
    }

    const numericPrice = typeof price === "number"
      ? price
      : parseInt(String(price).replace(/[^0-9]/g, ""), 10) || 0;

    const payload = {
      name: String(name).trim(),
      price: numericPrice,
      interval: String(interval || "Monthly").trim(),
      numeric_limit: String(numeric_limit || "1 Branch").trim(),
      features: Array.isArray(features) ? features.join("\n") : String(features || "").trim(),
      is_popular: Boolean(is_popular),
    };

    const { data, error } = await supabase
      .from("subscription_plans")
      .update(payload)
      .eq("id", numericId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, plan: data });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update plan in Supabase";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");
    let id = idParam ? parseInt(idParam, 10) : null;

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id
        ? typeof body.id === "number"
          ? body.id
          : parseInt(String(body.id).replace(/[^0-9]/g, ""), 10)
        : null;
    }

    if (!id) {
      return NextResponse.json({ error: "Valid numeric plan ID is required for deletion" }, { status: 400 });
    }

    const { error } = await supabase
      .from("subscription_plans")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete plan in Supabase";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
