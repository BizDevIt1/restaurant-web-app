import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Initialize Supabase client with secret key for full DB & Auth Admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lcukmzldwsnkkfcogaug.supabase.co";
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Resend Client
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Builds a clean, dark-themed responsive HTML email for restaurant onboarding
 */
function buildInviteEmailHtml({
  brandName,
  contactPerson,
  city,
  assignedPlan,
  ownerEmail,
  inviteUrl,
}: {
  brandName: string;
  contactPerson: string;
  city: string;
  assignedPlan: string;
  ownerEmail: string;
  inviteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accept Restaurant Invitation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0806; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f7f0dd;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0806; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="580" style="max-width: 580px; background-color: #140f0c; border: 1px solid rgba(227, 177, 59, 0.25); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
          <!-- Top Gold Accent Line -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #e04e17, #e3b13b, #fcebc0);"></td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <!-- Header Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
                <tr>
                  <td style="background-color: rgba(227, 177, 59, 0.12); border: 1px solid rgba(227, 177, 59, 0.35); border-radius: 20px; padding: 6px 14px; font-size: 11px; font-weight: 700; color: #e3b13b; text-transform: uppercase; letter-spacing: 0.08em; font-family: monospace;">
                    Omnibites Restaurant Network
                  </td>
                </tr>
              </table>

              <!-- Main Title -->
              <h1 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                Welcome, ${contactPerson || brandName}!
              </h1>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #c1b295;">
                Your restaurant franchise instance for <strong style="color: #f7f0dd;">${brandName}</strong> has been successfully configured and deployed on the Omnibites multi-vendor platform.
              </p>

              <!-- Restaurant Summary Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(247, 231, 190, 0.1); border-radius: 14px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="5">
                      <tr>
                        <td style="font-size: 11px; font-family: monospace; color: #8d8067; text-transform: uppercase;">Brand Name</td>
                        <td align="right" style="font-size: 13px; font-weight: 700; color: #f7f0dd;">${brandName}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; font-family: monospace; color: #8d8067; text-transform: uppercase;">City / Region</td>
                        <td align="right" style="font-size: 13px; color: #f7f0dd;">${city}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; font-family: monospace; color: #8d8067; text-transform: uppercase;">Assigned Plan</td>
                        <td align="right" style="font-size: 13px; font-weight: 700; color: #e3b13b;">${assignedPlan}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; font-family: monospace; color: #8d8067; text-transform: uppercase;">Owner Email</td>
                        <td align="right" style="font-size: 12px; font-family: monospace; color: #c1b295;">${ownerEmail}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; box-sizing: border-box; background: linear-gradient(135deg, #e3b13b, #e04e17); color: #140c0c; text-decoration: none; text-align: center; font-size: 14px; font-weight: 800; padding: 15px 24px; border-radius: 12px; letter-spacing: 0.02em; box-shadow: 0 4px 18px rgba(227, 177, 59, 0.4);">
                      Accept Invitation &amp; Set Password →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link Fallback Notice -->
              <p style="margin: 0 0 20px 0; font-size: 11px; line-height: 1.5; color: #8d8067;">
                If the button above does not open, copy and paste this link into your browser:<br>
                <a href="${inviteUrl}" style="color: #e3b13b; word-break: break-all; text-decoration: underline;">${inviteUrl}</a>
              </p>

              <!-- Footer Expiry Notice -->
              <p style="margin: 0; font-size: 11px; color: #8d8067; border-top: 1px solid rgba(247, 231, 190, 0.08); padding-top: 18px;">
                🔒 This security link is valid for 24 hours. If you did not request this account, please disregard this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ restaurants: data || [] });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to fetch restaurants";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      brand_name,
      city,
      cuisine,
      hq_address,
      contact_person,
      phone,
      owner_email,
      owner_password,
      assigned_plan,
      initial_status,
      branches,
      enabled_modules,
    } = body;

    // 1. Mandatory Validations
    const trimmedBrand = String(brand_name || "").trim();
    const trimmedEmail = String(owner_email || "").trim();
    const trimmedContact = String(contact_person || "").trim();
    const trimmedPassword = String(owner_password || "").trim();

    if (!trimmedBrand) {
      return NextResponse.json({ error: "Restaurant brand name is required" }, { status: 400 });
    }

    if (!trimmedEmail) {
      return NextResponse.json({ error: "Owner email is required to create admin account" }, { status: 400 });
    }

    // 2. Create or Update Supabase Auth User with direct password
    let owner_id: string | null = null;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectUrl = `${siteUrl}/auth/update-password`;
    let inviteUrl: string = `${siteUrl}/login`;
    let isExistingUser = false;

    try {
      // Check if user already exists in Supabase Auth
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const existingUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === trimmedEmail.toLowerCase()
      );

      if (existingUser) {
        owner_id = existingUser.id;
        isExistingUser = true;
        console.log(`[Supabase Auth] Found existing user: ${owner_id}`);

        // Update password & metadata for existing user if password was provided
        const updatePayload: {
          password?: string;
          email_confirm?: boolean;
          user_metadata: Record<string, any>;
        } = {
          email_confirm: true,
          user_metadata: {
            full_name: trimmedContact || trimmedBrand,
            brand_name: trimmedBrand,
            role: "restaurant_admin",
          },
        };
        if (trimmedPassword) {
          updatePayload.password = trimmedPassword;
        }
        await supabase.auth.admin.updateUserById(existingUser.id, updatePayload);

        // Generate recovery link if needed for email
        const { data: recoveryData } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email: trimmedEmail,
          options: { redirectTo: redirectUrl },
        });
        if (recoveryData?.properties?.action_link) {
          inviteUrl = recoveryData.properties.action_link;
        }
      } else {
        // Create new user directly with password and email_confirm: true
        const initialPass = trimmedPassword || "AdminPass123!";
        const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
          email: trimmedEmail,
          password: initialPass,
          email_confirm: true,
          user_metadata: {
            full_name: trimmedContact || trimmedBrand,
            brand_name: trimmedBrand,
            role: "restaurant_admin",
          },
        });

        if (createError) {
          console.error("[Supabase CreateUser Error]:", createError);
          // Fallback to generateLink if createUser had a glitch
          const { data: inviteLinkData } = await supabase.auth.admin.generateLink({
            type: "invite",
            email: trimmedEmail,
            options: {
              data: {
                full_name: trimmedContact || trimmedBrand,
                brand_name: trimmedBrand,
                role: "restaurant_admin",
              },
              redirectTo: redirectUrl,
            },
          });
          if (inviteLinkData?.properties?.action_link) {
            owner_id = inviteLinkData.user?.id || null;
            inviteUrl = inviteLinkData.properties.action_link;
          }
        } else if (newUserData?.user?.id) {
          owner_id = newUserData.user.id;
          console.log(`[Supabase Auth] New restaurant admin created with direct password! User ID: ${owner_id}`);
        }
      }
    } catch (authErr: unknown) {
      console.error("[Supabase Auth Link Exception]:", authErr);
    }

    // 3. Send Transactional Email via Resend SDK
    let emailSent = false;
    let resendMessageId: string | null = null;
    let emailError: string | null = null;

    if (resend) {
      try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || "Omnibites <onboarding@resend.dev>";
        const emailHtml = buildInviteEmailHtml({
          brandName: trimmedBrand,
          contactPerson: trimmedContact,
          city: String(city || "Lahore").trim(),
          assignedPlan: String(assigned_plan || "Enterprise Plus").trim(),
          ownerEmail: trimmedEmail,
          inviteUrl: inviteUrl,
        });

        const resendRes = await resend.emails.send({
          from: fromEmail,
          to: trimmedEmail,
          subject: `Action Required: Set up your restaurant portal for ${trimmedBrand}`,
          html: emailHtml,
        });

        if (resendRes.error) {
          console.error("[Resend Error]:", resendRes.error);
          emailError = resendRes.error.message;
        } else {
          emailSent = true;
          resendMessageId = resendRes.data?.id || null;
          console.log(`[Resend Success]: Email sent to ${trimmedEmail} (ID: ${resendMessageId})`);
        }
      } catch (rErr: unknown) {
        const rMsg = rErr instanceof Error ? rErr.message : "Failed to dispatch email via Resend";
        console.error("[Resend Exception]:", rMsg);
        emailError = rMsg;
      }
    } else {
      console.warn("[Resend Notice]: RESEND_API_KEY is not configured in environment. Skipping email dispatch.");
    }

    // 4. Database Insertion with JSONB arrays and owner_id
    const branchesArray = Array.isArray(branches)
      ? branches
      : branches
      ? [branches]
      : [];

    const modulesArray = Array.isArray(enabled_modules)
      ? enabled_modules
      : enabled_modules
      ? [enabled_modules]
      : [];

    const payload = {
      brand_name: trimmedBrand,
      city: String(city || "Lahore").trim(),
      cuisine: String(cuisine || "Fine Dining").trim(),
      hq_address: String(hq_address || "").trim(),
      contact_person: trimmedContact,
      phone: String(phone || "+92 300 0000000").trim(),
      owner_email: trimmedEmail,
      assigned_plan: String(assigned_plan || "Enterprise Plus").trim(),
      initial_status: String(initial_status || "Active").trim(),
      branches: branchesArray,
      enabled_modules: modulesArray,
      owner_id: owner_id,
    };

    const { data, error: dbError } = await supabase
      .from("restaurants")
      .insert([payload])
      .select()
      .single();

    if (dbError) {
      console.error("[Supabase DB Error]:", dbError);
      return NextResponse.json({ error: `Database insertion failed: ${dbError.message}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      restaurant: data,
      owner_id,
      isExistingUser,
      emailSent,
      emailError,
      inviteLink: inviteUrl,
      message: emailSent
        ? `Restaurant registered and invitation email sent to ${trimmedEmail} via Resend.`
        : `Restaurant registered successfully.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create restaurant in Supabase";
    console.error("[Restaurant POST Error]:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, initial_status, brand_name, city, cuisine, assigned_plan, phone } = body;

    const numericId = typeof id === "number" ? id : parseInt(String(id).replace(/[^0-9]/g, ""), 10);

    if (!numericId) {
      return NextResponse.json({ error: "Valid numeric restaurant ID is required" }, { status: 400 });
    }

    const payload: Record<string, any> = {};
    if (initial_status !== undefined) payload.initial_status = initial_status;
    if (brand_name !== undefined) payload.brand_name = brand_name;
    if (city !== undefined) payload.city = city;
    if (cuisine !== undefined) payload.cuisine = cuisine;
    if (assigned_plan !== undefined) payload.assigned_plan = assigned_plan;
    if (phone !== undefined) payload.phone = phone;

    const { data, error } = await supabase
      .from("restaurants")
      .update(payload)
      .eq("id", numericId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, restaurant: data });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update restaurant in Supabase";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Restaurant ID is required" }, { status: 400 });
    }

    const numericId = parseInt(String(id).replace(/[^0-9]/g, ""), 10);

    const { error } = await supabase
      .from("restaurants")
      .delete()
      .eq("id", numericId || id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete restaurant in Supabase";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
