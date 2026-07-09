import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["geist"],
  // /wc-live prerenders ~140 Transfermarkt requests (a manager history + one
  // friendlies page per comparable manager, for every nation off its value
  // seeding), throttled to 4 concurrent. That takes ~90s from cold, so the 60s
  // default fails the build whenever the 6h manager cache has expired.
  staticPageGenerationTimeout: 300,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tmssl.akamaized.net",
      },
      {
        protocol: "https",
        hostname: "img.a.transfermarkt.technology",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
