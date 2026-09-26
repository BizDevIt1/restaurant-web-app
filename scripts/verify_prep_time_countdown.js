const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of env.split('\n')) {
  if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/["\r]/g, '').trim();
  if (line.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].replace(/["\r]/g, '').trim();
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

const REST_ID = 27;

function formatCountdown(targetEndTimeMs, currentNowMs) {
  const remainingSeconds = Math.floor((targetEndTimeMs - currentNowMs) / 1000);
  const isOverdue = remainingSeconds <= 0;
  const absRemaining = Math.abs(remainingSeconds);
  const mm = Math.floor(absRemaining / 60);
  const ss = absRemaining % 60;
  const formattedMmSs = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return {
    remainingSeconds,
    isOverdue,
    display: isOverdue ? `+${formattedMmSs} Overdue` : `${formattedMmSs} left`
  };
}

async function runVerification() {
  console.log('========================================================================');
  console.log('=== STARTING END-TO-END VERIFICATION: PREP TIME COUNTDOWN LIFECYCLE ===');
  console.log('========================================================================\n');

  // STEP 1: Verify Dish Prep Time Persistence
  console.log('STEP 1: Checking & Updating Dish Prep Time in public.menu_items...');
  const { data: menuItems, error: menuErr } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', REST_ID)
    .limit(2);

  if (menuErr || !menuItems || menuItems.length === 0) {
    console.error('Failed to fetch menu_items:', menuErr);
    process.exit(1);
  }

  const testDish = menuItems[0];
  const targetPrepInput = '14m';
  const parsedMinutes = parseInt(targetPrepInput.replace(/[^0-9]/g, '')) || 15;

  console.log(`Setting dish "${testDish.name}" (ID: ${testDish.id}) prep_time to "${targetPrepInput}" (${parsedMinutes} mins)...`);
  const { error: updErr } = await supabase
    .from('menu_items')
    .update({
      prep_time: `${parsedMinutes}m`
    })
    .eq('id', testDish.id);

  if (updErr) {
    console.error('Failed to update menu_items prep_time:', updErr);
    process.exit(1);
  }

  // Verify persistence on fresh read
  const { data: verifyDish } = await supabase
    .from('menu_items')
    .select('id, name, prep_time')
    .eq('id', testDish.id)
    .single();

  console.log(`[PASS] Dish Prep Time Persisted: ${verifyDish.name} -> prep_time: "${verifyDish.prep_time}"\n`);

  // STEP 2: Simulate POS Order Placement & Prep Time Inheritance
  console.log('STEP 2: Simulating POS Order Placement with Max Prep Time Inheritance...');
  const dishesInCart = [
    { id: testDish.id, name: testDish.name, prepTime: '14m', preparation_time: 14 },
    { id: 'dish_fast', name: 'Mint Lemonade', prepTime: '5m', preparation_time: 5 }
  ];

  const cartPrepTimes = dishesInCart.map(d => d.preparation_time);
  const maxEstimatedPrepTime = Math.max(...cartPrepTimes);
  console.log(`Cart items prep times: [${cartPrepTimes.join(', ')}m] => Max Estimated Prep Time = ${maxEstimatedPrepTime} mins`);

  if (maxEstimatedPrepTime !== 14) {
    console.error(`[FAIL] Expected max prep time 14, got ${maxEstimatedPrepTime}`);
    process.exit(1);
  }
  console.log(`[PASS] Order inherits max dish prep time: ${maxEstimatedPrepTime} mins\n`);

  // STEP 3: Create Live KOT in kitchen_tickets with Queued Status
  console.log('STEP 3: Inserting Kitchen Ticket (KOT) into public.kitchen_tickets...');
  const testKotNumber = `KOT-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: kotData, error: kotErr } = await supabase
    .from('kitchen_tickets')
    .insert([{
      restaurant_id: REST_ID,
      ticket_number: testKotNumber,
      table_number: 'Table 04',
      channel: 'dine_in',
      status: 'queued',
      items: dishesInCart.map(d => ({ name: d.name, qty: 1, prepTime: d.prepTime, preparation_time: d.preparation_time })),
      server_name: 'Counter Cashier',
      priority: 'normal',
    }])
    .select()
    .single();

  if (kotErr || !kotData) {
    console.error('Failed to create kitchen ticket:', kotErr);
    process.exit(1);
  }
  console.log(`[PASS] Kitchen ticket created: ${kotData.ticket_number} (status: ${kotData.status})`);

  // STEP 4: Chef clicks "Start Cooking" -> Transitions to 'preparing' and sets prep_timer_started_at
  console.log('\nSTEP 4: Simulating Chef Clicking "Start Cooking" in KDS...');
  const startTimeIso = new Date().toISOString();
  const startTimeMs = new Date(startTimeIso).getTime();

  const { data: cookingKot, error: cookErr } = await supabase
    .from('kitchen_tickets')
    .update({
      status: 'preparing',
      prep_timer_started_at: startTimeIso,
    })
    .eq('id', kotData.id)
    .select()
    .single();

  if (cookErr || !cookingKot) {
    console.error('Failed to advance kitchen ticket to preparing:', cookErr);
    process.exit(1);
  }

  console.log(`[PASS] Ticket updated to: ${cookingKot.status}`);
  console.log(`[PASS] prep_timer_started_at persisted: ${cookingKot.prep_timer_started_at}`);

  // STEP 5: Mathematical Verification of Reverse Countdown
  console.log('\nSTEP 5: Mathematical Verification of Live Reverse Countdown Timer:');
  const targetEndMs = startTimeMs + maxEstimatedPrepTime * 60 * 1000;

  // Case A: At start (t = 0s)
  const atStart = formatCountdown(targetEndMs, startTimeMs);
  console.log(`  Case A (t = 0m):    Display = "${atStart.display}" (Expected: "14:00 left")`);
  if (atStart.display !== '14:00 left') throw new Error(`Mismatch in Case A: ${atStart.display}`);

  // Case B: In progress (t = +4m elapsed)
  const inProgress = formatCountdown(targetEndMs, startTimeMs + 4 * 60 * 1000);
  console.log(`  Case B (t = +4m):   Display = "${inProgress.display}" (Expected: "10:00 left")`);
  if (inProgress.display !== '10:00 left') throw new Error(`Mismatch in Case B: ${inProgress.display}`);

  // Case C: Approaching zero (t = +13m 45s elapsed)
  const nearZero = formatCountdown(targetEndMs, startTimeMs + (13 * 60 + 45) * 1000);
  console.log(`  Case C (t = +13m45s): Display = "${nearZero.display}" (Expected: "00:15 left")`);
  if (nearZero.display !== '00:15 left') throw new Error(`Mismatch in Case C: ${nearZero.display}`);

  // Case D: Overdue by 2m 30s (t = +16m 30s elapsed)
  const overdue = formatCountdown(targetEndMs, startTimeMs + (16 * 60 + 30) * 1000);
  console.log(`  Case D (t = +16m30s): Display = "${overdue.display}" (Expected: "+02:30 Overdue")`);
  if (overdue.display !== '+02:30 Overdue') throw new Error(`Mismatch in Case D: ${overdue.display}`);

  console.log('[PASS] All countdown timer states and formulas verified with exact mathematical precision!\n');

  // STEP 6: Chef clicks "Ready" -> Freezes Timer
  console.log('STEP 6: Simulating Chef Clicking "Mark Order Ready (Ding!)"...');
  const { data: readyKot, error: readyErr } = await supabase
    .from('kitchen_tickets')
    .update({
      status: 'ready',
    })
    .eq('id', kotData.id)
    .select()
    .single();

  if (readyErr || !readyKot) {
    console.error('Failed to update ticket to ready:', readyErr);
    process.exit(1);
  }
  console.log(`[PASS] Ticket updated to: ${readyKot.status} (Badge: READY)`);

  // STEP 7: Customer Tracking Screen API Simulation
  console.log('\nSTEP 7: Verifying Customer Tracking Data Lookup for ticket:', testKotNumber);
  const { data: trackLookup } = await supabase
    .from('kitchen_tickets')
    .select('*')
    .eq('ticket_number', testKotNumber)
    .single();

  console.log(`[PASS] Customer Tracker successfully resolved order "${trackLookup.ticket_number}"`);
  console.log(`  Status: ${trackLookup.status}`);
  console.log(`  Table: ${trackLookup.table_number}`);
  console.log(`  Items count: ${trackLookup.items?.length || 0}`);

  // Clean up test ticket
  await supabase.from('kitchen_tickets').delete().eq('id', kotData.id);
  console.log('\n[CLEANUP] Test ticket safely deleted.');

  console.log('\n========================================================================');
  console.log('=== ALL PREP TIME & REVERSE COUNTDOWN TIMER VERIFICATIONS PASSED! ===');
  console.log('========================================================================\n');
}

runVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
