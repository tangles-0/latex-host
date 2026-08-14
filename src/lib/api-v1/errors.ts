import { NextResponse } from "next/server";

export type ApiV1ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "unsupported_media_type"
  | "rate_limited"
  | "uploads_disabled"
  | "use_multipart"
  | "use_simple_upload"
  | "domain_not_allowed"
  | "internal_error";

export type ApiV1ErrorBody = {
  error: {
    code: ApiV1ErrorCode;
    message: string;
    details?: unknown;
  };
};

export function apiV1Error(
  status: number,
  code: ApiV1ErrorCode,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
): NextResponse {
  const body: ApiV1ErrorBody = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
  return NextResponse.json(body, { status, headers });
}

export function apiV1Json(
  body: unknown,
  init?: { status?: number; headers?: HeadersInit; location?: string },
): NextResponse {
  const headers = new Headers(init?.headers);
  if (init?.location) {
    headers.set("Location", init.location);
  }
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers,
  });
}

export function rateLimitHeaders(input: {
  limit: number;
  remaining: number;
  resetSeconds: number;
}): HeadersInit {
  return {
    "RateLimit-Limit": String(input.limit),
    "RateLimit-Remaining": String(Math.max(0, input.remaining)),
    "RateLimit-Reset": String(Math.max(0, input.resetSeconds)),
  };
}
