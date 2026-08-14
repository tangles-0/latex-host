import { withApiV1PublicRoute } from "@/lib/api-v1/handler";
import { buildOpenApiDocument } from "@/lib/api-v1/openapi";
import { originFromRequest } from "@/lib/api-v1/resources";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withApiV1PublicRoute(async (request) => {
  const origin = originFromRequest(request);
  return NextResponse.json(buildOpenApiDocument(origin), {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
});

export const OPTIONS = GET;
