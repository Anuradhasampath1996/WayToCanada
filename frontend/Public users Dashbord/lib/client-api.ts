export const CLIENT_API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export function getClientToken(): string | null {
  if (typeof window === "undefined") return null;
  const cookie = document.cookie.match(/(?:^|;\s*)wtc_token=([^;]+)/);
  return localStorage.getItem("wtc_token") ?? (cookie ? decodeURIComponent(cookie[1]) : null);
}

export function clientAuthHeaders(json = false): Record<string, string> {
  const token = getClientToken();
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
