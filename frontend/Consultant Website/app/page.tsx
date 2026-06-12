import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Brain,
  Calculator,
  CheckCircle2,
  CreditCard,
  FileCheck,
  FileText,
  MessageSquare,
  ScanLine,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

const platformFeatures = [
  {
    icon: Users,
    title: "Client Workspace",
    description: "Manage every client, case file, and application stage from one intelligent dashboard.",
    tag: "Core",
  },
  {
    icon: FileText,
    title: "IRCC Forms & Packages",
    description: "Prepare application packages, track submissions, and keep documents organized per case.",
    tag: "Applications",
  },
  {
    icon: BookOpen,
    title: "Legislation Hub",
    description: "Search IRPA, IRPR, and federal regulations with AI-powered cross-reference linking.",
    tag: "Legal AI",
  },
  {
    icon: ScanLine,
    title: "OCR Document Scan",
    description: "Upload passports and IDs — our OCR service extracts data to speed up form filling.",
    tag: "Automation",
  },
  {
    icon: MessageSquare,
    title: "Secure Client Messaging",
    description: "Communicate with clients inside the platform with full case context and history.",
    tag: "Communication",
  },
  {
    icon: FileCheck,
    title: "Retainer Agreements",
    description: "Generate, send, and store signed retainer PDFs — professional and compliant.",
    tag: "Compliance",
  },
  {
    icon: Calculator,
    title: "CRS & Eligibility Tools",
    description: "Run Express Entry CRS calculations and help clients understand their pathway options.",
    tag: "Tools",
  },
  {
    icon: CreditCard,
    title: "Payments & Subscriptions",
    description: "Collect fees securely with integrated billing — set packages and get paid on time.",
    tag: "Revenue",
  },
  {
    icon: Shield,
    title: "RCIC Verification",
    description: "Instant CICC registry lookup to verify your license and build client trust.",
    tag: "Trust",
  },
];

const benefits = [
  "Get matched with immigration applicants actively looking for consultants",
  "Stop juggling spreadsheets, email threads, and scattered documents",
  "Never miss a deadline with smart alerts and case timelines",
  "Look professional from day one with branded client experiences",
  "Scale your practice without hiring a full back-office team",
];

const steps = [
  {
    step: "01",
    title: "Create your account",
    description: "Sign up with your RCIC credentials in minutes — email or Google.",
  },
  {
    step: "02",
    title: "Verify your license",
    description: "We validate your CICC registration against the public RCIC register.",
  },
  {
    step: "03",
    title: "Set up your portal",
    description: "Configure services, rates, and your consultant profile.",
  },
  {
    step: "04",
    title: "Start winning clients",
    description: "Receive leads, manage cases, and grow your immigration practice.",
  },
];

export default function ConsultantHomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.18),transparent)]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent,rgba(var(--background),1))]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <Badge className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Built for RCICs across Canada
              </Badge>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                The modern platform your{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  immigration practice
                </span>{" "}
                deserves
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                WayToCanada gives Regulated Canadian Immigration Consultants everything to attract
                clients, manage cases, stay compliant, and grow — in one beautiful workspace.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button
                  size="lg"
                  className="bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
                  asChild>
                  <Link href="/register">
                    Start free — Register now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Already a member? Sign in</Link>
                </Button>
              </div>
              <ul className="mt-10 grid gap-3 sm:grid-cols-2">
                {benefits.slice(0, 4).map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <DashboardMockup />
          </div>
        </section>

        {/* Trust bar */}
        <section className="border-y border-border/80 bg-muted/30">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
            {[
              { value: "15,000+", label: "RCICs in register" },
              { value: "9+", label: "Integrated tools" },
              { value: "1", label: "Unified dashboard" },
              { value: "48h", label: "Avg. onboarding" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-extrabold text-emerald-700 sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why register */}
        <section id="why-join" className="py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="outline" className="mb-4">
                Why consultants choose us
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Stop losing clients to outdated workflows
              </h2>
              <p className="mt-4 text-muted-foreground">
                Applicants expect speed, transparency, and professionalism. WayToCanada helps you
                deliver all three — and makes registering the easiest decision you make this year.
              </p>
            </div>
            <div className="mt-14 grid gap-4 lg:grid-cols-2">
              {benefits.map((b, i) => (
                <div
                  key={b}
                  className="flex gap-4 rounded-2xl border border-border/80 bg-card p-5 transition-shadow hover:shadow-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{b}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {i === 0 && "Our marketplace connects verified RCICs with real immigration leads."}
                      {i === 1 && "Cases, documents, messages, and deadlines — centralized and searchable."}
                      {i === 2 && "Automated reminders for submissions, expiries, and client follow-ups."}
                      {i === 3 && "Branded portal experience that builds confidence from the first visit."}
                      {i === 4 && "Enterprise-grade tools without enterprise complexity or cost."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Platform features bento */}
        <section id="features" className="bg-muted/30 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <Badge variant="outline" className="mb-4">
                  <Brain className="mr-1 h-3 w-3" />
                  Full platform
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Every tool your practice needs — already built in
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Register once and unlock the complete WayToCanada consultant ecosystem. No plugins,
                  no patchwork software stack.
                </p>
              </div>
              <Button className="shrink-0 bg-emerald-600 hover:bg-emerald-700" asChild>
                <Link href="/register">
                  Unlock all features <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {platformFeatures.map((item) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.title}
                    className="group border-border/80 bg-card/80 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5">
                    <CardContent className="p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 transition-colors group-hover:from-emerald-500/30">
                          <Icon className="h-5 w-5 text-emerald-700" />
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wide">
                          {item.tag}
                        </Badge>
                      </div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-4">Simple onboarding</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Live in four steps</h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                From registration to your first client — we keep it fast, verified, and stress-free.
              </p>
            </div>
            <div className="relative mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="absolute left-0 right-0 top-8 hidden h-0.5 bg-gradient-to-r from-transparent via-emerald-300 to-transparent lg:block" />
              {steps.map((item) => (
                <div key={item.step} className="relative text-center">
                  <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-lg font-bold text-white shadow-lg shadow-emerald-600/30">
                    {item.step}
                  </div>
                  <h3 className="mt-5 font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison / motivation */}
        <section className="border-y border-border/80 bg-muted/20 py-16">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <Bell className="mx-auto h-10 w-10 text-emerald-600" />
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
              Your competitors are going digital. Will you lead or get left behind?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Immigration applicants compare consultants online before they ever book a call. A modern
              portal signals credibility, efficiency, and care — exactly what wins trust.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section id="contact" className="relative overflow-hidden py-20 lg:py-28">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700" />
          <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(circle_at_30%_20%,white_0%,transparent_50%)]" />
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Ready to transform your consultant practice?
            </h2>
            <p className="mt-4 text-lg text-emerald-50/90">
              Join WayToCanada today. Free to register — start managing clients with the platform
              built for modern RCICs.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Button size="lg" variant="secondary" className="min-w-[200px] font-semibold" asChild>
                <Link href="/register">
                  Register as Consultant
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-w-[160px] border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-8 text-sm text-emerald-100/80">
              RCIC verification required · Secure &amp; PIPEDA-aware · Canadian-hosted infrastructure
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
