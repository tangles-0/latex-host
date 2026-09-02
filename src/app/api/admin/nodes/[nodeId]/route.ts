import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import { isAdminUser } from "@/lib/metadata-store";
import {
  deleteSelfHostedNodeAsAdmin,
  setNodeAdminDisabled,
} from "@/lib/self-hosted-nodes";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

const updateNodeSchema = z.object({
  isDisabled: z.boolean(),
});

const authorizeAdminMutation = async (
  request: Request,
): Promise<NextResponse | null> => {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await isAdminUser(userId))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  return null;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ nodeId: string }> },
): Promise<NextResponse> {
  const authorizationError = await authorizeAdminMutation(request);
  if (authorizationError) {
    return authorizationError;
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

  const { nodeId } = await params;
  const node = await setNodeAdminDisabled(nodeId, parsed.data.isDisabled);
  if (!node) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }
  return NextResponse.json({ node });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ nodeId: string }> },
): Promise<NextResponse> {
  const authorizationError = await authorizeAdminMutation(request);
  if (authorizationError) {
    return authorizationError;
  }

  const { nodeId } = await params;
  if (!(await deleteSelfHostedNodeAsAdmin(nodeId))) {
    return NextResponse.json({ error: "Node not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
