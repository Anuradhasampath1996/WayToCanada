"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { academyGet } from "@/lib/academy";

export default function AcademyLearningPage() {
  const [data, setData] = useState<{ data: { id: number; title: string }[] } | null>(null);
  useEffect(() => {
    academyGet<{ data: { id: number; title: string }[] }>("/courses").then(setData).catch(() => setData({ data: [] }));
  }, []);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">My Learning</h2>
      <p className="text-sm text-muted-foreground">Published Academy courses you are entitled to take.</p>
      <ul className="space-y-2">
        {data?.data.map((c) => (
          <li key={c.id}>
            <Link className="underline" href="/dashboard/academy/courses">
              {c.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
