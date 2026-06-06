import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_LOGIN_URL =
  process.env.NEXT_PUBLIC_PUBLIC_WEBSITE_URL ?? "http://localhost:3003";

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

  // All /dashboard/* routes require the token cookie
  if (pathname.startsWith("/dashboard/")) {
    const token = request.cookies.get("wtc_token")?.value;
    if (!token) {
      return NextResponse.redirect(`${PUBLIC_LOGIN_URL}/login`);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard", "/dashboard/:path*", "/auth/callback"]
};
