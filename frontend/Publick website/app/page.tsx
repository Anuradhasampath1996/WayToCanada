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
  FileText,
  Compass,
  Shield,
  Clock,
  Star,
  GraduationCap,
  Briefcase,
  Home,
  Heart
} from "lucide-react";

const services = [
  {
    icon: Compass,
    title: "Express Entry",
    description:
      "Fast-track your permanent residency application through Canada's points-based immigration system."
  },
  {
    icon: GraduationCap,
    title: "Study Permit",
    description:
      "Pursue world-class education at top Canadian universities and colleges with our expert guidance."
  },
  {
    icon: Briefcase,
    title: "Work Permit",
    description:
      "Obtain the right work authorization to build your career in Canada's thriving job market."
  },
  {
    icon: Home,
    title: "Provincial Nominee",
    description:
      "Leverage provincial programs tailored to your skills and job offer to achieve permanent residency."
  },
  {
    icon: Heart,
    title: "Family Sponsorship",
    description:
      "Reunite with your loved ones in Canada through the family sponsorship immigration pathway."
  },
  {
    icon: Shield,
    title: "Citizenship",
    description:
      "Complete your Canadian journey by applying for citizenship and securing your future in Canada."
  }
];

const stats = [
  { value: "10,000+", label: "Successful Applications" },
  { value: "98%", label: "Approval Rate" },
  { value: "50+", label: "Expert Consultants" },
  { value: "15+", label: "Years of Experience" }
];

const steps = [
  {
    step: "01",
    title: "Create Your Account",
    description: "Sign up and complete your profile with your immigration background and goals."
  },
  {
    step: "02",
    title: "Get a Free Assessment",
    description: "Our experts review your profile and recommend the best immigration pathway for you."
  },
  {
    step: "03",
    title: "Submit Your Application",
    description: "We prepare and submit a strong, complete application on your behalf."
  },
  {
    step: "04",
    title: "Welcome to Canada",
    description: "Receive your approval and start your new life in Canada with our settlement support."
  }
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* ── Hero Section ── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background py-24 md:py-36">
          <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.3)_0%,transparent_50%)]" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium">
                🍁 Trusted Immigration Experts
              </Badge>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl leading-tight">
                Your Journey to{" "}
                <span className="text-primary">Canada</span>{" "}
                Starts Here
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
                WayToCanada is your all-in-one immigration platform — connecting you with certified
                consultants, streamlining your application, and guiding you every step of the way to
                your Canadian dream.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Start Your Journey <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/#services">Explore Services</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["Free Initial Assessment", "Certified RCIC Consultants", "End-to-End Support"].map(
                  (item) => (
                    <span key={item} className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      {item}
                    </span>
                  )
                )}
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

        {/* ── Services ── */}
        <section id="services" className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4">Our Services</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything You Need to Move to Canada
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                From the first assessment to landing in Canada, we cover every aspect of your
                immigration journey.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => {
                const Icon = service.icon;
                return (
                  <Card
                    key={service.title}
                    className="group hover:shadow-md hover:border-primary/40 transition-all duration-200"
                  >
                    <CardContent className="p-6 space-y-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-base">{service.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {service.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How it Works ── */}
        <section className="py-20 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4">How It Works</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Simple Steps to Your Canadian Dream
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

        {/* ── About ── */}
        <section id="about" className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div className="space-y-6">
                <Badge variant="outline">About WayToCanada</Badge>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  We Make Canadian Immigration Accessible
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  WayToCanada is a technology-driven immigration platform that connects applicants
                  with Regulated Canadian Immigration Consultants (RCICs). Our platform simplifies
                  complex immigration processes, making Canada reachable for people around the world.
                </p>
                <ul className="space-y-3 text-sm">
                  {[
                    "Certified RCIC consultants with years of experience",
                    "Transparent, real-time application tracking",
                    "Personalized immigration roadmap for every client",
                    "Multi-language support for global applicants"
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild>
                  <Link href="/register">
                    Get Your Free Assessment <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Users, title: "Expert Consultants", desc: "Certified RCICs ready to help" },
                  { icon: FileText, title: "Document Support", desc: "Full application prep assistance" },
                  { icon: Clock, title: "Fast Processing", desc: "Expedited review timelines" },
                  { icon: Star, title: "5-Star Rated", desc: "Trusted by thousands globally" }
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <Card key={card.title} className="p-4">
                      <CardContent className="p-0 space-y-2">
                        <Icon className="h-6 w-6 text-primary" />
                        <p className="font-semibold text-sm">{card.title}</p>
                        <p className="text-xs text-muted-foreground">{card.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section id="contact" className="py-20 bg-primary text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              Ready to Start Your Canadian Journey?
            </h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto">
              Join thousands of people who have successfully moved to Canada with our help. Create
              your free account today.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/register">
                  Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
