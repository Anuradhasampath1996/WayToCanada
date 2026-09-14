"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACADEMY_NAV } from "@/lib/academy";
import { LocaleToggle } from "@/components/locale-toggle";
import { cn } from "@/lib/utils";

export function AcademyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">RCIC Academy</h1>
          <p className="text-sm text-muted-foreground">
            Independent professional learning and exam preparation. Scores are readiness indicators, not official CICC
            pass predictions. Legal summaries are study aids — verify the official source.
          </p>
        </div>
        <LocaleToggle />
      </div>
      <nav className="flex flex-wrap gap-2">
        {ACADEMY_NAV.map((item) => {
          const active = item.href === "/dashboard/academy" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                active ? "bg-primary text-primary-foreground" : "bg-background"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
