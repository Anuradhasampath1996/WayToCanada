import type { NextConfig } from "next";
import { config } from "dotenv";

config();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/admindashboard", destination: "/dashboard/admindashboard" },
      { source: "/admindashboard/:path*", destination: "/dashboard/admindashboard/:path*" },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard/login/v1",
        destination: "/dashboard/login",
        permanent: false,
      },
      {
        source: "/dashboard/login/v2",
        destination: "/dashboard/login",
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
