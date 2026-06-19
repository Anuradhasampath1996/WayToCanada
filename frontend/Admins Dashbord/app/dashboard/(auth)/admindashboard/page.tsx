import { generateMeta } from "@/lib/utils";
import { AdminDashboardClient } from "./admin-dashboard-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Dashboard",
    description: "RCICMASTER admin portal overview.",
    canonical: "/admindashboard",
  });
}

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}
