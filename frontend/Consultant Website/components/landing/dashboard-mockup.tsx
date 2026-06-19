import {
  Bell,
  Briefcase,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Users,
} from "lucide-react";

export function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="landing-shimmer-border absolute -inset-[1px] rounded-[1.6rem] opacity-50" />
      <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-card landing-card-glow">
        <div className="flex items-center gap-2 border-b border-border/60 bg-gradient-to-r from-muted/90 to-muted/50 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
          </div>
          <span className="ml-2 rounded-md bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
            portal.rcicmaster.com
          </span>
        </div>

        <div className="flex min-h-[340px] bg-gradient-to-br from-background via-background to-red-50/30">
          <aside className="hidden w-14 shrink-0 border-r border-border/60 bg-muted/20 p-2 sm:block">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-[#c8102e] text-white shadow-md">
              <Briefcase className="h-4 w-4" />
            </div>
            {[LayoutDashboard, Users, FileText, MessageSquare, Bell].map((Icon, i) => (
              <div
                key={i}
                className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  i === 0 ? "bg-red-600/15 text-[#a00d24]" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </aside>

          <div className="flex-1 p-4 sm:p-5">
            <p className="text-xs font-medium text-muted-foreground">Good morning, RCIC</p>
            <h3 className="mt-1 text-xl font-bold tracking-tight">Your practice at a glance</h3>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {[
                { label: "Active clients", value: "24", color: "text-[#c8102e]", bg: "bg-red-500/5" },
                { label: "Due this week", value: "6", color: "text-amber-600", bg: "bg-amber-500/5" },
                { label: "In review", value: "11", color: "text-neutral-700", bg: "bg-neutral-500/5" },
                { label: "New leads", value: "3", color: "text-neutral-900", bg: "bg-neutral-500/5" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border border-border/60 ${s.bg} p-3`}>
                  <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {["Express Entry — Document review", "Study permit — Client message", "PR application — Deadline Fri"].map(
                (item, i) => (
                  <div
                    key={item}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                      i === 0 ? "border-red-500/30 bg-red-500/10" : "border-border/70 bg-background/80"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i === 0 ? "bg-[#c8102e]" : "bg-muted-foreground/40"}`} />
                    <span className="truncate font-medium">{item}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="landing-float-delayed absolute -bottom-4 -left-4 hidden rounded-2xl border border-red-200 bg-white/90 px-4 py-3 shadow-xl backdrop-blur sm:block">
        <p className="text-xs text-muted-foreground">New client invite</p>
        <p className="text-sm font-semibold text-[#a00d24]">Accepted ✓</p>
      </div>
    </div>
  );
}
