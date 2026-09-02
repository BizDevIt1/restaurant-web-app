import type { Metadata, Viewport } from "next";
import { Manrope, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SplashProvider } from "../components/SplashScreen";

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
  title: "Omnibites — One Platform for Every Restaurant, Cloud Kitchen & Franchise",
  description:
    "Omnibites unifies POS, kitchen display, inventory, online ordering, delivery, and multi-branch management into one complete restaurant operating system.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  keywords: [
    "Restaurant POS Software",
    "Omnibites",
    "Kitchen Display System",
    "Cloud Kitchen Operating System",
    "Multi-Branch Restaurant Software",
    "Restaurant Inventory Management",
    "Direct Online Ordering Marketplace",
  ],
  openGraph: {
    title: "Omnibites — One Platform for Every Restaurant, Cloud Kitchen & Franchise",
    description:
      "Omnibites unifies POS, kitchen display, inventory, online ordering, delivery, and multi-branch management into one complete restaurant operating system.",
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
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" sizes="any" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </head>
      <body className="min-h-screen text-[var(--text-hi)] bg-[var(--bg)] font-[family-name:var(--font-body)] antialiased selection:bg-[var(--gold)] selection:text-[var(--bg-deep)]">
        <SplashProvider defaultDuration={1200} autoPlayOnMount={true}>
          {children}
        </SplashProvider>
      </body>
    </html>
  );
}
