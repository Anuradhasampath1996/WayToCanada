import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingCta() {
  return (
    <section id="contact" className="relative overflow-hidden py-24 lg:py-32">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800" />
      <div className="absolute inset-0 -z-10 opacity-40 [background-image:radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.25),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(20,184,166,0.3),transparent_50%)]" />
      <div className="landing-grid-pattern pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-200/90">Get started today</p>
        <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
          Ready to transform your practice?
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-emerald-50/90">
          Join WayToCanada — free to register. Start managing clients with the platform
          built for modern RCICs.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Button
            size="lg"
            variant="secondary"
            className="h-12 min-w-[220px] rounded-xl bg-white font-semibold text-emerald-800 shadow-xl hover:bg-emerald-50"
            asChild
          >
            <Link href="/register">
              Register as Consultant
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 min-w-[160px] rounded-xl border-white/40 bg-white/5 text-white backdrop-blur hover:bg-white/15 hover:text-white"
            asChild
          >
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
        <p className="mt-8 text-sm text-emerald-100/75">
          RCIC verification required · Secure & PIPEDA-aware · Canadian infrastructure
        </p>
      </div>
    </section>
  );
}
