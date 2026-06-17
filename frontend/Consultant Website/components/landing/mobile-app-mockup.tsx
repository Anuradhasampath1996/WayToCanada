import { Bell, FileText, MessageSquare, Smartphone, Users } from "lucide-react";

export function MobileAppMockup() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[280px]">
      <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-emerald-500/25 via-teal-500/15 to-transparent blur-2xl" />
      <div className="relative rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-900 p-2 shadow-2xl">
        <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-800" />
        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-emerald-50 to-white">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 pb-4 pt-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] opacity-80">WayToCanada</p>
                <p className="text-sm font-bold">Consultant App</p>
              </div>
              <Bell className="h-4 w-4 opacity-90" />
            </div>
          </div>
          <div className="space-y-2 p-3">
            {[
              { icon: Users, label: "3 new client invites", color: "text-emerald-600" },
              { icon: FileText, label: "Retainer signed — Priya K.", color: "text-sky-600" },
              { icon: MessageSquare, label: "Unread message — Case #1042", color: "text-violet-600" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-white p-2.5 shadow-sm">
                <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                <p className="text-[11px] font-medium leading-tight text-foreground/90">{item.label}</p>
              </div>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["Clients", "Cases", "Meetings", "Payments"].map((tab, i) => (
                <div
                  key={tab}
                  className={`rounded-lg py-2 text-center text-[10px] font-semibold ${
                    i === 0 ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -right-6 bottom-12 hidden rounded-2xl border border-emerald-500/20 bg-white px-3 py-2 shadow-lg sm:flex sm:items-center sm:gap-2">
        <Smartphone className="h-4 w-4 text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-800">iOS & Android</span>
      </div>
    </div>
  );
}
