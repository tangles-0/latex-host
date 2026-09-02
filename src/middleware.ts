import { type NextRequest, NextResponse } from "next/server";

import {
  isNodeDisabledApiPath,
  isNodeDisabledPagePath,
} from "@/lib/node-route-policy";

export function middleware(request: NextRequest): NextResponse {
  if (process.env.NODE_MODE !== "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isNodeDisabledApiPath(pathname)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (isNodeDisabledPagePath(pathname)) {
    return new NextResponse("Not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/admin/:path*",
    "/messages/:path*",
    "/account/nodes/:path*",
    "/report-abuse",
    "/promote-admin",
    "/reset-password",
  ],
};
