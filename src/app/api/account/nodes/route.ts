import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/auth";
import {
  createSelfHostedNode,
  isNodeMode,
  listSelfHostedNodes,
} from "@/lib/self-hosted-nodes";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (isNodeMode()) {
    return NextResponse.json(
      { error: "Node management is only available on latex.gg." },
      { status: 404 },
    );
  }
  return NextResponse.json({ nodes: await listSelfHostedNodes(userId) });
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  if (isNodeMode()) {
    return NextResponse.json(
      { error: "Node management is only available on latex.gg." },
      { status: 404 },
    );
  }
  const created = await createSelfHostedNode(userId);
  return NextResponse.json(created, { status: 201 });
}
