import type { ReactNode } from "react";

export default function LearningLayout({ children }: { children: ReactNode }) {
  return <div className="w-full min-w-0 flex-1">{children}</div>;
}
