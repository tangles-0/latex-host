import { isApiV1AuthError, requireApiKey, type ApiV1Auth } from "@/lib/api-v1/auth";
import { apiV1OptionsResponse, withApiV1Cors } from "@/lib/api-v1/cors";
import { apiV1Error } from "@/lib/api-v1/errors";
import { NextResponse } from "next/server";

type StaticHandler = (
  request: Request,
  auth: ApiV1Auth,
) => Promise<Response>;

type ParamsHandler<P extends Record<string, string>> = (
  request: Request,
  auth: ApiV1Auth,
  context: { params: Promise<P> },
) => Promise<Response>;

async function runAuthenticated(
  request: Request,
  run: (auth: ApiV1Auth) => Promise<Response>,
): Promise<NextResponse> {
  if (request.method === "OPTIONS") {
    return apiV1OptionsResponse(request);
  }
  const auth = await requireApiKey(request);
  if (isApiV1AuthError(auth)) {
    return withApiV1Cors(request, auth);
  }
  try {
    const response = await run(auth);
    return withApiV1Cors(request, response, auth);
  } catch (error) {
    console.error("[api/v1]", error instanceof Error ? error.message : error);
    return withApiV1Cors(
      request,
      apiV1Error(500, "internal_error", "Internal server error."),
      auth,
    );
  }
}

/** For routes without dynamic segments (Next typed routes expect no optional context). */
export function withApiV1Route(handler: StaticHandler) {
  return async (request: Request): Promise<NextResponse> =>
    runAuthenticated(request, (auth) => handler(request, auth));
}

/** For `/[id]` (and nested) routes. */
export function withApiV1ParamsRoute<P extends Record<string, string>>(
  handler: ParamsHandler<P>,
) {
  return async (
    request: Request,
    context: { params: Promise<P> },
  ): Promise<NextResponse> =>
    runAuthenticated(request, (auth) => handler(request, auth, context));
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
