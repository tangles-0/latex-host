import type { NextRequest } from "next/server";

import {
  GET as getLocalShare,
  HEAD as headLocalShare,
  OPTIONS as optionsLocalShare,
} from "@/app/share/[fileName]/route";
import { isNodeMode } from "@/lib/self-hosted-nodes";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ fileName: string }>;
};

const notFound = (): Response => new Response("Not found.", { status: 404 });

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  return isNodeMode() ? getLocalShare(request, context) : notFound();
}

export async function HEAD(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  return isNodeMode() ? headLocalShare(request, context) : notFound();
}

export function OPTIONS(): Response {
  return isNodeMode() ? optionsLocalShare() : notFound();
}
