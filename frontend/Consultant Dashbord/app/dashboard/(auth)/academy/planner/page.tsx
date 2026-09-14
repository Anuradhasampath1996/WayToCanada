"use client";

import { useEffect, useState } from "react";
import { academyGet, academySend } from "@/lib/academy";

export default function AcademyPlannerPage() {
  const [plan, setPlan] = useState<unknown>(null);
  useEffect(() => {
    academyGet<unknown>("/planner").then(setPlan).catch(() => null);
  }, []);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Study Planner</h2>
      <button
        className="rounded border px-3 py-2 text-sm"
        onClick={() => academySend<unknown>("/planner", "PUT", { weekly_hours: 8 }).then(setPlan)}
      >
        Generate / refresh plan
      </button>
      <pre className="overflow-auto rounded border p-3 text-xs">{JSON.stringify(plan, null, 2)}</pre>
    </div>
  );
}
