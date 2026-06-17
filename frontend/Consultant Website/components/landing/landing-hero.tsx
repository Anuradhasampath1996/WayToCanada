import Link from "next/link";
import { ArrowRight, CheckCircle2, Shield, Smartphone, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardMockup } from "./dashboard-mockup";

const pillars = [
  { icon: Shield, text: "CICC-aligned trust & compliance tools" },
  { icon: Smartphone, text: "Consultant mobile app — iOS & Android" },
  { icon: Zap, text: "All-in-one dashboard — no spreadsheets" },
];

export function LandingHero() {
  return (
    <section className="landing-mesh relative overflow-hidden">
      <div className="landing-grid-pattern pointer-events-none absolute inset-0" />
      <div className="landing-orb -left-20 top-20 h-72 w-72 bg-emerald-400/30" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
        <div className="landing-fade-up">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
            RCICs across Canada
          </p>

          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            Finally, one platform for your entire{" "}
            <span className="landing-gradient-text">immigration practice</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Client portal, case management, retainers, trust ledger, legislation tools —
            plus a mobile app. Everything consultants need to grow without losing control.
          </p>

          <ul className="mt-8 space-y-3">
            {pillars.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm font-medium text-foreground/90">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
                  <p.icon className="h-4 w-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="h-12 rounded-xl bg-emerald-600 px-8 shadow-lg shadow-emerald-600/30 hover:bg-emerald-700"
              asChild
            >
              <Link href="/register">
                Start free — Register
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 rounded-xl bg-white/70" asChild>
              <Link href="/#pricing">View pricing</Link>
            </Button>
          </div>

          <Badge className="mt-6 border-emerald-200/80 bg-white/80 text-emerald-800 hover:bg-white/80">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Mobile app included with every plan
          </Badge>
        </div>

        <div className="landing-float relative">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}
