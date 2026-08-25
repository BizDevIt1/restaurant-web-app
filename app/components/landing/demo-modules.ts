export type DemoModule = {
  id: string;
  label: string;
  tag: string;
  videoSrc: string;
  posterSrc: string;
  caption: string;
  durationLabel: string;
};

export const DEMO_MODULES: DemoModule[] = [
  {
    id: "overview",
    label: "Overview",
    tag: "FULL SYSTEM TOUR",
    videoSrc: "/videos/overview.mp4",
    posterSrc: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    caption: "Watch a complete two-minute tour of Omnibites — from table billing to kitchen display, inventory deduction, and nightly reports.",
    durationLabel: "2-MIN WALKTHROUGH",
  },
  {
    id: "pos",
    label: "POS & Billing",
    tag: "FRONTLINE BILLING",
    videoSrc: "/videos/pos.mp4",
    posterSrc: "https://images.unsplash.com/photo-1556742049-0a67daf64f22?auto=format&fit=crop&w=1200&q=80",
    caption: "Fast cashier billing, dine-in table layout, split payments, digital QR codes, and multi-language thermal receipt slips.",
    durationLabel: "45 SEC",
  },
  {
    id: "kds",
    label: "Kitchen Display",
    tag: "KITCHEN ROUTING",
    videoSrc: "/videos/kds.mp4",
    posterSrc: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    caption: "Color-coded order tickets routed directly to main grill, fryer, or assembly stations with rush alerts and cook time tracking.",
    durationLabel: "35 SEC",
  },
  {
    id: "inventory",
    label: "Inventory",
    tag: "RECIPE DEDUCTION",
    videoSrc: "/videos/inventory.mp4",
    posterSrc: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    caption: "Automatic raw ingredient stock deduction per bill, recipe costing, low stock reorder alerts, and supplier purchase orders.",
    durationLabel: "50 SEC",
  },
  {
    id: "reports",
    label: "Reports",
    tag: "SETTLEMENT & P&L",
    videoSrc: "/videos/reports.mp4",
    posterSrc: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80",
    caption: "Real-time revenue graphs, dish margins, payment channel breakdowns (Card, Mobile Wallet, Cash), and automated end-of-day Z-reports.",
    durationLabel: "40 SEC",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    tag: "DIRECT ORDERING",
    videoSrc: "/videos/marketplace.mp4",
    posterSrc: "https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1200&q=80",
    caption: "Zero-commission direct delivery web app for customers with live order tracking and instant online checkout.",
    durationLabel: "40 SEC",
  },
];
