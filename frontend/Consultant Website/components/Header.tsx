"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Platform", href: "/#features" },
    { label: "Mobile App", href: "/#mobile-app" },
    { label: "Pricing", href: "/#pricing" },
    { label: "How It Works", href: "/#how-it-works" },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-emerald-500/10 bg-white/80 shadow-sm shadow-emerald-500/5 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-[4.25rem]">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25 transition-transform group-hover:scale-105">
              <Briefcase className="h-4 w-4" />
            </span>
            <span className="text-lg font-bold tracking-tight">
              WayToCanada
              <span className="ml-1.5 text-sm font-semibold text-emerald-700">Consultants</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-emerald-500/5 hover:text-emerald-800"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" className="rounded-xl" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button className="rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/20 hover:bg-emerald-700" asChild>
              <Link href="/register">Register free</Link>
            </Button>
          </div>

          <button
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border/80 bg-white/95 px-4 pb-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1 pt-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-emerald-500/5 hover:text-emerald-800"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <Button variant="outline" className="flex-1 rounded-xl" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700" asChild>
                <Link href="/register">Register</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
