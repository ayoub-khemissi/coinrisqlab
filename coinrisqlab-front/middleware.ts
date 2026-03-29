import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ─── Admin Auth ─────────────────────────────────────────────────────────────

const adminSecret = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || "changeme-admin-secret-key-2024",
);

const ADMIN_COOKIE = "coinrisqlab_admin_session";

// ─── User Auth ──────────────────────────────────────────────────────────────

const USER_COOKIE = "coinrisqlab_user_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin routes (unchanged logic) ──────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    let isAuthenticated = false;

    if (token) {
      try {
        await jwtVerify(token, adminSecret);
        isAuthenticated = true;
      } catch {
        // Invalid/expired token
      }
    }

    if (pathname === "/admin/login" && isAuthenticated) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (
      pathname.startsWith("/admin") &&
      pathname !== "/admin/login" &&
      !isAuthenticated
    ) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    return NextResponse.next();
  }

  // ── User routes ─────────────────────────────────────────────────────────
  const userToken = request.cookies.get(USER_COOKIE)?.value;
  const hasUserSession = !!userToken;

  // Authenticated user on login/register → redirect to dashboard
  if ((pathname === "/login" || pathname === "/register") && hasUserSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated user on dashboard → redirect to login
  if (pathname.startsWith("/dashboard") && !hasUserSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/login", "/register"],
};
