import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  CheckCircle,
  Users,
  TrendingUp,
  LayoutDashboard,
  FileText,
  Bell,
  Shield,
  Clock,
  Star,
  Banknote,
  Globe,
  MessageSquare,
  BookOpen
} from "lucide-react";

const whyJoin = [
  {
    icon: Users,
    title: "Ready-Made Client Pool",
    description:
      "Get matched with pre-qualified immigration applicants actively seeking consultants. No cold outreach needed."
  },
  {
    icon: TrendingUp,
    title: "Grow Your Practice",
    description:
      "Our platform handles marketing, client acquisition, and scheduling — so you focus on what you do best."
  },
  {
    icon: Banknote,
    title: "Competitive Earnings",
    description:
      "Set your own rates, receive secure payments, and get paid on time with our built-in payment system."
  },
  {
    icon: Globe,
    title: "Work From Anywhere",
    description:
      "Manage your entire consultant practice remotely with our cloud-based tools and client portal."
  },
  {
    icon: BookOpen,
    title: "Legal Resource Library",
    description:
      "Access up-to-date IRCC regulations, IRPA/IRPR references, and AI-powered legal research tools."
  },
  {
    icon: Shield,
    title: "Compliance Support",
    description:
      "Stay compliant with CICC regulations. We provide audit trails, documentation templates, and compliance alerts."
  }
];

const features = [
  {
    icon: LayoutDashboard,
    title: "Consultant Dashboard",
    description: "Unified view of all your clients, applications, deadlines, and earnings in one place."
  },
  {
    icon: FileText,
    title: "Application Management",
    description: "Track every application stage, upload documents, and collaborate with clients seamlessly."
  },
  {
    icon: MessageSquare,
    title: "Integrated Messaging",
    description: "Communicate with clients directly through our secure, encrypted messaging system."
  },
  {
    icon: Bell,
    title: "Smart Deadline Alerts",
    description: "Never miss a deadline with automated reminders for visa expirations, document submissions, and more."
  },
  {
    icon: Clock,
    title: "Time Tracking & Billing",
    description: "Log billable hours, generate invoices, and manage payments all within the platform."
  },
  {
    icon: Star,
    title: "Reputation & Reviews",
    description: "Build your professional reputation through verified client reviews and success metrics."
  }
];

const steps = [
  {
    step: "01",
    title: "Apply to Join",
    description: "Submit your RCIC credentials and professional profile for verification."
  },
  {
    step: "02",
    title: "Get Verified",
    description: "Our team reviews your credentials and activates your consultant account within 48 hours."
  },
  {
    step: "03",
    title: "Set Up Your Profile",
    description: "Customize your profile, set your services, rates, and availability."
  },
  {
    step: "04",
    title: "Start Getting Clients",
    description: "Get matched with applicants and start growing your immigration practice."
  }
];

const stats = [
  { value: "2,500+", label: "Active Consultants" },
  { value: "10,000+", label: "Clients Matched" },
  { value: "4.9★", label: "Average Rating" },
  { value: "48h", label: "Avg. Verification Time" }
];

const testimonials = [
  {
    name: "Rajiv Mehta, RCIC",
    location: "Toronto, ON",
    quote:
      "Since joining WayToCanada, my client base doubled in just 3 months. The platform handles everything — I just focus on the immigration work."
  },
  {
    name: "Sophie Tremblay, RCIC",
    location: "Montreal, QC",
    quote:
      "The legal resource library and AI research tools save me hours every week. It's like having a research assistant built in."
  },
  {
    name: "Amara Osei, RCIC",
    location: "Vancouver, BC",
    quote:
      "The deadline alert system is a game-changer. I never have to worry about missing critical dates for my clients."
  }
];

export default function ConsultantHomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background py-24 md:py-36">
          <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(circle_at_70%_20%,hsl(var(--primary)/0.3)_0%,transparent_50%)]" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium">
                🏛️ For Regulated Immigration Consultants
              </Badge>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl leading-tight">
                Grow Your Immigration Practice with{" "}
                <span className="text-primary">WayToCanada</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
                The all-in-one platform built exclusively for Regulated Canadian Immigration Consultants.
                Get matched with clients, manage applications, and scale your practice — all in one place.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Join as a Consultant <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/#features">See Platform Features</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["RCIC Verified Consultants Only", "Free to Join", "No Hidden Fees"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl font-extrabold text-primary">{stat.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Join ── */}
        <section id="why-join" className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4">Why Join WayToCanada</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything You Need to Run a Successful Practice
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                We handle the business side so you can focus on delivering exceptional immigration services.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {whyJoin.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="group hover:shadow-md hover:border-primary/40 transition-all duration-200">
                    <CardContent className="p-6 space-y-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-base">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Platform Features ── */}
        <section id="features" className="py-20 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4">Platform Features</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Built for the Modern Immigration Consultant
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="group hover:shadow-md hover:border-primary/40 transition-all duration-200">
                    <CardContent className="p-6 space-y-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-base">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4">How It Works</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Get Started in 4 Simple Steps
              </h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((item) => (
                <div key={item.step} className="relative text-center space-y-3">
                  <div className="mx-auto w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-extrabold">
                    {item.step}
                  </div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="py-20 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4">Consultant Stories</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Trusted by RCICs Across Canada
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <Card key={t.name} className="hover:shadow-md transition-all duration-200">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed italic">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.location}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section id="contact" className="py-20 bg-primary text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              Ready to Grow Your Consultant Practice?
            </h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto">
              Join 2,500+ verified RCICs already using WayToCanada to manage clients, track applications, and grow their business.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/register">
                  Apply to Join Free <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <Link href="/login">Consultant Login</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
