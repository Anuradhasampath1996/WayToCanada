import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_LOGIN_URL } from "@/lib/auth-urls";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("wtc_token")?.value;

  // Canonical client home is /user-dashboard (legacy /dashboard/default redirected below)
  if (pathname === "/" || pathname === "/dashboard" || pathname === "/dashboard/default") {
    if (token) {
      return NextResponse.redirect(new URL("/user-dashboard", request.url));
    }
    return NextResponse.redirect(PUBLIC_LOGIN_URL);
  }

  // Auth callback page is always accessible
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  // Client dashboard routes require the token cookie
  if (pathname.startsWith("/user-dashboard")) {
    if (!token) {
      return NextResponse.redirect(PUBLIC_LOGIN_URL);
    }
    return NextResponse.next();
  }

  // Legacy /dashboard/* — block Shadcn template demos in production
  if (pathname.startsWith("/dashboard/")) {
    if (!token) {
      return NextResponse.redirect(PUBLIC_LOGIN_URL);
    }
    const isProduction = process.env.NODE_ENV === "production";
    const allowLegacy = process.env.NEXT_PUBLIC_ALLOW_LEGACY_DASHBOARD === "true";
    if (isProduction && !allowLegacy) {
      return NextResponse.redirect(new URL("/user-dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard", "/dashboard/:path*", "/user-dashboard", "/user-dashboard/:path*", "/auth/callback"],
};
