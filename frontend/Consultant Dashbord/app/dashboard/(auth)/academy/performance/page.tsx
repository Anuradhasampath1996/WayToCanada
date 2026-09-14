"use client";

import { useEffect, useState } from "react";
import { academyGet } from "@/lib/academy";

export default function AcademyPerformancePage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    academyGet("/analytics").then(setData).catch(() => null);
  }, []);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Performance</h2>
      <p className="text-sm text-muted-foreground">Your attempts only. Exam Readiness is not an official pass prediction.</p>
      <pre className="overflow-auto rounded border p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
