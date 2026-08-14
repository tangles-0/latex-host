import {
  hostMatchesAllowedDomains,
  requestHostForApiKey,
  verifyApiKeyToken,
  type VerifiedApiKey,
} from "@/lib/api-keys";
import { apiV1Error } from "@/lib/api-v1/errors";
import { NextResponse } from "next/server";

export type ApiV1Auth = VerifiedApiKey;

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export async function requireApiKey(
  request: Request,
): Promise<ApiV1Auth | NextResponse> {
  const token = getBearerToken(request);
  if (!token) {
    return apiV1Error(401, "unauthorized", "Missing or invalid Authorization Bearer token.");
  }
  const verified = await verifyApiKeyToken(token);
  if (!verified) {
    return apiV1Error(401, "unauthorized", "Invalid or revoked API key.");
  }

  if (verified.allowedDomains.length > 0) {
    const host = requestHostForApiKey(request);
    if (!hostMatchesAllowedDomains(host, verified.allowedDomains)) {
      return apiV1Error(
        403,
        "domain_not_allowed",
        "Request origin is not allowed for this API key.",
        { host: host ?? null },
      );
    }
  }

  return verified;
}

export function isApiV1AuthError(
  value: ApiV1Auth | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
