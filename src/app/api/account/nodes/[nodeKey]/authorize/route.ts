import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/auth";
import { createNodeLoginAuthorization } from "@/lib/self-hosted-nodes";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ nodeKey: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const { nodeKey } = await params;
  const redirectUrl = await createNodeLoginAuthorization(nodeKey, userId);
  if (!redirectUrl) {
    return NextResponse.json(
      { error: "Node not found or disabled." },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { redirectUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
