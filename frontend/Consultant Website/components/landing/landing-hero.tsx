import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const traditional = [
  "Scattered spreadsheets & email threads",
  "Manual retainer tracking",
  "No mobile access for consultants",
  "Compliance gaps & audit stress",
];

const withPlatform = [
  "Unified client workspace & case hub",
  "Automated retainer & trust ledger",
  "iOS & Android consultant app",
  "CICC-aligned compliance built in",
];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1920&q=80"
          alt="Professional consultants"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        <div className="rcx-hero-overlay absolute inset-0" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-14 sm:px-6 lg:px-8 lg:pb-16 lg:pt-20">
        <div className="grid items-end gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="rcx-fade-up max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c8102e]">
              For RCICs across Canada
            </p>
            <h1 className="mt-4 text-4xl font-extrabold uppercase leading-[1.05] tracking-tight text-black sm:text-5xl lg:text-[3.25rem]">
              Empowering RCICs.
              <br />
              Mastering compliance.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-neutral-600 sm:text-lg">
              One platform for your entire immigration practice — client portal, case management,
              retainers, legislation tools, and a mobile app. Built for modern consultants.
            </p>
            <Button
              size="lg"
              className="mt-8 h-12 rounded-md bg-[#c8102e] px-8 text-base font-semibold hover:bg-[#a00d24]"
              asChild
            >
              <Link href="/register">
                Start free trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>

          <div className="rcx-fade-up rcx-card rounded-2xl p-6 sm:p-8 lg:-mb-4 lg:shadow-xl" style={{ animationDelay: "0.15s" }}>
            <h2 className="text-xl font-bold text-black">The RCIC Advantage</h2>
            <p className="mt-1 text-sm text-neutral-500">Traditional practice vs. WayToCanada</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-400">Without us</p>
                <ul className="space-y-2.5">
                  {traditional.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-neutral-600">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#c8102e]">With WayToCanada</p>
                <ul className="space-y-2.5">
                  {withPlatform.map((item) => (
                    <li key={item} className="flex gap-2 text-sm font-medium text-black">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#c8102e]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
