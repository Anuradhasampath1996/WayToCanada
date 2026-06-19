"use client";

import Link from "next/link";
import { MapPin, Facebook, Twitter, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c8102e]">
                <MapPin className="h-4 w-4" />
              </span>
              RCICMASTER
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-neutral-400">
              Empowering Regulated Canadian Immigration Consultants with compliance tools,
              client management, and technology to grow a modern practice.
            </p>
            <div className="flex gap-3">
              <a href="#" className="text-neutral-500 transition-colors hover:text-white" aria-label="Facebook">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-neutral-500 transition-colors hover:text-white" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-neutral-500 transition-colors hover:text-white" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Company</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-neutral-400">
              {["About Us", "Careers", "Contact", "Blog"].map((item) => (
                <li key={item}><span className="cursor-pointer hover:text-white">{item}</span></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Product</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-neutral-400">
              {[
                { label: "Features", href: "/#features" },
                { label: "Pricing", href: "/#pricing" },
                { label: "Mobile App", href: "/#mobile-app" },
                { label: "Register", href: "/register" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-white">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Legal</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-neutral-400">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                <li key={item}><span className="cursor-pointer hover:text-white">{item}</span></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} RCICMASTER. All rights reserved.
          </p>
          <div className="flex w-full max-w-md gap-2 sm:w-auto">
            <Input
              type="email"
              placeholder="Your email"
              className="border-white/15 bg-white/5 text-white placeholder:text-neutral-500"
            />
            <Button className="shrink-0 bg-[#c8102e] hover:bg-[#a00d24]">Subscribe</Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
