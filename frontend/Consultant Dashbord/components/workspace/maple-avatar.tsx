import { cn } from "@/lib/utils";
import { MAPLE_ASSISTANT } from "@/lib/workspace-ai-character";

type MapleAvatarVariant = "soft" | "rail" | "plain";

export function MapleAvatar({
  size = "md",
  variant = "soft",
  className,
  highlight = false,
}: {
  size?: "sm" | "md" | "lg";
  /** soft = white frosted disc; rail = sidebar badge; plain = no plate */
  variant?: MapleAvatarVariant;
  className?: string;
  /** Soft float + glow so Maple stands out from other tools */
  highlight?: boolean;
}) {
  const sizes = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  const plates: Record<MapleAvatarVariant, string> = {
    soft: "bg-white shadow-md shadow-red-600/15 ring-2 ring-white/90",
    rail: "bg-white shadow-md shadow-black/10 ring-2 ring-white/95",
    plain: "bg-transparent shadow-none ring-0",
  };

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        sizes[size],
        plates[variant],
        highlight && "animate-maple-highlight",
        className,
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MAPLE_ASSISTANT.imageSrc}
        alt=""
        className={cn(
          "h-full w-full object-contain object-center",
          variant === "plain" ? "p-0" : "p-[8%]",
        )}
        draggable={false}
      />
    </div>
  );
}

export function MapleIntroCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <MapleAvatar size={compact ? "sm" : "md"} variant="soft" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold tracking-tight">
          {MAPLE_ASSISTANT.name}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            · {MAPLE_ASSISTANT.role}
          </span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {MAPLE_ASSISTANT.intro}
        </p>
        {!compact && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Always available · on-demand only
          </p>
        )}
      </div>
    </div>
  );
}
