import Link from "next/link";
import { MapPin, Mail, Phone, Facebook, Twitter, Linkedin, Instagram } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="bg-muted/40 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
              <MapPin className="h-5 w-5" />
              <span>WayToCanada</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your trusted partner for navigating the Canadian immigration journey — from visa applications to permanent residency.
            </p>
            <div className="flex gap-3">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Facebook className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Twitter className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Linkedin className="h-5 w-5" /></a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Instagram className="h-5 w-5" /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm tracking-wider uppercase text-foreground">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                { label: "Home", href: "/" },
                { label: "Services", href: "/#services" },
                { label: "About Us", href: "/#about" },
                { label: "Contact", href: "/#contact" }
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-primary transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Immigration Services */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm tracking-wider uppercase text-foreground">Services</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Express Entry",
                "Provincial Nominee Program",
                "Study Permit",
                "Work Permit",
                "Family Sponsorship",
                "Citizenship Application"
              ].map((service) => (
                <li key={service}>
                  <span className="hover:text-primary transition-colors cursor-pointer">{service}</span>
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
                <span>support@rcicmaster.com</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>+1 (800) 555-0199</span>
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
          <p>© {new Date().getFullYear()} WayToCanada. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
