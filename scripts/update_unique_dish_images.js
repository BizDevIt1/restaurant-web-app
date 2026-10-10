const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of env.split('\n')) {
  if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/["\r]/g, '').trim();
  if (line.includes('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].replace(/["\r]/g, '').trim();
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(url, key);

async function run() {
  console.log("Updating existing menu items with unique accurate images in public.menu_items...");

  // 1. Malai Boti: dedicated creamy charred BBQ boti skewers
  const { error: err1 } = await sb
    .from('menu_items')
    .update({
      image_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=500&auto=format&fit=crop&q=80',
      category: 'bbq'
    })
    .ilike('name', '%malai%boti%');
  if (err1) console.error("Error updating malai boti:", err1);
  else console.log("Updated Malai Boti with dedicated BBQ boti photo.");

  // 2. Karahi: authentic rich wok karahi stew
  const { error: err2 } = await sb
    .from('menu_items')
    .update({
      image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=80'
    })
    .ilike('name', '%karahi%');
  if (err2) console.error("Error updating karahi:", err2);
  else console.log("Updated Karahi with dedicated wok karahi photo.");

  // 3. Zinger: crispy golden chicken fillet burger
  const { error: err3 } = await sb
    .from('menu_items')
    .update({
      image_url: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=500&auto=format&fit=crop&q=80'
    })
    .ilike('name', '%zinger%');
  if (err3) console.error("Error updating zinger:", err3);
  else console.log("Updated Zinger with dedicated crispy burger photo.");

  const { data: finalData } = await sb.from('menu_items').select('id, name, category, image_url');
  console.log("Current menu items in database:");
  console.log(finalData);
}

run();
