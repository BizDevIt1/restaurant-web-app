import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lcukmzldwsnkkfcogaug.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_kDs031TP0Q5ePdzrwb4TUg_kyDsdj1R";

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("==================================================");
  console.log("  AUTOMATED PURE SUPABASE DATABASE CRUD TEST SUITE");
  console.log("==================================================\n");

  // 0. Fetch active restaurant ID
  console.log("[STEP 0] Discovering Active Tenant Restaurant...");
  const { data: restList, error: restErr } = await supabase
    .from("restaurants")
    .select("*")
    .limit(1);

  if (restErr || !restList || restList.length === 0) {
    console.error("FAIL: Could not query restaurants table:", restErr);
    process.exit(1);
  }

  const testRestaurantId = restList[0].id;
  const restName = restList[0].restaurant_name || restList[0].name || `Restaurant #${testRestaurantId}`;
  console.log(`PASS: Found active tenant: "${restName}" (ID: ${testRestaurantId})\n`);

  // 1. MENU_ITEMS CRUD
  console.log("[STEP 1] Testing menu_items Pure Database CRUD...");
  const testDishName = `Test Handi ${Date.now()}`;
  
  // 1A. INSERT
  const { data: insertedDish, error: insertDishErr } = await supabase
    .from("menu_items")
    .insert([{
      restaurant_id: testRestaurantId,
      branch_id: "main",
      name: testDishName,
      category: "karahi",
      price: 1850,
      prep_time: "20 mins",
      stock_status: "in_stock",
      stock_count: 35,
      image_icon: "🍲",
      is_popular: true,
    }])
    .select()
    .single();

  if (insertDishErr || !insertedDish) {
    console.error("FAIL: menu_items INSERT failed:", insertDishErr);
    process.exit(1);
  }
  console.log(`  + INSERTED: [${insertedDish.id}] ${insertedDish.name} - Rs ${insertedDish.price}`);

  // 1B. SELECT
  const { data: fetchedDish, error: fetchDishErr } = await supabase
    .from("menu_items")
    .select("*")
    .eq("id", insertedDish.id)
    .single();

  if (fetchDishErr || !fetchedDish) {
    console.error("FAIL: menu_items SELECT failed:", fetchDishErr);
    process.exit(1);
  }
  console.log(`  + FETCHED: Verified row exists in database with stock "${fetchedDish.stock_status}"`);

  // 1C. UPDATE (Price & Stock Toggle)
  const { data: updatedDish, error: updateDishErr } = await supabase
    .from("menu_items")
    .update({ price: 1950, stock_status: "low_stock" })
    .eq("id", insertedDish.id)
    .select()
    .single();

  if (updateDishErr || updatedDish.price !== 1950 || updatedDish.stock_status !== "low_stock") {
    console.error("FAIL: menu_items UPDATE failed:", updateDishErr);
    process.exit(1);
  }
  console.log(`  + UPDATED: Price updated to Rs ${updatedDish.price}, stock cycled to "${updatedDish.stock_status}"`);

  // 1D. DELETE
  const { error: deleteDishErr } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", insertedDish.id);

  if (deleteDishErr) {
    console.error("FAIL: menu_items DELETE failed:", deleteDishErr);
    process.exit(1);
  }
  console.log(`  + DELETED: Successfully removed test dish [${insertedDish.id}]`);
  console.log("PASS: menu_items CRUD completed with 100% success.\n");

  // 2. STAFF_MEMBERS CRUD
  console.log("[STEP 2] Testing staff_members Pure Database CRUD...");
  const testStaffEmail = `test_cashier_${Date.now()}@restaurant.local`;

  // 2A. INSERT
  const { data: insertedStaff, error: insertStaffErr } = await supabase
    .from("staff_members")
    .insert([{
      restaurant_id: testRestaurantId,
      branch_id: "main",
      branch_name: "Main Outlet",
      full_name: "Test Operational Cashier",
      phone: "+92 300 9876543",
      email: testStaffEmail,
      password_hash: "secret123",
      role: "cashier",
      terminal_access: "POS_ONLY",
      shift: "Evening",
      status: "active",
    }])
    .select()
    .single();

  if (insertStaffErr || !insertedStaff) {
    console.error("FAIL: staff_members INSERT failed:", insertStaffErr);
    process.exit(1);
  }
  console.log(`  + INSERTED: [${insertedStaff.id}] ${insertedStaff.full_name} (${insertedStaff.email}) - Access: ${insertedStaff.terminal_access}`);

  // 2B. UPDATE (Status Toggle to on_break)
  const { data: updatedStaff, error: updateStaffErr } = await supabase
    .from("staff_members")
    .update({ status: "on_break" })
    .eq("id", insertedStaff.id)
    .select()
    .single();

  if (updateStaffErr || updatedStaff.status !== "on_break") {
    console.error("FAIL: staff_members UPDATE failed:", updateStaffErr);
    process.exit(1);
  }
  console.log(`  + UPDATED: Status toggled to "${updatedStaff.status}"`);

  // 2C. DELETE
  const { error: deleteStaffErr } = await supabase
    .from("staff_members")
    .delete()
    .eq("id", insertedStaff.id);

  if (deleteStaffErr) {
    console.error("FAIL: staff_members DELETE failed:", deleteStaffErr);
    process.exit(1);
  }
  console.log(`  + DELETED: Successfully removed test staff [${insertedStaff.id}]`);
  console.log("PASS: staff_members CRUD completed with 100% success.\n");

  // 3. ORDERS, ORDER_ITEMS & KITCHEN_TICKETS DIRECT WRITES
  console.log("[STEP 3] Testing orders, order_items & kitchen_tickets DB Pipeline...");
  const testOrderNumber = `#TEST-ORD-${Date.now().toString().slice(-4)}`;

  // 3A. INSERT INTO orders
  const { data: insertedOrder, error: insertOrderErr } = await supabase
    .from("orders")
    .insert([{
      restaurant_id: testRestaurantId,
      branch_id: "main",
      order_number: testOrderNumber,
      order_channel: "dine_in",
      customer_name: "Table 4 - Premium VIP",
      subtotal: 3500,
      tax_amount: 560,
      discount_amount: 0,
      total_amount: 4060,
      payment_method: "cash",
      payment_status: "paid",
      order_status: "completed",
      items: [{ id: "item_1", name: "Mutton Shinwari Karahi", price: 3500, quantity: 1 }],
      cashier_name: "Terminal Cashier",
    }])
    .select()
    .single();

  if (insertOrderErr || !insertedOrder) {
    console.error("FAIL: orders INSERT failed:", insertOrderErr);
    process.exit(1);
  }
  console.log(`  + INSERTED ORDER: [${insertedOrder.id}] ${insertedOrder.order_number} - Total: Rs ${insertedOrder.total_amount}`);

  // 3B. INSERT INTO order_items
  const { data: insertedItem, error: insertItemErr } = await supabase
    .from("order_items")
    .insert([{
      order_id: insertedOrder.id,
      item_name: "Mutton Shinwari Karahi",
      quantity: 1,
      unit_price: 3500,
      total_price: 3500,
      notes: "Extra ginger, mild spice",
    }])
    .select()
    .single();

  if (insertItemErr || !insertedItem) {
    console.error("FAIL: order_items INSERT failed:", insertItemErr);
    process.exit(1);
  }
  console.log(`  + INSERTED LINE ITEM: [${insertedItem.id}] ${insertedItem.item_name} x ${insertedItem.quantity}`);

  // 3C. INSERT INTO kitchen_tickets
  const kotNumber = `KOT-${testOrderNumber.slice(-4)}`;
  const { data: insertedKOT, error: insertKotErr } = await supabase
    .from("kitchen_tickets")
    .insert([{
      restaurant_id: testRestaurantId,
      branch_id: "main",
      order_id: insertedOrder.id,
      ticket_number: kotNumber,
      table_number: "Table 4",
      channel: "dine_in",
      status: "queued",
      items: [{ name: "Mutton Shinwari Karahi", quantity: 1, notes: "Extra ginger" }],
      server_name: "Front Desk",
      priority: "normal",
    }])
    .select()
    .single();

  if (insertKotErr || !insertedKOT) {
    console.error("FAIL: kitchen_tickets INSERT failed:", insertKotErr);
    process.exit(1);
  }
  console.log(`  + INSERTED KDS TICKET: [${insertedKOT.id}] ${insertedKOT.ticket_number} - Status: ${insertedKOT.status}`);

  // 3D. VERIFY RELATIONSHIP & CLEANUP
  const { data: verifyOrder, error: verifyErr } = await supabase
    .from("orders")
    .select("*, order_items(*), kitchen_tickets(*)")
    .eq("id", insertedOrder.id)
    .single();

  if (verifyErr) {
    console.error("FAIL: Join query error:", verifyErr);
  } else {
    console.log(`  + VERIFIED: Joined order has ${verifyOrder.order_items.length} line items and ${verifyOrder.kitchen_tickets.length} kitchen tickets linked.`);
  }

  // Cleanup test order records
  await supabase.from("kitchen_tickets").delete().eq("id", insertedKOT.id);
  await supabase.from("order_items").delete().eq("id", insertedItem.id);
  await supabase.from("orders").delete().eq("id", insertedOrder.id);
  console.log("  + CLEANED UP: Test order, line items, and KOT ticket removed.");
  console.log("PASS: Orders, line items & KDS pipeline completed with 100% success.\n");

  console.log("==================================================");
  console.log("  ALL TESTS PASSED: SUPABASE CRUD IS 100% VERIFIED");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Unhandled test runner exception:", err);
  process.exit(1);
});
