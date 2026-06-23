const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export function clientAuthHeaders(json = true): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_token=([^;]+)/)?.[1]
      : undefined) ?? (typeof localStorage !== "undefined" ? localStorage.getItem("wtc_token") : null) ?? "";
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {}),
    Accept: "application/json",
  };
}

export { API as CLIENT_API };
