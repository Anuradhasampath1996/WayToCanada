import { Lock, ShieldCheck, Headphones } from "lucide-react";

const items = [
  {
    icon: Lock,
    title: "Data Encryption",
    body: "Industry-standard encryption for data in transit and at rest on Canadian infrastructure.",
  },
  {
    icon: ShieldCheck,
    title: "Regular Audits",
    body: "Security practices aligned with PIPEDA and RCIC compliance expectations.",
  },
  {
    icon: Headphones,
    title: "Dedicated Support",
    body: "Help when you need it — onboarding, billing, and platform guidance for consultants.",
  },
];

export function LandingSecurity() {
  return (
    <section id="about" className="rcx-section border-y border-black/5 bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-black sm:text-3xl">Security & trust</h2>
          <p className="mt-3 text-neutral-600">Your clients&apos; data and your practice reputation are protected.</p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-bold text-black">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-600">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
