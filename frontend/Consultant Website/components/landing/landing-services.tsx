import Link from "next/link";
import { BarChart3, Megaphone, Users, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Users,
    title: "Client Management",
    body: "Invite clients, manage workspaces, track application progress, and keep every conversation in one secure hub.",
    href: "/#features",
  },
  {
    icon: BarChart3,
    title: "Reporting & Analytics",
    body: "Activity reports, case pipeline views, and trust ledger summaries — know exactly where every file stands.",
    href: "/#features",
  },
  {
    icon: Megaphone,
    title: "Marketing Services",
    body: "Optional add-ons: professional website, social media management, and Google Ads campaigns run by our team.",
    href: "/#features",
  },
];

export function LandingServices() {
  return (
    <section className="bg-[#f5f5f5] py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="rcx-card rcx-card-hover flex flex-col rounded-2xl p-7 transition-all duration-300"
              >
                <div className="rcx-icon-box">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-black">{s.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-600">{s.body}</p>
                <Link
                  href={s.href}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#c8102e] hover:underline"
                >
                  Learn more <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
