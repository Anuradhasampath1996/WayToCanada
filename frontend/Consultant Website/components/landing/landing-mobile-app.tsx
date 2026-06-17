import Link from "next/link";
import { ArrowRight, Bell, Smartphone, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileAppMockup } from "./mobile-app-mockup";

const appFeatures = [
  "Real-time client & case notifications",
  "Approve invites and messages on the go",
  "Meeting reminders & payment alerts",
  "Secure access with the same RCIC account",
];

export function LandingMobileApp() {
  return (
    <section id="mobile-app" className="scroll-mt-24 border-y border-emerald-500/10 bg-white py-16 lg:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <div className="order-2 lg:order-1">
          <MobileAppMockup />
        </div>
        <div className="order-1 lg:order-2">
          <Badge variant="outline" className="mb-4 border-emerald-500/20 bg-emerald-500/5">
            <Smartphone className="mr-1.5 h-3.5 w-3.5" />
            Mobile App
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Your practice in your pocket —{" "}
            <span className="landing-gradient-text">iOS & Android app</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            WayToCanada includes a dedicated mobile app for consultants. Stay connected
            with clients, track cases, and respond to urgent matters — whether you are
            in the office or on the move.
          </p>
          <ul className="mt-6 space-y-3">
            {appFeatures.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-foreground/90">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/10">
                  <Bell className="h-3 w-3 text-emerald-600" />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 py-1.5">
              <Wifi className="h-3.5 w-3.5 text-emerald-600" /> Works with your dashboard
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 py-1.5">
              Included with subscription
            </span>
          </div>
          <Button className="mt-8 rounded-xl bg-emerald-600 hover:bg-emerald-700" size="lg" asChild>
            <Link href="/register">
              Get the app — Register free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
