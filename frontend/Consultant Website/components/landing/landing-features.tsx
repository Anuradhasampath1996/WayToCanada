import { FolderKanban, Cloud, Monitor, FileCheck } from "lucide-react";

const features = [
  {
    icon: FolderKanban,
    title: "Case Management",
    body: "Track every client from retainer to submission with a visual pipeline and workspace tools.",
  },
  {
    icon: Cloud,
    title: "Document Storage",
    body: "Secure cloud storage for case files, client uploads, and your personal consultant library.",
  },
  {
    icon: Monitor,
    title: "Client Portal",
    body: "Branded workspace per client — questionnaires, agreements, forms, and messaging in one place.",
  },
  {
    icon: FileCheck,
    title: "Compliance Hub",
    body: "Trust ledger, retainer milestones, and audit trails aligned with RCIC practice standards.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="rcx-section bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">
            Everything your practice needs
          </h2>
          <p className="mt-4 text-neutral-600">
            Powerful tools designed specifically for regulated Canadian immigration consultants.
          </p>
        </div>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="text-center">
                <div className="rcx-icon-box mx-auto">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-black">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{f.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
