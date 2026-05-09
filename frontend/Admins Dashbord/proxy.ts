import { NextResponse, type NextRequest } from "next/server";

const ADMIN_LOGIN_URL = "/dashboard/login/v1";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root and /dashboard to /dashboard/default
  if (pathname === "/" || pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/dashboard/default", request.url));
  }

  // Guest pages (login, register, forgot-password, error pages) are always accessible —
  // BUT if the user already has a valid cookie, redirect them to the dashboard instead.
  if (
    pathname.startsWith("/dashboard/login") ||
    pathname.startsWith("/dashboard/register") ||
    pathname.startsWith("/dashboard/forgot-password") ||
    pathname.startsWith("/dashboard/pages/error")
  ) {
    const token = request.cookies.get("wtc_admin_token")?.value;
    if (token && pathname.startsWith("/dashboard/login")) {
      return NextResponse.redirect(new URL("/dashboard/default", request.url));
    }
    return NextResponse.next();
  }

  // All other /dashboard/* routes require the admin token cookie
  if (pathname.startsWith("/dashboard/")) {
    const token = request.cookies.get("wtc_admin_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_URL, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard", "/dashboard/:path*"],
};
