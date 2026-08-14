import { withApiV1PublicRoute } from "@/lib/api-v1/handler";
import { originFromRequest } from "@/lib/api-v1/resources";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withApiV1PublicRoute(async (request) => {
  const origin = originFromRequest(request);
  const specUrl = `${origin}/api/v1/openapi.json`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>latex! API v1</title>
    <style>
      body { margin: 0; }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="${specUrl}"
      data-configuration='{"theme":"default"}'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
});

export const OPTIONS = GET;
