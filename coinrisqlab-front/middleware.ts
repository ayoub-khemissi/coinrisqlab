import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || "changeme-admin-secret-key-2024",
);

const COOKIE_NAME = "coinrisqlab_admin_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  let isAuthenticated = false;

  if (token) {
    try {
      await jwtVerify(token, secret);
      isAuthenticated = true;
    } catch {
      // Invalid/expired token
    }
  }

  // Authenticated user on login page → redirect to admin
  if (pathname === "/admin/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Unauthenticated user on admin pages (except login) → redirect to login
  if (
    pathname.startsWith("/admin") &&
    pathname !== "/admin/login" &&
    !isAuthenticated
  ) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
