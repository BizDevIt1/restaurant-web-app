import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lcukmzldwsnkkfcogaug.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_kDs031TP0Q5ePdzrwb4TUg_kyDsdj1R";

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanStaff() {
  console.log("Fetching all staff members in Supabase...");
  const { data, error } = await supabase.from("staff_members").select("*");

  if (error) {
    console.error("Error fetching staff:", error);
    process.exit(1);
  }

  console.log(`Found ${data.length} staff records.`);
  console.log(JSON.stringify(data, null, 2));

  // Remove test/dummy records (e.g. emails containing test, dummy, or user requested clean)
  // Check if any test staff exist
  const testStaff = data.filter(s => 
    s.email?.includes("test") || 
    s.email?.includes("dummy") || 
    s.full_name?.toLowerCase().includes("test")
  );

  console.log(`Found ${testStaff.length} test staff records to clean.`);
  for (const s of testStaff) {
    const { error: delErr } = await supabase.from("staff_members").delete().eq("id", s.id);
    if (delErr) {
      console.error(`Error deleting ${s.id}:`, delErr);
    } else {
      console.log(`Deleted test staff: [${s.id}] ${s.full_name} (${s.email})`);
    }
  }

  const { data: remaining } = await supabase.from("staff_members").select("*");
  console.log(`Remaining staff members in DB: ${remaining ? remaining.length : 0}`);
}

cleanStaff();
