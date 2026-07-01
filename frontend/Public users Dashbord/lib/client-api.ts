const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function clientToken(): string {
  return (
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_token=([^;]+)/)?.[1]
      : undefined) ?? (typeof localStorage !== "undefined" ? localStorage.getItem("wtc_token") : null) ?? ""
  );
}

export function clientAuthHeaders(json = true): Record<string, string> {
  const token = clientToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {}),
    Accept: "application/json",
  };
}

/** Multipart file uploads — do not set Content-Type; the browser adds the boundary. */
export function clientUploadHeaders(): Record<string, string> {
  return clientAuthHeaders(false);
}

/** Authenticated PDF/image stream requests. */
export function clientStreamHeaders(): Record<string, string> {
  const token = clientToken();
  return {
    ...(token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {}),
    Accept: "application/pdf, application/octet-stream, image/*, */*",
  };
}

export { API as CLIENT_API };
