export type SubscriptionPackage = {
  id: number;
  name: string;
  name_fr: string | null;
  description: string | null;
  description_fr: string | null;
  monthly_price: number | null;
  yearly_price: number | null;
  free_trial_days: number | null;
  features: string[] | null;
  features_fr: string[] | null;
  sort_order: number;
};

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export async function fetchSubscriptionPackages(): Promise<SubscriptionPackage[]> {
  const res = await fetch(`${API}/subscription-packages`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}
