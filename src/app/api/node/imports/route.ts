import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import { createNodeImportJob, listNodeImportJobs } from "@/lib/node-imports";
import { isNodeMode } from "@/lib/self-hosted-nodes";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getAlbumForUser } from "@/lib/metadata-store";

export const runtime = "nodejs";

const createImportSchema = z.object({
  selectedPaths: z.array(z.string().max(4096)).min(1).max(1000),
  albumId: z.string().min(1).max(128).optional(),
  isShareAll: z.boolean().default(false),
});

export async function GET(): Promise<NextResponse> {
  if (!isNodeMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return NextResponse.json({ jobs: await listNodeImportJobs(userId) });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isNodeMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  const parsed = createImportSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid import request." },
      { status: 400 },
    );
  }
  if (
    parsed.data.albumId &&
    !(await getAlbumForUser(parsed.data.albumId, userId))
  ) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }
  try {
    const job = await createNodeImportJob({ userId, ...parsed.data });
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to queue import.",
      },
      { status: 400 },
    );
  }
}
