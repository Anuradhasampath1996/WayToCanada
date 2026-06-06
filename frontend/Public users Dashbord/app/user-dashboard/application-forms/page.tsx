import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { InteractiveApplicationForms } from "@/components/interactive-application-forms";
import { Button } from "@/components/ui/button";

export default function ApplicationFormsPage() {
  return (
    <div className="w-full space-y-6 pb-10">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="h-8 -ml-2 text-muted-foreground" asChild>
          <Link href="/user-dashboard">
            <ChevronLeft className="h-4 w-4 mr-0.5" /> Back to home
          </Link>
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Step 3 of 4</p>
          <h1 className="text-2xl font-bold tracking-tight">Application forms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete the IRCC forms assigned by your consultant. Your questionnaire answers are used to pre-fill fields when possible.
          </p>
        </div>
      </div>
      <InteractiveApplicationForms />
    </div>
  );
}
