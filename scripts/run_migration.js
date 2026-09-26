const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', publishableKey = '';
for (const line of env.split('\n')) {
  if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/["\r]/g, '').trim();
  if (line.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) publishableKey = line.split('=')[1].replace(/["\r]/g, '').trim();
}

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(url, publishableKey);

async function check() {
  console.log('--- Kitchen Tickets Column Check ---');
  const { data: ktData, error: ktErr } = await sb.from('kitchen_tickets').select('*').limit(1);
  if (ktErr) {
    console.error('kitchen_tickets select error:', ktErr);
  } else if (ktData && ktData[0]) {
    console.log('kitchen_tickets keys:', Object.keys(ktData[0]));
  } else {
    console.log('kitchen_tickets has 0 rows');
  }

  console.log('\n--- Orders Column Check ---');
  const { data: oData, error: oErr } = await sb.from('orders').select('*').limit(1);
  if (oErr) {
    console.error('orders select error:', oErr);
  } else if (oData && oData[0]) {
    console.log('orders keys:', Object.keys(oData[0]));
  } else {
    console.log('orders has 0 rows');
  }

  console.log('\n--- Menu Items Column Check ---');
  const { data: mData, error: mErr } = await sb.from('menu_items').select('*').limit(1);
  if (mErr) {
    console.error('menu_items select error:', mErr);
  } else if (mData && mData[0]) {
    console.log('menu_items keys:', Object.keys(mData[0]));
  }
}

check().catch(console.error);
