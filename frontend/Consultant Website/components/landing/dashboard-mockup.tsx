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
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-emerald-500/10">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="ml-2 text-xs text-muted-foreground">portal.rcicmaster.com</span>
        </div>

        <div className="flex min-h-[320px]">
          <aside className="hidden w-14 shrink-0 border-r border-border bg-muted/30 p-2 sm:block">
            <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Briefcase className="h-4 w-4" />
            </div>
            {[LayoutDashboard, Users, FileText, MessageSquare, Bell].map((Icon, i) => (
              <div
                key={i}
                className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${
                  i === 0 ? "bg-emerald-600/15 text-emerald-700" : "text-muted-foreground"
                }`}>
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </aside>

          <div className="flex-1 p-4 sm:p-5">
            <p className="text-xs font-medium text-muted-foreground">Good morning, RCIC</p>
            <h3 className="mt-1 text-lg font-bold">Your practice at a glance</h3>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: "Active clients", value: "24", color: "text-emerald-600" },
                { label: "Due this week", value: "6", color: "text-amber-600" },
                { label: "Cases in review", value: "11", color: "text-sky-600" },
                { label: "New leads", value: "3", color: "text-violet-600" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border/80 bg-background p-3">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {["Express Entry — Document review", "Study permit — Client message", "PR application — Deadline Fri"].map(
                (item, i) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        i === 0 ? "bg-emerald-500" : i === 1 ? "bg-sky-500" : "bg-amber-500"
                      }`}
                    />
                    <span className="truncate text-foreground/90">{item}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
