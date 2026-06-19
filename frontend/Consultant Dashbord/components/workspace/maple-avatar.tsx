import { cn } from "@/lib/utils";
import { MAPLE_ASSISTANT } from "@/lib/workspace-ai-character";

export function MapleAvatar({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-9 w-9 text-lg",
    md: "h-12 w-12 text-xl",
    lg: "h-16 w-16 text-3xl",
  };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-600/25 ring-2 ring-white/80",
        sizes[size],
        className,
      )}
      aria-hidden
    >
      <span className="drop-shadow-sm">{MAPLE_ASSISTANT.emoji}</span>
    </div>
  );
}

export function MapleIntroCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <MapleAvatar size={compact ? "sm" : "md"} />
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
