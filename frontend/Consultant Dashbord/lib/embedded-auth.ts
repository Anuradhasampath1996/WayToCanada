import { CONSULTANT_LOGIN_URL } from "@/lib/auth-urls";

/** True when the dashboard runs inside the mobile app iframe (or another parent). */
export function isEmbeddedDashboard(): boolean {
  return typeof window !== "undefined" && window.self !== window.top;
}

/** Redirect to consultant login unless we are embedded (avoids iframe refresh loops). */
export function redirectToConsultantLogin(): void {
  if (isEmbeddedDashboard()) return;
  window.location.replace(CONSULTANT_LOGIN_URL);
}
