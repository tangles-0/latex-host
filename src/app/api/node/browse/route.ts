import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/auth";
import { browseNodeStorage } from "@/lib/node-imports";
import { isNodeMode } from "@/lib/self-hosted-nodes";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  if (!isNodeMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!(await getSessionUserId())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const relativePath = new URL(request.url).searchParams.get("path") ?? "";
    return NextResponse.json(await browseNodeStorage(relativePath));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to browse storage.",
      },
      { status: 400 },
    );
  }
}
