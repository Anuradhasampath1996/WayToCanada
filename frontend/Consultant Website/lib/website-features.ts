export type WebsiteFeatureSection = {
  id: number;
  slug: string;
  tag: string | null;
  title: string;
  subtitle: string | null;
  description: string;
  bullet_points: string[] | null;
  icon: string;
  media_type: "mock" | "image" | "gif" | "video";
  media_url: string | null;
  mock_variant: string | null;
  media_alt: string | null;
  layout: "left" | "right";
  sort_order: number;
};

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export async function fetchWebsiteFeatures(): Promise<WebsiteFeatureSection[]> {
  const res = await fetch(`${API}/consultant-website/features`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}
