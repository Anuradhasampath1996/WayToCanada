import type { NextConfig } from "next";
import { config } from "dotenv";

config();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/admindashboard", destination: "/dashboard/admindashboard" },
      { source: "/dashboard/login", destination: "/dashboard/login/v1" },
      { source: "/admindashboard/users/admins", destination: "/dashboard/admindashboard/users/admins" },
      { source: "/admindashboard/users/rcic", destination: "/dashboard/admindashboard/users/rcic" },
      { source: "/admindashboard/users/public", destination: "/dashboard/admindashboard/users/public" },
      { source: "/admindashboard/users/immigration-consult", destination: "/dashboard/admindashboard/users/immigration-consult" },
      { source: "/admindashboard/payment-gateway", destination: "/dashboard/admindashboard/payment-gateway" },
      { source: "/admindashboard/subscription-packages", destination: "/dashboard/admindashboard/subscription-packages" },
      { source: "/admindashboard/subscription-payments", destination: "/dashboard/admindashboard/subscription-payments" },
      { source: "/admindashboard/application-packages", destination: "/dashboard/admindashboard/application-packages" },
      { source: "/admindashboard/crs-calculator-sync", destination: "/dashboard/admindashboard/crs-calculator-sync" },
      { source: "/admindashboard/gst-hst-sync", destination: "/dashboard/admindashboard/gst-hst-sync" },
      { source: "/admindashboard/legislations-hub", destination: "/dashboard/admindashboard/legislations-hub" },
      { source: "/admindashboard/legislations-hub/documents/:id", destination: "/dashboard/admindashboard/legislations-hub/documents/:id" },
    ];
  },
  async redirects() {
    return [
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
