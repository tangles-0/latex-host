import { NextResponse } from "next/server";
import { z } from "zod";

import { consumeRequestRateLimit } from "@/lib/request-rate-limit";
import { isNodeMode, registerSelfHostedNode } from "@/lib/self-hosted-nodes";

export const runtime = "nodejs";

const registerNodeSchema = z.object({
  linkCode: z.string().min(8).max(32),
  publicHttpsUrl: z.string().url().max(2048),
  setupChallenge: z.string().min(24).max(128),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (isNodeMode()) {
    return NextResponse.json(
      { error: "Registration is only available on latex.gg." },
      { status: 404 },
    );
  }
  const rate = await consumeRequestRateLimit({
    namespace: "node-register",
    key: request.headers.get("x-forwarded-for") ?? "unknown",
    limit: 10,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }
  const parsed = registerNodeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration request." },
      { status: 400 },
    );
  }
  try {
    const result = await registerSelfHostedNode(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to link node.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
