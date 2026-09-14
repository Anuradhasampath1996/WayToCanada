"use client";

import { useEffect, useState } from "react";
import { academyGet } from "@/lib/academy";

export default function AcademySourcesPage() {
  const [data, setData] = useState<{ disclaimer: string; data: { id: number; title: string; source_url?: string; summary?: string }[] } | null>(null);
  useEffect(() => {
    academyGet("/sources").then(setData).catch(() => null);
  }, []);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Academy Legislation Hub</h2>
      <p className="text-sm text-muted-foreground">{data?.disclaimer}</p>
      {data?.data.map((s) => (
        <div key={s.id} className="rounded-lg border p-4">
          <div className="font-medium">{s.title}</div>
          <p className="text-sm">{s.summary}</p>
          {s.source_url && (
            <a className="text-sm underline" href={s.source_url} target="_blank" rel="noreferrer">
              Official source
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
