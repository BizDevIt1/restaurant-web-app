const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of env.split('\n')) {
  if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/["\r]/g, '').trim();
  if (line.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].replace(/["\r]/g, '').trim();
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function inspectRest40() {
  const { data: menu } = await supabase.from('menu_items').select('*').eq('restaurant_id', 40);
  console.log('--- Menu items for 40 ---');
  menu?.forEach(m => {
    console.log(`Item: ${m.name} (id: ${m.id}) | stock_count: ${m.stock_count} | stock_status: ${m.stock_status} | variants: ${JSON.stringify(m.variants)}`);
  });

  const { data: rawMats } = await supabase.from('raw_materials').select('*').eq('restaurant_id', 40);
  console.log('\n--- Raw Materials for 40 ---');
  rawMats?.forEach(r => {
    console.log(`Raw: ${r.name} (id: ${r.id}) | current_stock: ${r.current_stock} ${r.unit}`);
  });

  const { data: recipes } = await supabase.from('recipe_items').select('*').eq('restaurant_id', 40);
  console.log('\n--- Recipes for 40 ---');
  recipes?.forEach(rc => {
    console.log(`Recipe: menu_item_id: ${rc.menu_item_id} | variant_id: ${rc.variant_id} | raw_mat_id: ${rc.raw_material_id} | qty: ${rc.quantity_required}`);
  });

  const { data: activeOrders } = await supabase.from('orders').select('*').eq('restaurant_id', 40).eq('order_status', 'active');
  console.log(`\n--- Active orders for 40 (${activeOrders?.length || 0}) ---`);
  activeOrders?.forEach(o => {
    console.log(`Order ${o.order_number || o.id} (${o.order_status}):`, JSON.stringify(o.items));
  });
}
inspectRest40();
