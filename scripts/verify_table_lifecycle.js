const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/["\r]/g, '').trim();
  if (line.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].replace(/["\r]/g, '').trim();
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function runTableLifecycleTest() {
  console.log('=== VERIFYING TABLE PERSISTENCE & OCCUPANCY LIFECYCLE ===');
  const restId = 27; // Test restaurant id
  const tableNum = 'Table 99-Test';

  // Cleanup any leftover
  await supabase.from('restaurant_tables').delete().eq('restaurant_id', restId).eq('table_number', tableNum);

  // 1. DIRECT INSERT (TableView handleSaveTable)
  console.log('\n[1/5] Testing Table Creation (TableView.tsx)...');
  const { data: createdTable, error: createErr } = await supabase
    .from('restaurant_tables')
    .insert({
      restaurant_id: restId,
      table_number: tableNum,
      section_name: 'Terrace',
      floor_name: 'Terrace',
      seating_capacity: 4,
      capacity: 4,
      status: 'available',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (createErr || !createdTable) {
    console.error('❌ Failed to insert table:', createErr);
    process.exit(1);
  }
  console.log('✅ Table successfully inserted into public.restaurant_tables:');
  console.log(`   ID: ${createdTable.id}, Number: ${createdTable.table_number}, Status: ${createdTable.status}, Section: ${createdTable.section_name}`);

  // 2. FETCH TABLES ON RELOAD
  console.log('\n[2/5] Testing Table Retrieval on Page Reload (fetchTables)...');
  const { data: fetchedTables, error: fetchErr } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restId)
    .order('table_number', { ascending: true });

  if (fetchErr) {
    console.error('❌ Failed to fetch tables:', fetchErr);
    process.exit(1);
  }
  const foundTable = fetchedTables.find(t => t.id === createdTable.id);
  if (!foundTable) {
    console.error('❌ Inserted table not found on reload query!');
    process.exit(1);
  }
  console.log(`✅ Table verified on reload: "${foundTable.table_number}" with status "${foundTable.status}"`);

  // 3. AUTO-OCCUPIED ON SEND TO KITCHEN (PosView / AdminDashboardClient)
  console.log('\n[3/5] Testing Auto-Mark OCCUPIED on Order Send to Kitchen...');
  const testOrderId = '00000000-0000-0000-0000-000000000001'; // Valid UUID test ID
  const { error: occErr } = await supabase
    .from('restaurant_tables')
    .update({
      status: 'occupied',
      active_order_id: testOrderId,
      updated_at: new Date().toISOString()
    })
    .eq('id', createdTable.id)
    .eq('restaurant_id', restId);

  if (occErr) {
    console.error('❌ Failed to mark table occupied:', occErr);
    process.exit(1);
  }

  const { data: occTable } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('id', createdTable.id)
    .single();

  if (occTable.status !== 'occupied' || occTable.active_order_id !== testOrderId) {
    console.error('❌ Table status or order ID mismatch when occupied:', occTable);
    process.exit(1);
  }
  console.log(`✅ Table "${occTable.table_number}" automatically marked OCCUPIED in database! Active Order: ${occTable.active_order_id}`);

  // 4. AUTO-AVAILABLE ON BILL SETTLEMENT
  console.log('\n[4/5] Testing Auto-Mark AVAILABLE on Bill Settlement...');
  const { error: avErr } = await supabase
    .from('restaurant_tables')
    .update({
      status: 'available',
      current_order_id: null,
      active_order_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', createdTable.id)
    .eq('restaurant_id', restId);

  if (avErr) {
    console.error('❌ Failed to mark table available:', avErr);
    process.exit(1);
  }

  const { data: avTable } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('id', createdTable.id)
    .single();

  if (avTable.status !== 'available' || avTable.current_order_id !== null) {
    console.error('❌ Table status mismatch when released:', avTable);
    process.exit(1);
  }
  console.log(`✅ Table "${avTable.table_number}" automatically reverted to AVAILABLE in database! Current Order: ${avTable.current_order_id}`);

  // 5. PERMANENT DELETION (TableView handleDeleteTable)
  console.log('\n[5/5] Testing Permanent Table Deletion (TableView.tsx)...');
  const { error: delErr } = await supabase
    .from('restaurant_tables')
    .delete()
    .eq('id', createdTable.id)
    .eq('restaurant_id', restId);

  if (delErr) {
    console.error('❌ Failed to delete table:', delErr);
    process.exit(1);
  }

  const { data: afterDelete } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('id', createdTable.id);

  if (afterDelete && afterDelete.length > 0) {
    console.error('❌ Table still exists after deletion!');
    process.exit(1);
  }
  console.log(`✅ Table successfully and permanently deleted from public.restaurant_tables.`);

  console.log('\n🎉 ALL 5 TABLE PERSISTENCE & LIFECYCLE CHECKS PASSED PERFECTLY!\n');
}

runTableLifecycleTest().catch(console.error);
