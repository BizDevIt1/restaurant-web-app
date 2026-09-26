import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lcukmzldwsnkkfcogaug.supabase.co";
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  try {
    return createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.error("Failed to initialize Supabase client in branches route:", err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const {
      branchName,
      branchCode,
      city,
      address,
      phone,
      managerName,
      managerEmail,
      managerPassword,
      assignedFeatures,
      organizationId,
    } = body;

    const trimmedBranchName = String(branchName || "").trim();
    const trimmedEmail = String(managerEmail || "").trim();
    const trimmedPassword = String(managerPassword || "").trim();

    if (!trimmedBranchName) {
      return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
    }

    if (!trimmedEmail) {
      return NextResponse.json({ error: "Branch manager email is required" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    let authUserCreated = false;
    let authUserId: string | null = null;
    let dbUpdated = false;

    if (supabase) {
      // 1. Provision or update user credentials in Supabase Auth
      try {
        const { data: usersData } = await supabase.auth.admin.listUsers();
        const existing = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === trimmedEmail.toLowerCase()
        );

        const meta = {
          full_name: managerName || trimmedBranchName,
          branch_name: trimmedBranchName,
          role: "branch_admin",
          organization_id: String(organizationId || ""),
        };

        if (existing) {
          authUserId = existing.id;
          const updatePayload: any = {
            email_confirm: true,
            user_metadata: meta,
          };
          if (trimmedPassword) {
            updatePayload.password = trimmedPassword;
          }
          await supabase.auth.admin.updateUserById(existing.id, updatePayload);
          authUserCreated = true;
        } else {
          const { data: newUserData, error: createErr } = await supabase.auth.admin.createUser({
            email: trimmedEmail,
            password: trimmedPassword || "Password123!",
            email_confirm: true,
            user_metadata: meta,
          });
          if (!createErr && newUserData?.user) {
            authUserId = newUserData.user.id;
            authUserCreated = true;
          }
        }
      } catch (authErr) {
        console.warn("[Provision Branch Manager Auth Error]:", authErr);
      }

      // 2. Append branch to Supabase restaurants table if organizationId is provided
      if (organizationId) {
        try {
          const numId = parseInt(String(organizationId).replace(/[^0-9]/g, ""), 10);
          if (numId) {
            const { data: restRow } = await supabase
              .from("restaurants")
              .select("branches")
              .eq("id", numId)
              .maybeSingle();

            const existingBranches = Array.isArray(restRow?.branches)
              ? restRow.branches
              : [];

            const newBranchItem = {
              name: trimmedBranchName,
              code: branchCode || "",
              city: city || "",
              address: address || "",
              phone: phone || "",
              managerName: managerName || "Branch Manager",
              managerEmail: trimmedEmail,
              type: "franchise",
              assignedFeatures: assignedFeatures || [],
            };

            const updatedBranches = [...existingBranches, newBranchItem];

            const { error: updateErr } = await supabase
              .from("restaurants")
              .update({ branches: updatedBranches })
              .eq("id", numId);

            if (!updateErr) {
              dbUpdated = true;
            }
          }
        } catch (dbErr) {
          console.warn("[Update Restaurant Branches DB Error]:", dbErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      branch: {
        name: trimmedBranchName,
        code: branchCode,
        city,
        address,
        phone,
        managerName,
        managerEmail: trimmedEmail,
        assignedFeatures: assignedFeatures || [],
      },
      authUserCreated,
      authUserId,
      dbUpdated,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to provision branch";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
