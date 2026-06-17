const stats = [
  { value: "13+", label: "Integrated modules", sub: "One dashboard" },
  { value: "3 GB", label: "Free file storage", sub: "Per consultant" },
  { value: "4-step", label: "Client journey", sub: "Guided workflow" },
  { value: "24/7", label: "Cloud access", sub: "Work anywhere" },
];

export function LandingStats() {
  return (
    <section className="relative border-y border-emerald-500/10 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-emerald-500/10 md:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="group bg-white px-6 py-10 text-center transition-colors hover:bg-emerald-50/50"
          >
            <p className="text-3xl font-extrabold tracking-tight text-emerald-700 sm:text-4xl">{s.value}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{s.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
