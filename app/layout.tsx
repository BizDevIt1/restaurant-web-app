import type { Metadata, Viewport } from "next";
import { Manrope, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#140c0c",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "FoodNet — The Operating System for Pakistani Restaurants",
  description:
    "All-in-one POS, KDS, inventory management, and online ordering marketplace built specifically for restaurants, cloud kitchens, and franchises across Pakistan. Native PKR, JazzCash, Easypaisa, and thermal printer support.",
  keywords: [
    "Restaurant POS Pakistan",
    "FoodNet",
    "Kitchen Display System Pakistan",
    "JazzCash restaurant payment",
    "Easypaisa POS",
    "Cloud kitchen software Lahore Karachi Islamabad",
    "Restaurant inventory management PKR",
  ],
  openGraph: {
    title: "FoodNet — The Operating System for Pakistani Restaurants",
    description:
      "Manage your restaurant with one complete POS, KDS, inventory & online ordering system. Built for Pakistan.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable} scroll-smooth`}
    >
      <body className="min-h-screen text-[var(--text-hi)] bg-[var(--bg)] font-[family-name:var(--font-body)] antialiased selection:bg-[var(--gold)] selection:text-[var(--bg-deep)]">
        {children}
      </body>
    </html>
  );
}
