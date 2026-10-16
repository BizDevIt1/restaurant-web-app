const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of env.split('\n')) {
  if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/["\r]/g, '').trim();
  if (line.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].replace(/["\r]/g, '').trim();
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function checkOrders() {
  const { data: orders } = await supabase.from('orders').select('*').eq('restaurant_id', 40).eq('order_status', 'active');
  console.log(`Found ${orders?.length} active orders for restaurant 40:`);
  orders?.forEach(o => {
    console.log(`Order ID: ${o.id} | No: ${o.order_number} | Status: ${o.order_status} | Items: ${JSON.stringify(o.items)}`);
  });
}
checkOrders();
