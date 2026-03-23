import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  // Redirect uppercase paths to lowercase to prevent case-based bypasses
  const pathname = request.nextUrl.pathname;
  if (pathname !== pathname.toLowerCase()) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 308);
  }

  const isSecure =
    process.env.NODE_ENV === "production" ||
    request.url.startsWith("https://");
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: isSecure,
  });

  if (!token) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|auth|_next/static|_next/image|favicon\\.ico|favicon\\.svg|manifest\\.json|sw\\.js|workbox-.*|cadence-icon\\.svg|icon|apple-icon).*)",
  ],
};
