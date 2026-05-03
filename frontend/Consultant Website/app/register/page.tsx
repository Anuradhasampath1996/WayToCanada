import Link from "next/link";
import { Briefcase, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Join as Consultant – WayToCanada"
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-primary-foreground">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Briefcase className="h-6 w-6" />
          <span>WayToCanada</span>
          <Badge variant="secondary" className="text-xs text-primary ml-1">Consultants</Badge>
        </Link>
        <div className="space-y-6">
          <h2 className="text-3xl font-extrabold leading-snug">
            Join Canada&apos;s Fastest-Growing Consultant Platform
          </h2>
          <p className="text-sm text-primary-foreground/80">
            Thousands of RCICs are already growing their practices on WayToCanada.
          </p>
          <ul className="space-y-3 text-sm text-primary-foreground/90">
            {[
              "Free to join — no monthly fees to start",
              "Access to a pool of pre-qualified applicants",
              "Built-in case management and document tools",
              "CICC-compliant audit trail and compliance tools",
              "Get paid securely through the platform"
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} WayToCanada Consultant Portal.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg space-y-8">
          <Link href="/" className="flex lg:hidden items-center gap-2 font-bold text-xl text-primary justify-center">
            <Briefcase className="h-6 w-6" />
            <span>WayToCanada</span>
          </Link>

          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Consultant Portal</p>
            <h1 className="text-3xl font-bold tracking-tight">Apply to Join</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your consultant account — RCIC verification required
            </p>
          </div>

          <form className="space-y-5" action="#" method="POST">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" name="first_name" type="text" autoComplete="given-name" required placeholder="Jane" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" name="last_name" type="text" autoComplete="family-name" required placeholder="Doe" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="jane.doe@example.com" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" required placeholder="+1 (416) 555-0100" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rcic_number">RCIC Registration Number</Label>
              <Input
                id="rcic_number"
                name="rcic_number"
                type="text"
                required
                placeholder="R123456"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Your CICC-issued registration number (e.g. R123456)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="years_experience">Years of Experience</Label>
                <Input
                  id="years_experience"
                  name="years_experience"
                  type="number"
                  min="0"
                  max="50"
                  required
                  placeholder="5"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="specialization">Primary Specialization</Label>
                <Input
                  id="specialization"
                  name="specialization"
                  type="text"
                  required
                  placeholder="Express Entry, PNP, Spouse Visa…"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required placeholder="••••••••" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required placeholder="••••••••" />
            </div>

            <Button type="submit" className="w-full" size="lg">
              Submit Application
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or sign up with</span>
            <Separator className="flex-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" type="button" className="w-full gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </Button>
            <Button variant="outline" type="button" className="w-full gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              GitHub
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Are you an applicant?{" "}
            <a href="http://localhost:3001/register" className="text-primary hover:underline">
              Register on the public portal
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
