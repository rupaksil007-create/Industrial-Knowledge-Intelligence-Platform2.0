import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "./utils/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if it's a public path
  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.includes(".") || // static files like favicon.ico, images, etc.
    pathname.startsWith("/_next"); // next.js system files

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Protect internal routes
  const isProtectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/operations") ||
    pathname.startsWith("/knowledge-graph") ||
    (!isPublicPath && pathname !== "/");

  if (isProtectedPath) {
    const sessionToken = request.cookies.get("ikip_session_token")?.value;

    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const payload = await verifyJWT(sessionToken);
    if (!payload) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("ikip_session_token");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply middleware to all routes except public API endpoints or next static directories
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
