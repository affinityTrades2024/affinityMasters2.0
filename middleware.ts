import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeSession } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/dashboard", "/transactions", "/team", "/pamm", "/profile", "/admin", "/manage", "/wallets", "/funds"];
const AUTH_PREFIXES = ["/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookie = request.cookies.get("affinity_session")?.value;

  const session = cookie ? await decodeSession(cookie) : null;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PREFIXES.some((p) => pathname.startsWith(p));

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.redirect(new URL("/manage", request.url));
  }
  if (pathname === "/registration" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (isProtected && !session) {
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }
  if (isAuthPage && session && pathname.startsWith("/auth/login")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/transactions/:path*", "/team/:path*", "/pamm/:path*", "/profile/:path*", "/admin/:path*", "/manage/:path*", "/wallets/:path*", "/funds", "/funds/:path*", "/registration", "/auth/:path*"],
};
