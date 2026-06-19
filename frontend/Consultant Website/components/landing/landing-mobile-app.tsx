import Link from "next/link";
import { ArrowRight, Bell, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileAppMockup } from "./mobile-app-mockup";

const appFeatures = [
  "Real-time client & case notifications",
  "Approve invites and messages on the go",
  "Meeting reminders & payment alerts",
  "Secure access with the same RCIC account",
];

export function LandingMobileApp() {
  return (
    <section id="mobile-app" className="scroll-mt-24 bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center lg:max-w-none">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c8102e]">Mobile app</p>
          <h2 className="mt-3 text-3xl font-bold text-black sm:text-4xl">
            Your practice in your pocket
          </h2>
        </div>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-3">
          <div className="hidden justify-center lg:flex">
            <div className="rounded-[2rem] border-4 border-black bg-[#c8102e] p-6 shadow-2xl">
              <Smartphone className="h-16 w-16 text-white" />
              <p className="mt-3 text-center text-xs font-bold uppercase text-white">Document Upload</p>
            </div>
          </div>

          <div className="flex justify-center">
            <MobileAppMockup />
          </div>

          <div className="space-y-4 lg:pl-4">
            <p className="text-neutral-600">
              WayToCanada includes a dedicated mobile app for consultants. Stay connected
              with clients whether you are in the office or on the move.
            </p>
            <ul className="space-y-3">
              {appFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-black">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50">
                    <Bell className="h-3 w-3 text-[#c8102e]" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Button className="mt-4 rounded-md bg-[#c8102e] hover:bg-[#a00d24]" asChild>
              <Link href="/register">
                Get the app — Register free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
