import { NextRequest, NextResponse } from "next/server";
import { getAllowedAuthDomain } from "@/lib/auth-domain";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  getAllowedAuthDomain();

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
