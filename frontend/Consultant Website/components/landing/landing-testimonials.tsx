const testimonials = [
  {
    name: "Priya Sharma",
    role: "RCIC · Toronto, ON",
    quote: "RCICMASTER replaced three different tools I was juggling. My clients love the portal and I finally have time to focus on cases instead of admin.",
    initials: "PS",
  },
  {
    name: "James Okonkwo",
    role: "RCIC · Calgary, AB",
    quote: "The trust ledger and retainer tracking alone were worth switching. Compliance audits are no longer a nightmare.",
    initials: "JO",
  },
  {
    name: "Marie-Claire Dubois",
    role: "RCIC · Montréal, QC",
    quote: "Bilingual support, clean interface, and the mobile app keeps me connected when I'm meeting clients outside the office.",
    initials: "MD",
  },
];

export function LandingTestimonials() {
  return (
    <section id="testimonials" className="rcx-section bg-[#f5f5f5] py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-black sm:text-4xl">Trusted by consultants</h2>
          <p className="mt-4 text-neutral-600">See what RCICs across Canada are saying.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="rcx-card rounded-2xl p-6">
              <p className="text-sm leading-relaxed text-neutral-600">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3 border-t border-black/5 pt-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#c8102e] text-sm font-bold text-white">
                  {t.initials}
                </div>
                <div>
                  <p className="font-semibold text-black">{t.name}</p>
                  <p className="text-xs text-neutral-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
