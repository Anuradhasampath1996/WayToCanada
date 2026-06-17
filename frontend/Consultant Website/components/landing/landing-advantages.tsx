import {
  CalendarClock,
  Cloud,
  CreditCard,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";

const advantages = [
  {
    icon: CreditCard,
    title: "No commission on client fees",
    body: "Keep 100% of what your clients pay you. Fixed subscription — not a cut of your revenue.",
  },
  {
    icon: CalendarClock,
    title: "Cancel anytime",
    body: "Flexible monthly billing. Upgrade, downgrade, or cancel when your practice needs change.",
  },
  {
    icon: Smartphone,
    title: "Mobile app included",
    body: "iOS and Android app for consultants — notifications, cases, and messages on the go.",
  },
  {
    icon: Users,
    title: "Your own client portal",
    body: "Branded workspace per client. Invites, questionnaires, retainers, and case hub in one place.",
  },
  {
    icon: ShieldCheck,
    title: "CICC-ready compliance",
    body: "Trust ledger, retainer milestones, and audit trails built for regulated RCIC practice.",
  },
  {
    icon: Cloud,
    title: "Canadian cloud hosting",
    body: "Secure infrastructure with 24/7 access from dashboard and mobile app.",
  },
];

export function LandingAdvantages() {
  return (
    <section className="border-y border-emerald-500/10 bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            More advantages, fewer headaches
          </h2>
          <p className="mt-3 text-muted-foreground">
            Everything you need to run a modern immigration practice — without enterprise complexity.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {advantages.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.title} className="rounded-2xl border border-border/60 bg-muted/20 p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
