const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const TOKEN_KEY = "wtc_consultant_token";
const COOKIE_NAME = "wtc_consultant_token";

export function academyHeaders(): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1]
      : undefined) ?? (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null) ?? "";
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function academyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/consultant/academy${path}`, { headers: academyHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function academySend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/consultant/academy${path}`, {
    method,
    headers: academyHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const ACADEMY_NAV = [
  { href: "/dashboard/academy", label: "Dashboard" },
  { href: "/dashboard/academy/courses", label: "RCIC Academy" },
  { href: "/dashboard/academy/learning", label: "My Learning" },
  { href: "/dashboard/academy/exam-prep", label: "Exam Preparation" },
  { href: "/dashboard/academy/practice", label: "Practice" },
  { href: "/dashboard/academy/exams", label: "Mock Exams" },
  { href: "/dashboard/academy/planner", label: "Study Planner" },
  { href: "/dashboard/academy/sources", label: "Legislation Hub" },
  { href: "/dashboard/academy/notes", label: "My Notes" },
  { href: "/dashboard/academy/performance", label: "Performance" },
];
