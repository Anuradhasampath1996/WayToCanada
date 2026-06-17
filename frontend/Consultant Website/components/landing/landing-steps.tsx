import { Badge } from "@/components/ui/badge";

const steps = [
  {
    step: "01",
    title: "Create your account",
    description: "Sign up with RCIC credentials in minutes — email or Google.",
  },
  {
    step: "02",
    title: "Verify your license",
    description: "We validate your CICC registration against the public RCIC register.",
  },
  {
    step: "03",
    title: "Set up your portal",
    description: "Configure services, rates, branding, and your consultant profile.",
  },
  {
    step: "04",
    title: "Start winning clients",
    description: "Invite clients, manage cases, and grow your immigration practice.",
  },
];

export function LandingSteps() {
  return (
    <section id="how-it-works" className="landing-section-alt py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="outline" className="mb-4 border-emerald-500/20 bg-white">Simple onboarding</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Live in four steps</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            From registration to your first client — fast, verified, and stress-free.
          </p>
        </div>

        <div className="relative mt-16">
          <div className="absolute left-[2rem] top-0 bottom-0 w-px bg-gradient-to-b from-emerald-300 via-emerald-400 to-transparent lg:left-0 lg:right-0 lg:top-8 lg:bottom-auto lg:h-0.5 lg:w-auto lg:bg-gradient-to-r lg:from-transparent lg:via-emerald-300 lg:to-transparent" />

          <div className="grid gap-10 lg:grid-cols-4 lg:gap-8">
            {steps.map((item, i) => (
              <div key={item.step} className="relative flex gap-6 lg:flex-col lg:items-center lg:text-center">
                <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-lg font-bold text-white shadow-xl shadow-emerald-600/35 ring-4 ring-white">
                  {item.step}
                </div>
                <div className="pt-1 lg:pt-0">
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  {i < steps.length - 1 && (
                    <span className="mt-3 hidden text-xs font-medium text-emerald-600 lg:inline-block">
                      Next →
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
