"use client";

import { useEffect, useState } from "react";
import { academyGet } from "@/lib/academy";

export default function AcademyNotesPage() {
  const [data, setData] = useState<{ data: { id: number; body: string }[] } | null>(null);
  useEffect(() => {
    academyGet<{ data: { id: number; body: string }[] }>("/notes").then(setData).catch(() => setData({ data: [] }));
  }, []);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">My Notes</h2>
      <ul className="space-y-2 text-sm">
        {data?.data.map((n) => (
          <li key={n.id} className="rounded border p-3">
            {n.body}
          </li>
        ))}
      </ul>
    </div>
  );
}
