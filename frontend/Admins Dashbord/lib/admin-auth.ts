/**
 * Reads the admin bearer token from localStorage (primary) with cookie fallback.
 *
 * The proxy middleware uses the cookie to gate access to protected routes,
 * while API calls use the localStorage token.  When localStorage is cleared
 * (browser restart, privacy mode, etc.) but the cookie is still present,
 * falling back to the cookie ensures API calls remain authenticated.
 */
export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  // Primary: localStorage
  const ls = localStorage.getItem("wtc_admin_token");
  if (ls) return ls;
  // Fallback: cookie
  const match = document.cookie.match(/(?:^|;\s*)wtc_admin_token=([^;]+)/);
  const cookieToken = match?.[1] ?? "";
  // If we recovered from the cookie, sync it back to localStorage so
  // subsequent reads are consistent.
  if (cookieToken) {
    try { localStorage.setItem("wtc_admin_token", cookieToken); } catch {}
  }
  return cookieToken;
}

/** Returns headers for authenticated admin API calls. */
export function adminAuthHeaders(contentType?: string): Record<string, string> {
  const token = getAdminToken();
  return {
    ...(contentType ? { "Content-Type": contentType } : {}),
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}
