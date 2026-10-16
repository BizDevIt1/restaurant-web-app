const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of env.split('\n')) {
  if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/["\r]/g, '').trim();
  if (line.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].replace(/["\r]/g, '').trim();
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function test() {
  const { data: rests } = await supabase.from('restaurants').select('id, name, restaurant_name');
  console.log('Restaurants:', rests);
  const { data: menu } = await supabase.from('menu_items').select('id, name, stock_status, stock_count, restaurant_id');
  console.log('Total menu items in DB:', menu?.length);
  const restCounts = {};
  menu?.forEach(m => {
    restCounts[m.restaurant_id] = (restCounts[m.restaurant_id] || 0) + 1;
    if (m.name.toLowerCase().includes('karahi') || m.name.toLowerCase().includes('zinger') || m.name.toLowerCase().includes('lazania') || m.name.toLowerCase().includes('lasagna')) {
      console.log('Matched item:', m.id, m.name, 'restId:', m.restaurant_id, 'stock_count:', m.stock_count, 'stock_status:', m.stock_status);
    }
  });
  console.log('Menu items per restId:', restCounts);
  const { data: orders } = await supabase.from('orders').select('id, restaurant_id, order_status, items');
  console.log('Total orders in DB:', orders?.length);
  orders?.forEach(o => {
    console.log('Order restId:', o.restaurant_id, 'status:', o.order_status, 'items:', JSON.stringify(o.items));
  });
}
test();
