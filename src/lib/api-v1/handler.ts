import { isApiV1AuthError, requireApiKey, type ApiV1Auth } from "@/lib/api-v1/auth";
import { apiV1OptionsResponse, withApiV1Cors } from "@/lib/api-v1/cors";
import { apiV1Error } from "@/lib/api-v1/errors";
import { NextResponse } from "next/server";

type Handler = (
  request: Request,
  auth: ApiV1Auth,
  context?: { params: Promise<Record<string, string>> },
) => Promise<Response>;

export function withApiV1Route(handler: Handler) {
  return async (
    request: Request,
    context?: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    if (request.method === "OPTIONS") {
      return apiV1OptionsResponse(request);
    }
    const auth = await requireApiKey(request);
    if (isApiV1AuthError(auth)) {
      return withApiV1Cors(request, auth);
    }
    try {
      const response = await handler(request, auth, context);
      return withApiV1Cors(request, response, auth);
    } catch (error) {
      console.error("[api/v1]", error instanceof Error ? error.message : error);
      return withApiV1Cors(
        request,
        apiV1Error(500, "internal_error", "Internal server error."),
        auth,
      );
    }
  };
}

export function withApiV1PublicRoute(
  handler: (request: Request) => Promise<Response>,
) {
  return async (request: Request): Promise<NextResponse> => {
    if (request.method === "OPTIONS") {
      return apiV1OptionsResponse(request);
    }
    try {
      const response = await handler(request);
      return withApiV1Cors(request, response);
    } catch (error) {
      console.error("[api/v1]", error instanceof Error ? error.message : error);
      return withApiV1Cors(
        request,
        apiV1Error(500, "internal_error", "Internal server error."),
      );
    }
  };
}
