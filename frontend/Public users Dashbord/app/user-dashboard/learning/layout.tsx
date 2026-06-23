import type { ReactNode } from "react";
import { ClientLearningGate } from "@/components/client-learning-gate";

export default function LearningLayout({ children }: { children: ReactNode }) {
  return (
    <ClientLearningGate>
      <div className="w-full min-w-0 flex-1">{children}</div>
    </ClientLearningGate>
  );
}
