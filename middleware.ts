import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const existing = request.cookies.get("visitorId")?.value;
  const valid = existing && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(existing);
  const visitorId = valid ? existing : crypto.randomUUID();
  // Forward the new cookie into this very request, avoiding an IP identity on
  // the first request and a different cookie identity on the next one.
  request.cookies.set("visitorId", visitorId);
  const response = NextResponse.next({ request: { headers: request.headers } });
  const isDocument = request.headers.get("sec-fetch-dest") === "document" || request.headers.get("accept")?.includes("text/html");
  if (!valid || (isDocument && !request.headers.has("next-router-prefetch"))) {
    response.cookies.set({
      name: "visitorId", value: visitorId, httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
    });
  }
  response.headers.set("Accept-CH", "Sec-CH-UA-Model, Sec-CH-UA-Platform");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp|woff2)$).*)"] };
