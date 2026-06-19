import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingCta() {
  return (
    <section id="contact" className="relative overflow-hidden bg-[#c8102e] py-20 lg:py-28">
      <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_20%_50%,white,transparent_50%),radial-gradient(circle_at_80%_50%,white,transparent_50%)]" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold uppercase tracking-tight text-white sm:text-4xl lg:text-5xl">
          Ready to transform your practice?
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-white/90">
          Join WayToCanada today — register free and start managing clients with the platform
          built for modern RCICs across Canada.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Button
            size="lg"
            className="h-12 min-w-[200px] rounded-md bg-white font-bold uppercase tracking-wide text-[#c8102e] shadow-xl hover:bg-neutral-100"
            asChild
          >
            <Link href="/register">
              Get started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 min-w-[160px] rounded-md border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
        <p className="mt-8 text-sm text-white/75">
          RCIC verification required · Secure & PIPEDA-aware · Canadian infrastructure
        </p>
      </div>
    </section>
  );
}
