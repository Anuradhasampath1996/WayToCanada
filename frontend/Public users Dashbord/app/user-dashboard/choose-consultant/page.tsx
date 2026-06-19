import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { generateMeta } from "@/lib/utils";
import { ChooseConsultantPage } from "./choose-consultant-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Choose Your Consultant",
    description: "Select a licensed RCIC consultant to guide your immigration journey.",
    canonical: "/user-dashboard/choose-consultant",
  });
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ChooseConsultantPage />
    </Suspense>
  );
}
