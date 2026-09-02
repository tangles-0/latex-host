import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import {
  deleteSelfHostedNode,
  setNodeOwnerDisabled,
} from "@/lib/self-hosted-nodes";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

const updateNodeSchema = z.object({
  isDisabled: z.boolean(),
});

export async function PATCH(
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
  const parsed = updateNodeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid node update." },
      { status: 400 },
    );
  }
  const { nodeKey } = await params;
  const node = await setNodeOwnerDisabled(
    nodeKey,
    userId,
    parsed.data.isDisabled,
  );
  if (!node) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }
  return NextResponse.json({ node });
}

export async function DELETE(
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
  if (!(await deleteSelfHostedNode(nodeKey, userId))) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
