"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Testimonials", href: "/#testimonials" },
    { label: "About", href: "/#about" },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full bg-white transition-shadow duration-300",
        scrolled ? "border-b border-black/5 shadow-sm" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-[4.5rem]">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c8102e] text-white shadow-sm">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="text-lg font-bold tracking-tight text-black">
              RCICMASTER
              <span className="ml-1 text-sm font-semibold text-neutral-500">Consultants</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:text-[#c8102e]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Button variant="ghost" className="text-neutral-700 hover:text-black" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button className="rounded-md bg-[#c8102e] px-5 font-semibold text-white hover:bg-[#a00d24]" asChild>
              <Link href="/register">Start free trial</Link>
            </Button>
          </div>

          <button
            className="rounded-md p-2 text-neutral-700 hover:bg-neutral-100 lg:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-black/5 bg-white px-4 pb-4 lg:hidden">
          <nav className="flex flex-col gap-1 pt-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-[#c8102e]"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-3">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button className="flex-1 bg-[#c8102e] hover:bg-[#a00d24]" asChild>
                <Link href="/register">Start free trial</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
