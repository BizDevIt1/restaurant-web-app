import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.10"],
  async redirects() {
    return [
      {
        source: "/z-report",
        destination: "/terminal/pos/z-report",
        permanent: false,
      },
      {
        source: "/zreport",
        destination: "/terminal/pos/z-report",
        permanent: false,
      },
      {
        source: "/pos/z-report",
        destination: "/terminal/pos/z-report",
        permanent: false,
      },
      {
        source: "/pos/zreport",
        destination: "/terminal/pos/z-report",
        permanent: false,
      },
      {
        source: "/terminal/zreport",
        destination: "/terminal/pos/z-report",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "source.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
    ],
  },
};

export default nextConfig;
