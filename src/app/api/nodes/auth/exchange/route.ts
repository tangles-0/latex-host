import { NextResponse } from "next/server";
import { z } from "zod";

import { exchangeNodeLoginCode, isNodeMode } from "@/lib/self-hosted-nodes";

export const runtime = "nodejs";

const exchangeSchema = z.object({
  nodeHash: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9]+$/),
  code: z.string().min(32).max(128),
});

export async function POST(request: Request): Promise<NextResponse> {
  if (isNodeMode()) {
    return NextResponse.json(
      { error: "Code exchange is only available on latex.gg." },
      { status: 404 },
    );
  }
  const parsed = exchangeSchema.safeParse(
    await request.json().catch(() => null),
  );
  const authorization = request.headers.get("authorization");
  const authSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!parsed.success || !authSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const user = await exchangeNodeLoginCode({
    ...parsed.data,
    authSecret,
  });
  if (!user) {
    return NextResponse.json(
      { error: "The authorization code is invalid or expired." },
      { status: 401 },
    );
  }
  return NextResponse.json(user, {
    headers: { "Cache-Control": "no-store" },
  });
}
