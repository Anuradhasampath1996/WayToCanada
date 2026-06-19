import type { NextConfig } from "next";
import path from "path";
import { config } from "dotenv";

config();

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [{ source: "/dashboard/login", destination: "/dashboard/login/v1" }];
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
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
