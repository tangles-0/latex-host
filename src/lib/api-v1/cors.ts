import { NextResponse } from "next/server";
import type { ApiV1Auth } from "@/lib/api-v1/auth";

function corsHeadersForOrigin(origin: string | null): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Upload-Session-Id, X-Upload-Part-Number",
  );
  headers.set("Access-Control-Max-Age", "86400");
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  } else {
    headers.set("Access-Control-Allow-Origin", "*");
  }
  return headers;
}

export function resolveCorsOrigin(
  request: Request,
  auth: ApiV1Auth | null,
): string | null {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }
  if (!auth || auth.allowedDomains.length === 0) {
    return origin;
  }
  try {
    const host = new URL(origin).hostname.toLowerCase();
    const allowed = auth.allowedDomains.some((pattern) => {
      if (pattern.startsWith("*.")) {
        const bare = pattern.slice(2);
        return host === bare || host.endsWith(`.${bare}`);
      }
      return host === pattern;
    });
    return allowed ? origin : null;
  } catch {
    return null;
  }
}

export function withApiV1Cors(
  request: Request,
  response: Response,
  auth: ApiV1Auth | null = null,
): NextResponse {
  const origin = resolveCorsOrigin(request, auth);
  const cors = corsHeadersForOrigin(origin);
  const headers = new Headers(response.headers);
  cors.forEach((value, key) => {
    headers.set(key, value);
  });
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function apiV1OptionsResponse(
  request: Request,
  auth: ApiV1Auth | null = null,
): NextResponse {
  const origin = resolveCorsOrigin(request, auth);
  return new NextResponse(null, {
    status: 204,
    headers: corsHeadersForOrigin(origin),
  });
}
