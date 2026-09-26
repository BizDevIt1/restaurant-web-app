const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of env.split('\n')) {
  if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/["\r]/g, '').trim();
  if (line.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].replace(/["\r]/g, '').trim();
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(url, key);

async function inspectMenu() {
  const { data, error } = await sb.from('menu_items').select('*').limit(1);
  if (error) {
    console.error('Error querying menu_items:', error);
  } else if (data && data[0]) {
    console.log('Columns in menu_items:');
    for (const [k, v] of Object.entries(data[0])) {
      console.log(`  ${k}: ${v} (${typeof v})`);
    }
  } else {
    console.log('No menu_items rows found.');
  }

  // Check columns for availability
  const checkCols = ['is_available', 'in_stock', 'is_in_stock', 'available', 'status'];
  for (const c of checkCols) {
    const { error: cErr } = await sb.from('menu_items').select(c).limit(1);
    console.log(`Column ${c}: ${cErr ? 'NO (' + cErr.message + ')' : 'YES'}`);
  }
}

inspectMenu();
