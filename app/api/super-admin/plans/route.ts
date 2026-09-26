import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Initialize Supabase client with secret key for full DB access
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

export const DEFAULT_PLATFORM_PLANS = [
  {
    id: 1,
    name: "Starter POS",
    price: 29,
    interval: "Monthly",
    pricing_model: "flat",
    numeric_limit: "[flat] Essential cloud POS for single-location eateries",
    features: "Omnibites Cloud POS Suite\nHigh-Speed Billing Terminal\nThermal Receipt Printing\nDaily End-of-Day Sales Report\nStandard Email Support",
    is_popular: false,
  },
  {
    id: 2,
    name: "Growth Pro",
    price: 49,
    interval: "Annual (Save 17%)",
    pricing_model: "flat",
    numeric_limit: "[flat] Full multi-station system for busy restaurants & cafes",
    features: "Omnibites Cloud POS Suite\nMulti-Station KDS Routing\nUnlimited Staff Logins\nInventory & Recipe Costing\nCustomer Loyalty & CRM\n24/7 Priority WhatsApp Support",
    is_popular: true,
  },
  {
    id: 3,
    name: "Enterprise Multi-Branch",
    price: 29,
    interval: "Monthly",
    pricing_model: "per_branch",
    numeric_limit: "[per_branch] Dynamic branch-scaled pricing for growing chains & cloud kitchens",
    features: "Per-Branch Scaled SaaS License\nMulti-Location Central Dashboard\nCentralized Menu & Inventory Sync\nDelivery & Rider Dispatch\nCustom Floor Plan Layouts\nDedicated Account Manager",
    is_popular: false,
  },
];

// Persistent module-level in-memory cache to guarantee plans are always available
let inMemoryPlans: Array<Record<string, any>> = [...DEFAULT_PLATFORM_PLANS];

function parseModelAndTagline(pricing_model?: string, tagline?: string, numeric_limit?: string, description?: string) {
  const rawModel = String(pricing_model || "").trim().toLowerCase();
  const numLimit = String(numeric_limit || "").trim();
  let model: "flat" | "per_branch" = "flat";

  if (rawModel === "per_branch" || rawModel === "per-branch") {
    model = "per_branch";
  } else if (
    numLimit.startsWith("[per_branch]") ||
    numLimit.startsWith("[per-branch]") ||
    numLimit.startsWith("[branch]") ||
    numLimit.toLowerCase().includes("pricing_model:per_branch") ||
    numLimit.toLowerCase().includes("per-branch") ||
    numLimit.toLowerCase().includes("per branch") ||
    (numLimit.toLowerCase().includes("branch") && !numLimit.toLowerCase().includes("single"))
  ) {
    model = "per_branch";
  }

  const rawText = String(tagline || description || numLimit || "").trim();
  const cleanTagline = rawText.replace(/^\[(per_branch|per-branch|branch|flat)\]\s*/i, "").trim();
  const defaultText = model === "per_branch" ? "Per-Branch Scaled Pricing" : "Flat Rate Platform Plan";
  const finalTagline = cleanTagline || defaultText;
  const encodedLimit = `[${model}] ${finalTagline}`;

  return { model, finalTagline, encodedLimit };
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("id", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      inMemoryPlans = data;
      return NextResponse.json({ plans: data });
    }

    // Return in-memory plans if Supabase table is empty or errored
    return NextResponse.json({ plans: inMemoryPlans });
  } catch (err: unknown) {
    console.warn("GET plans fallback to in-memory:", err);
    return NextResponse.json({ plans: inMemoryPlans });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      price,
      unit_price,
      pricing_model,
      tagline,
      description,
      interval,
      numeric_limit,
      features,
      is_popular,
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Plan name is required" }, { status: 400 });
    }

    const rawPrice = unit_price !== undefined && unit_price !== null && unit_price !== ""
      ? unit_price
      : price;
    const numericPrice = typeof rawPrice === "number"
      ? rawPrice
      : parseInt(String(rawPrice || 0).replace(/[^0-9]/g, ""), 10) || 0;

    const { encodedLimit } = parseModelAndTagline(pricing_model, tagline, numeric_limit, description);

    const payload: Record<string, unknown> = {
      name: String(name).trim(),
      price: numericPrice,
      interval: String(interval || "Monthly").trim(),
      numeric_limit: encodedLimit,
      features: Array.isArray(features) ? features.join("\n") : String(features || "").trim(),
      is_popular: Boolean(is_popular),
    };

    let insertedPlan: any = null;

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("subscription_plans")
        .insert([payload])
        .select();

      if (!error && data && data.length > 0) {
        insertedPlan = data[0];
      }
    } catch (dbErr) {
      console.warn("Supabase POST insert warning:", dbErr);
    }

    if (!insertedPlan) {
      // Fallback local memory object
      insertedPlan = {
        id: Date.now(),
        ...payload,
        created_at: new Date().toISOString(),
      };
    }

    inMemoryPlans = [...inMemoryPlans, insertedPlan];
    return NextResponse.json({ success: true, plan: insertedPlan });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create plan";
    console.error("POST plan exception:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      price,
      unit_price,
      pricing_model,
      tagline,
      description,
      interval,
      numeric_limit,
      features,
      is_popular,
    } = body;

    const numericId = typeof id === "number" ? id : parseInt(String(id).replace(/[^0-9]/g, ""), 10);

    if (!numericId) {
      return NextResponse.json({ error: "Valid numeric plan ID is required for editing" }, { status: 400 });
    }

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Plan name is required" }, { status: 400 });
    }

    const rawPrice = unit_price !== undefined && unit_price !== null && unit_price !== ""
      ? unit_price
      : price;
    const numericPrice = typeof rawPrice === "number"
      ? rawPrice
      : parseInt(String(rawPrice || 0).replace(/[^0-9]/g, ""), 10) || 0;

    const { encodedLimit } = parseModelAndTagline(pricing_model, tagline, numeric_limit, description);

    const payload: Record<string, unknown> = {
      name: String(name).trim(),
      price: numericPrice,
      interval: String(interval || "Monthly").trim(),
      numeric_limit: encodedLimit,
      features: Array.isArray(features) ? features.join("\n") : String(features || "").trim(),
      is_popular: Boolean(is_popular),
    };

    let updatedPlan: any = null;

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("subscription_plans")
        .update(payload)
        .eq("id", numericId)
        .select();

      if (!error && data && data.length > 0) {
        updatedPlan = data[0];
      }
    } catch (dbErr) {
      console.warn("Supabase PUT update warning:", dbErr);
    }

    if (!updatedPlan) {
      updatedPlan = {
        id: numericId,
        ...payload,
        updated_at: new Date().toISOString(),
      };
    }

    inMemoryPlans = inMemoryPlans.map((p) => (p.id === numericId ? updatedPlan : p));
    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update plan";
    console.error("PUT plan exception:", err);
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

    try {
      const supabase = getSupabase();
      await supabase
        .from("subscription_plans")
        .delete()
        .eq("id", id);
    } catch (dbErr) {
      console.warn("Supabase DELETE warning:", dbErr);
    }

    inMemoryPlans = inMemoryPlans.filter((p) => p.id !== id);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete plan";
    console.error("DELETE plan exception:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
