import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import {
  createApiKeyForUser,
  listApiKeysForUser,
  parseAllowedDomains,
} from "@/lib/api-keys";
import { hasTrustedOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const keys = await listApiKeysForUser(userId);
  return NextResponse.json({
    keys: keys.filter((key) => !key.isRevoked),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const payload = (await request.json()) as {
    description?: unknown;
    allowedDomains?: unknown;
  };
  const description =
    typeof payload.description === "string" ? payload.description.trim() : "";
  if (!description) {
    return NextResponse.json(
      { error: "Description is required." },
      { status: 400 },
    );
  }

  const domains = parseAllowedDomains(payload.allowedDomains);
  if (!Array.isArray(domains)) {
    return NextResponse.json({ error: domains.error }, { status: 400 });
  }

  try {
    const created = await createApiKeyForUser({
      userId,
      description,
      allowedDomains: domains,
    });
    return NextResponse.json(
      {
        key: created.key,
        token: created.token,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create API key.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
