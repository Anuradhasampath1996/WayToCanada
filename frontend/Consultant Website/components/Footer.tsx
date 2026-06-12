import Link from "next/link";
import { Briefcase, Mail, Phone, MapPin, Facebook, Twitter, Linkedin } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="bg-muted/40 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
              <Briefcase className="h-5 w-5" />
              <span>WayToCanada</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Empowering Regulated Canadian Immigration Consultants (RCICs) with tools, clients, and technology to grow their practice.
            </p>
            <div className="flex gap-3">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Facebook className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Twitter className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Linkedin className="h-5 w-5" /></a>
            </div>
          </div>

          {/* For Consultants */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm tracking-wider uppercase text-foreground">For Consultants</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                { label: "Why Join", href: "/#why-join" },
                { label: "Platform Features", href: "/#features" },
                { label: "How It Works", href: "/#how-it-works" },
                { label: "Pricing", href: "/#pricing" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-primary transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm tracking-wider uppercase text-foreground">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["IRCC Updates", "Immigration Law Library", "RCIC Compliance", "Client Management Guide", "Support Centre"].map((item) => (
                <li key={item}>
                  <span className="hover:text-primary transition-colors cursor-pointer">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm tracking-wider uppercase text-foreground">Contact</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>consultants@rcicmaster.com</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>+1 (800) 555-0200</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>Toronto, Ontario, Canada</span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} WayToCanada Consultant Portal. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
