import type { NextConfig } from "next";
import { config } from "dotenv";

config();

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  assetPrefix: isProduction ? "https://dashboard.shadcnuikit.com" : undefined,
  async rewrites() {
    return [
      { source: "/admindashboard", destination: "/dashboard/default" },
      { source: "/dashboard/login", destination: "/dashboard/login/v1" },
      { source: "/admindashboard/users/admins", destination: "/dashboard/admindashboard/users/admins" },
      { source: "/admindashboard/users/rcic", destination: "/dashboard/admindashboard/users/rcic" },
      { source: "/admindashboard/users/public", destination: "/dashboard/admindashboard/users/public" },
      { source: "/admindashboard/users/immigration-consult", destination: "/dashboard/admindashboard/users/immigration-consult" },
      { source: "/admindashboard/payment-gateway", destination: "/dashboard/admindashboard/payment-gateway" },
      { source: "/admindashboard/subscription-packages", destination: "/dashboard/admindashboard/subscription-packages" },
      { source: "/admindashboard/subscription-payments", destination: "/dashboard/admindashboard/subscription-payments" },
      { source: "/admindashboard/application-packages", destination: "/dashboard/admindashboard/application-packages" },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard/default",
        destination: "/admindashboard",
        permanent: false,
      },
      {
        source: "/dashboard/login/v1",
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
