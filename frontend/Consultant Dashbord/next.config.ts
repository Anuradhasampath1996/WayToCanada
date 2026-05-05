import type { NextConfig } from "next";
import { config } from "dotenv";

config();

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  assetPrefix: isProduction ? undefined : undefined,
  async rewrites() {
    return [
      { source: "/consultantdashboard", destination: "/dashboard/default" },
      { source: "/dashboard/login", destination: "/dashboard/login/v1" },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard/default",
        destination: "/consultantdashboard",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost"
      },
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;

