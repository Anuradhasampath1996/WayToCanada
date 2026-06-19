import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_LOGIN_URL } from "@/lib/auth-urls";

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

  const token = request.cookies.get("wtc_token")?.value;

  // Client dashboard routes require the token cookie
  if (pathname.startsWith("/user-dashboard")) {
    if (!token) {
      return NextResponse.redirect(PUBLIC_LOGIN_URL);
    }
    return NextResponse.next();
  }

  // Legacy /dashboard/* routes
  if (pathname.startsWith("/dashboard/")) {
    if (!token) {
      return NextResponse.redirect(PUBLIC_LOGIN_URL);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard", "/dashboard/:path*", "/user-dashboard", "/user-dashboard/:path*", "/auth/callback"],
};
