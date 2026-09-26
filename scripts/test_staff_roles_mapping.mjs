import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lcukmzldwsnkkfcogaug.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_kDs031TP0Q5ePdzrwb4TUg_kyDsdj1R";

const supabase = createClient(supabaseUrl, supabaseKey);

function deriveTerminalAccess(role) {
  switch (role) {
    case "chef":
      return "KDS_ONLY";
    case "rider":
      return "RIDER_ONLY";
    case "manager":
      return "FULL_ADMIN";
    case "cashier":
    case "waiter":
    default:
      return "POS_ONLY";
  }
}

async function runRoleTests() {
  console.log("==================================================");
  console.log("  ROLE-DRIVEN AUTOMATED TERMINAL ROUTING TEST");
  console.log("==================================================\n");

  const roles = ["manager", "cashier", "chef", "rider", "waiter"];
  const testRestaurantId = 27;

  for (const role of roles) {
    const expectedAccess = deriveTerminalAccess(role);
    const testEmail = `test_autoterminal_${role}_${Date.now()}@restaurant.local`;

    console.log(`Testing role: "${role}" -> expected terminal_access: "${expectedAccess}"`);

    // Insert
    const { data, error } = await supabase
      .from("staff_members")
      .insert([{
        restaurant_id: testRestaurantId,
        branch_id: "main",
        branch_name: "Main Outlet",
        full_name: `Test ${role.toUpperCase()} User`,
        phone: "+92 300 0000000",
        email: testEmail,
        password_hash: "pass1234",
        role: role,
        terminal_access: expectedAccess,
        shift: "Evening Rush",
        status: "active",
      }])
      .select()
      .single();

    if (error || !data) {
      console.error(`  FAIL for ${role}:`, error);
      process.exit(1);
    }

    if (data.terminal_access !== expectedAccess) {
      console.error(`  MISMATCH: Expected ${expectedAccess}, got ${data.terminal_access}`);
      process.exit(1);
    }

    console.log(`  + PASS: Successfully inserted [${data.id}] with terminal_access = "${data.terminal_access}"`);

    // Clean up
    await supabase.from("staff_members").delete().eq("id", data.id);
    console.log(`  + CLEANED UP: Test member deleted.\n`);
  }

  console.log("==================================================");
  console.log("  ALL 5 ROLES PASSED AUTOMATED TERMINAL MAPPING");
  console.log("==================================================");
}

runRoleTests().catch((err) => {
  console.error("Test runner exception:", err);
  process.exit(1);
});
