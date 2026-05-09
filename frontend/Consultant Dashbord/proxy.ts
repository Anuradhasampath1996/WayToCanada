import { NextResponse, type NextRequest } from "next/server";

const CONSULTANT_LOGIN_URL = "http://localhost:3001/login";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root and /dashboard to /dashboard/default
  if (pathname === "/" || pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/dashboard/default", request.url));
  }

  // Auth callback page is always accessible
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  // License verified page is always accessible
  if (pathname.startsWith("/license-verified")) {
    return NextResponse.next();
  }

  // All /consultantdashboard/* and /dashboard/* routes require the token cookie
  if (pathname.startsWith("/consultantdashboard") || pathname.startsWith("/dashboard/")) {
    const token = request.cookies.get("wtc_consultant_token")?.value;
    if (!token) {
      return NextResponse.redirect(CONSULTANT_LOGIN_URL);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard", "/dashboard/:path*", "/consultantdashboard/:path*", "/consultantdashboard", "/auth/callback", "/license-verified"],
};
