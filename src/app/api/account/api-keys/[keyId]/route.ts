import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  revokeApiKeyForUser,
  updateApiKeyDescriptionForUser,
} from "@/lib/api-keys";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ keyId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const { keyId } = await context.params;
  if (!keyId?.trim()) {
    return NextResponse.json({ error: "API key not found." }, { status: 404 });
  }

  const payload = (await request.json()) as { description?: unknown };
  const description =
    typeof payload.description === "string" ? payload.description.trim() : "";
  if (!description) {
    return NextResponse.json(
      { error: "Description is required." },
      { status: 400 },
    );
  }

  try {
    const key = await updateApiKeyDescriptionForUser({
      userId,
      keyId: keyId.trim(),
      description,
    });
    if (!key) {
      return NextResponse.json({ error: "API key not found." }, { status: 404 });
    }
    return NextResponse.json({ key });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update API key.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ keyId: string }> },
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const { keyId } = await context.params;
  if (!keyId?.trim()) {
    return NextResponse.json({ error: "API key not found." }, { status: 404 });
  }

  const revoked = await revokeApiKeyForUser(userId, keyId.trim());
  if (!revoked) {
    return NextResponse.json({ error: "API key not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
