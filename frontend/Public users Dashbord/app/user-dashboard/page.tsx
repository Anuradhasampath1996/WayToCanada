import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { generateMeta } from "@/lib/utils";
import { ClientDashboard } from "../dashboard/(auth)/default/client-dashboard";

export async function generateMetadata() {
  return generateMeta({
    title: "Your Journey",
    description: "Track your immigration case step by step — RCICMASTER.",
    canonical: "/user-dashboard",
  });
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ClientDashboard />
    </Suspense>
  );
}
