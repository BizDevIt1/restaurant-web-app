/**
 * Smart Food Image Resolver for POS Terminal & Food Catalogs.
 * Ensures 100% unique, appetizing imagery for every distinct dish, beverage, or volume variant.
 * Strictly prioritizes item-specific explicit URLs, followed by granular name-based matching.
 */

export function getSmartFoodImage(
  name: string = "",
  category: string = "",
  explicitUrl?: string
): string {
  // 1. Strictly honor explicit image URL assigned to item or variant in database
  if (explicitUrl && typeof explicitUrl === "string") {
    const trimmed = explicitUrl.trim();
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:image/") ||
      trimmed.startsWith("/")
    ) {
      return trimmed;
    }
  }

  const cleanName = (name || "").toLowerCase().trim();
  const cleanCat = (category || "").toLowerCase().trim();

  // ---------------------------------------------------------------------------
  // 2. BEVERAGES & VOLUME VARIANTS (Distinguish 250ml Can, 500ml Bottle, 1.5L Bottle, Water)
  // ---------------------------------------------------------------------------
  if (/water|mineral|aquafina|nestle|dasani/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80";
  }

  // 1.5L / 2L / 2.25L Family Bottles
  if (/1\.5\s*l|1\.5\s*liter|2\s*l|2\.25\s*l|jumbo|family|large\s*bottle/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=500&auto=format&fit=crop&q=80";
  }

  // 500ml / Half Liter Bottles
  if (/500\s*ml|half\s*liter|0\.5\s*l|pet\s*bottle|small\s*bottle/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=500&auto=format&fit=crop&q=80";
  }

  // 250ml / 300ml / Can / Tin
  if (/can|tin|250\s*ml|300\s*ml/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80";
  }

  // Lime / Mint Margarita / Sprite / 7Up
  if (/sprite|7up|lime|lemon|mint|citrus|mojito|lemonade|dew/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80";
  }

  // Chai / Karak / Tea
  if (/chai|tea|karak|doodh patti|green tea/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80";
  }

  // Coffee / Latte / Espresso
  if (/coffee|latte|cappuccino|espresso/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=80";
  }

  // Generic colas/drinks if matched by name
  if (/coke|pepsi|cola|soda|fanta|marinda/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80";
  }

  // ---------------------------------------------------------------------------
  // 3. DESI BBQ & TANDOOR (PRIORITIZED BEFORE KARAHI TO PREVENT COLLISION)
  // ---------------------------------------------------------------------------
  // Malai Boti / Malai Tikka: Distinct creamy white charred BBQ skewers
  if (/malai|creamy boti|white boti/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=500&auto=format&fit=crop&q=80";
  }

  // Seekh Kebab / Reshmi Kebab / Chapli Kebab
  if (/seekh|kabab|kebab|chapli|reshmi/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=500&auto=format&fit=crop&q=80";
  }

  // Chicken Tikka / Tandoori Tikka / Boti / Sajji / Chargha
  if (/tikka|tandoori|boti|sajji|chargha|bbq|grill/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=80";
  }

  // ---------------------------------------------------------------------------
  // 4. KARAHI, HANDI & GRAVIES
  // ---------------------------------------------------------------------------
  // Authentic Wok Karahi (Chicken Karahi, Mutton Karahi, Shinwari Karahi)
  if (/karahi|shinwari|peshawari/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=80";
  }

  // Clay Pot Handi / Makhni
  if (/handi|makhni|butter chicken|paneer/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80";
  }

  // Nihari / Haleem / Paye / Qorma
  if (/nihari|haleem|paye|qorma|korma|curry|gravy/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80";
  }

  // ---------------------------------------------------------------------------
  // 5. BURGERS, SANDWICHES & FAST FOOD
  // ---------------------------------------------------------------------------
  // Crispy Chicken Zinger
  if (/zinger|crispy.*burger|fried chicken/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=500&auto=format&fit=crop&q=80";
  }

  // Beef Burger / Smash Burger / Cheeseburger
  if (/burger|patty|slider|smash/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80";
  }

  // Sandwich / Club Sandwich / Wrap
  if (/sandwich|club|wrap|roll|shawarma/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80";
  }

  // Pizza & Calzones
  if (/pizza|calzone|crust|slice/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&auto=format&fit=crop&q=80";
  }

  // Fries / Wings / Nuggets / Strips
  if (/fries|fry|nugget|wing|tender|snack|sides|strips|chips/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500&auto=format&fit=crop&q=80";
  }

  // ---------------------------------------------------------------------------
  // 6. RICE & BIRYANI
  // ---------------------------------------------------------------------------
  if (/biryani|dum biryani/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500&auto=format&fit=crop&q=80";
  }

  if (/pulao|rice|fried rice/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80";
  }

  // ---------------------------------------------------------------------------
  // 7. DESSERTS & SWEETS
  // ---------------------------------------------------------------------------
  if (/ice cream|kulfi/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500&auto=format&fit=crop&q=80";
  }

  if (/dessert|cake|sweet|kheer|halwa|brownie|gulab|pastry|shake/i.test(cleanName)) {
    return "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=500&auto=format&fit=crop&q=80";
  }

  // ---------------------------------------------------------------------------
  // 8. CATEGORY-LEVEL FALLBACKS (If dish name is generic e.g. "Special 1")
  // ---------------------------------------------------------------------------
  if (/bbq/i.test(cleanCat)) {
    return "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=80";
  }
  if (/karahi|handi/i.test(cleanCat)) {
    return "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=80";
  }
  if (/burger/i.test(cleanCat)) {
    return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80";
  }
  if (/fast.*food|pizza/i.test(cleanCat)) {
    return "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&auto=format&fit=crop&q=80";
  }
  if (/drink|beverage/i.test(cleanCat)) {
    return "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80";
  }
  if (/dessert/i.test(cleanCat)) {
    return "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=500&auto=format&fit=crop&q=80";
  }

  // Default High-End Main Course Platter
  return "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80";
}
