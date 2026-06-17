import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  FileStack,
  Globe2,
  LineChart,
  MessageSquareHeart,
  Sparkles,
} from "lucide-react";

const benefits = [
  {
    icon: Globe2,
    title: "Win clients with a modern portal",
    body: "Branded client experience from invite to submission — builds trust before the first call.",
    accent: "from-sky-500/15 to-blue-500/5",
  },
  {
    icon: FileStack,
    title: "One place for every document",
    body: "Questionnaires, retainers, IRCC forms, and case files — organized per client, searchable forever.",
    accent: "from-emerald-500/15 to-teal-500/5",
  },
  {
    icon: LineChart,
    title: "Pathway decisions with data",
    body: "CRS calculator, eligibility insights, and visual pipeline so nothing slips through the cracks.",
    accent: "from-violet-500/15 to-purple-500/5",
  },
  {
    icon: MessageSquareHeart,
    title: "Communicate in context",
    body: "Secure messaging, meeting scheduling, and payment links tied to each case — not lost in email.",
    accent: "from-rose-500/15 to-pink-500/5",
  },
  {
    icon: Briefcase,
    title: "CICC-ready trust & compliance",
    body: "Trust ledger, activity audit PDFs, and retainer milestones designed for regulated practice.",
    accent: "from-amber-500/15 to-orange-500/5",
  },
  {
    icon: Sparkles,
    title: "Scale without extra staff",
    body: "Automation for invites, reminders, OCR prefill, and LMS training — grow revenue, not overhead.",
    accent: "from-cyan-500/15 to-emerald-500/5",
  },
];

export function LandingWhyJoin() {
  return (
    <section id="why-join" className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 border-emerald-500/20 bg-emerald-500/5">
            Why consultants choose us
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            Stop losing clients to{" "}
            <span className="landing-gradient-text">outdated workflows</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Applicants compare consultants online first. WayToCanada makes you look as
            professional as the largest firms — at a fraction of the cost.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="landing-card-glow group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/25"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${b.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-500/20">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
