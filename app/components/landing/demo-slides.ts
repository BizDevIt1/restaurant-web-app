export type DemoSlide = {
  id: string;
  label: string;
  caption: string;
  videoSrc: string;
  posterSrc?: string;
};

export const DEMO_SLIDES: DemoSlide[] = [
  {
    id: "overview",
    label: "Overview",
    caption: "A two-minute tour of POS, kitchen display, inventory and reports.",
    videoSrc: "/demo/overview.mp4",
    posterSrc: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "pos",
    label: "POS",
    caption: "Ring up dine-in, takeaway or delivery orders in a few taps.",
    videoSrc: "/demo/pos.mp4",
    posterSrc: "https://images.unsplash.com/photo-1556742049-0a67daf64f22?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "kds",
    label: "Kitchen Display",
    caption: "Tickets appear by station the moment an order is placed.",
    videoSrc: "/demo/kds.mp4",
    posterSrc: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "inventory",
    label: "Inventory",
    caption: "Stock levels update automatically as recipes get sold.",
    videoSrc: "/demo/inventory.mp4",
    posterSrc: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "reports",
    label: "Reports",
    caption: "Break down sales, wastage and staff performance by branch.",
    videoSrc: "/demo/reports.mp4",
    posterSrc: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    caption: "Your own branded ordering page for customers to browse and order.",
    videoSrc: "/demo/marketplace.mp4",
    posterSrc: "https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1200&q=80",
  },
];
