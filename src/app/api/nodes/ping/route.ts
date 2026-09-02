import { NextResponse } from "next/server";
import { z } from "zod";

import { isNodeMode, pingSelfHostedNode } from "@/lib/self-hosted-nodes";

export const runtime = "nodejs";

const pingSchema = z.object({
  nodeHash: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9]+$/),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (isNodeMode()) {
    return NextResponse.json(
      { error: "Ping is only available on latex.gg." },
      { status: 404 },
    );
  }
  const parsed = pingSchema.safeParse(await request.json().catch(() => null));
  const authorization = request.headers.get("authorization");
  const authSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!parsed.success || !authSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const node = await pingSelfHostedNode(parsed.data.nodeHash, authSecret);
  if (!node) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json({ node });
}
