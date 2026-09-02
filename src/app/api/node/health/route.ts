import { NextResponse } from "next/server";

import {
  getOrCreateNodeInstanceSettings,
  isNodeMode,
} from "@/lib/self-hosted-nodes";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  if (!isNodeMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const challenge = new URL(request.url).searchParams.get("challenge") ?? "";
  const settings = await getOrCreateNodeInstanceSettings();
  const isValid =
    challenge.length > 0 &&
    (challenge === settings.setupChallenge || challenge === settings.nodeHash);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid challenge." }, { status: 403 });
  }
  return NextResponse.json(
    { ok: true, challenge },
    { headers: { "Cache-Control": "no-store" } },
  );
}
