const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/["\r]/g, '').trim();
  if (line.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].replace(/["\r]/g, '').trim();
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(url, key);

async function clean() {
  await sb.from('restaurant_tables').delete().eq('id', '305c5db7-eb1a-4935-85c4-28df321e161c');
  console.log('Cleaned test table');
}
clean();
