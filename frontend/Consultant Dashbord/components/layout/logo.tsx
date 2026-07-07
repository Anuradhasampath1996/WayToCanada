import { cn } from "@/lib/utils";

const LOGO_SRC = "/rcicmaster-logo.png?v=2";

type LogoProps = {
  variant?: "default" | "sidebar";
  className?: string;
};

export default function Logo({ variant = "default", className }: LogoProps) {
  const isSidebar = variant === "sidebar";

  return (
    // Plain img avoids Next.js image optimizer caching stale logo.png
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="RCICMASTER"
      className={cn(
        isSidebar
          ? "h-10 w-auto max-w-[180px] object-contain transition-all duration-200 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:max-w-8 group-data-[collapsible=icon]:object-cover group-data-[collapsible=icon]:object-left"
          : "h-8 w-auto max-w-[144px] object-contain",
        className,
      )}
    />
  );
}
